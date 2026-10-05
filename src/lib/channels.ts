import type { CoreAccount, ScheduleStatus, StoredResult, YoutubeAccount } from './types';

export interface Monitor {
  accountId: string;
  /** Hay un schedule cargado en el extractor (la verdad en ejecución). */
  active: boolean;
  /** El core lo marca activo pero el extractor no lo tiene cargado (p. ej. tras un reinicio fallido). */
  needsRestore: boolean;
  cron: string;
  maxVideos: number | null;
  running: boolean;
  lastRunAt: string | null;
  lastStatus: ScheduleStatus['last_status'];
  lastError: string | null;
  nextRunAt: string | null;
}

export interface Connection {
  accountId: string;
  connectedAt: string;
  hasAnalytics: boolean;
}

export interface ChannelStats {
  videos: number;
  analyzed: number;
  views: number;
  likes: number;
  lastPublishedAt: string | null;
}

export interface Channel {
  id: string;
  name: string;
  avatar: string | null;
  monitor: Monitor | null;
  connection: Connection | null;
  stats: ChannelStats;
}

export type ChannelState = 'running' | 'error' | 'active' | 'paused' | 'connected';

export const CHANNEL_PROVIDER = 'youtube_channel';

export function channelState(channel: Channel): ChannelState {
  const { monitor } = channel;
  if (monitor?.running) return 'running';
  if (monitor?.active && monitor.lastStatus === 'failed') return 'error';
  if (monitor?.active) return 'active';
  if (monitor) return 'paused';
  return 'connected';
}

export const STATE_LABEL: Record<ChannelState, string> = {
  running: 'Escaneando',
  error: 'Con error',
  active: 'Activo',
  paused: 'Pausado',
  connected: 'Solo conectado',
};

const EMPTY_STATS: ChannelStats = { videos: 0, analyzed: 0, views: 0, likes: 0, lastPublishedAt: null };

function statsFor(videos: StoredResult[]): ChannelStats {
  let lastPublishedAt: string | null = null;
  const stats = { ...EMPTY_STATS };
  for (const video of videos) {
    stats.videos++;
    if (video.analysis) stats.analyzed++;
    stats.views += video.metadata.view_count ?? 0;
    stats.likes += video.metadata.like_count ?? 0;
    const published = video.metadata.published_at;
    if (published && (!lastPublishedAt || published > lastPublishedAt)) lastPublishedAt = published;
  }
  return { ...stats, lastPublishedAt };
}

interface Sources {
  accounts: CoreAccount[];
  /** null = aún no se sabe (cargando o el extractor no responde). */
  schedules: ScheduleStatus[] | null;
  results: StoredResult[];
  youtube: YoutubeAccount[];
}

/** Unifica canales monitoreados (core + extractor) y canales conectados con Google (ms-youtube). */
export function buildChannels({ accounts, schedules, results, youtube }: Sources): Channel[] {
  const scheduleById = new Map((schedules ?? []).map((s) => [s.channel_id, s]));
  const videosById = new Map<string, StoredResult[]>();
  for (const result of results) {
    const id = result.metadata.channel_id;
    if (id) videosById.set(id, [...(videosById.get(id) ?? []), result]);
  }
  const youtubeById = new Map(youtube.map((a) => [a.channelId, a]));
  const channels = new Map<string, Channel>();

  const connectionOf = (account: YoutubeAccount | undefined): Connection | null =>
    account
      ? {
          accountId: account.id,
          connectedAt: account.createdAt,
          hasAnalytics: account.scope.some((s) => s.includes('yt-analytics')),
        }
      : null;

  const nameFrom = (id: string, ...candidates: Array<string | null | undefined>) =>
    candidates.find((c) => c && c.trim()) ?? videosById.get(id)?.[0]?.metadata.channel_title ?? id;

  for (const account of accounts) {
    if (account.provider !== CHANNEL_PROVIDER) continue;
    const id = account.external_id;
    const schedule = scheduleById.get(id);
    const meta = account.metadata as { active?: boolean; cron_expression?: string; max_videos?: number | null };
    const coreActive = meta.active === true;
    const connected = youtubeById.get(id);

    channels.set(id, {
      id,
      name: nameFrom(id, account.name, connected?.channelTitle),
      avatar: connected?.thumbnailUrl ?? null,
      connection: connectionOf(connected),
      stats: statsFor(videosById.get(id) ?? []),
      monitor: {
        accountId: account.id,
        // Mientras no se conozcan los schedules en ejecución se usa lo que dice el core.
        active: schedules ? Boolean(schedule) : coreActive,
        needsRestore: schedules !== null && coreActive && !schedule,
        cron: schedule?.cron_expression ?? meta.cron_expression ?? '0 */6 * * *',
        maxVideos: schedule?.max_videos ?? meta.max_videos ?? null,
        running: schedule?.running ?? false,
        lastRunAt: schedule?.last_run_at ?? null,
        lastStatus: schedule?.last_status ?? null,
        lastError: schedule?.last_error ?? null,
        nextRunAt: schedule?.next_run_at ?? null,
      },
    });
  }

  for (const account of youtube) {
    if (channels.has(account.channelId)) continue;
    channels.set(account.channelId, {
      id: account.channelId,
      name: nameFrom(account.channelId, account.channelTitle),
      avatar: account.thumbnailUrl ?? null,
      monitor: null,
      connection: connectionOf(account),
      stats: statsFor(videosById.get(account.channelId) ?? []),
    });
  }

  const order: Record<ChannelState, number> = { error: 0, running: 1, active: 2, connected: 3, paused: 4 };
  return [...channels.values()].sort(
    (a, b) => order[channelState(a)] - order[channelState(b)] || a.name.localeCompare(b.name, 'es'),
  );
}

export const channelUrl = (id: string) => `https://www.youtube.com/channel/${id}`;

/** Color estable por canal para el avatar con iniciales. */
export function avatarHue(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
