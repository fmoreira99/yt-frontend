import type {
  AnalyticsBundle,
  AnalyticsCatalogItem,
  AnalyticsReport,
  ChannelAnalytics,
  ChannelLink,
  ChannelScanSummary,
  CoreAccount,
  ExtractVideosResponse,
  GenerateResponse,
  InspirationResponse,
  JobLog,
  JobStatus,
  LinkKind,
  MediaProvider,
  Pagination,
  ReanalysisSummary,
  ReportFile,
  ReportJob,
  ScheduleStatus,
  SearchResponse,
  ServiceHealth,
  StoredResult,
  VideoStats,
  YoutubeAccount,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function toSearch(query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function fail(status: number, text: string): never {
  let body: { error?: { code?: string; message?: string } } = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* respuesta no JSON */
  }
  if (status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  throw new ApiError(body.error?.code ?? `HTTP_${status}`, body.error?.message ?? `Error ${status}`, status);
}

/** Como `call`, pero devuelve el cuerpo tal cual (descarga de CSV). */
async function callText(path: string, init: { query?: Query } = {}): Promise<string> {
  const res = await fetch(`/api/${path}${toSearch(init.query)}`);
  const text = await res.text();
  if (!res.ok) fail(res.status, text);
  return text;
}

async function call<T>(path: string, init: { method?: string; query?: Query; json?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/${path}${toSearch(init.query)}`, {
    method: init.method ?? 'GET',
    headers: init.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  const text = await res.text();
  if (!res.ok) fail(res.status, text);
  return JSON.parse(text) as T;
}

export const api = {
  health: (service: string) => call<ServiceHealth>(`health/${service}`),

  /* yt-extractor-service */
  extractVideos: (body: { urls: string[]; skip_duplicate_check?: boolean; require_transcript?: boolean }) =>
    call<ExtractVideosResponse>('extractor/extract/videos', { method: 'POST', json: body }),
  extractChannel: (body: { channel_id: string; max_videos?: number; skip_duplicate_check?: boolean }) =>
    call<ChannelScanSummary>('extractor/extract/channel', { method: 'POST', json: body }),
  listResults: (query: { limit?: number; offset?: number; channel_id?: string }) =>
    call<{ data: StoredResult[]; pagination: Pagination }>('extractor/results', { query }),
  getResult: (videoId: string) => call<{ data: StoredResult }>(`extractor/results/${videoId}`),
  analyzePending: (body: { limit?: number; channel_id?: string; video_ids?: string[] }) =>
    call<ReanalysisSummary>('extractor/results/analyze', { method: 'POST', json: body }),
  scheduleStatus: () => call<{ schedules: ScheduleStatus[] }>('extractor/sensor/status'),
  createSchedule: (body: { channel_id: string; cron_expression: string; max_videos?: number }) =>
    call<{ schedule: ScheduleStatus }>('extractor/sensor/schedule', { method: 'POST', json: body }),
  triggerNow: (body: { channel_id: string; max_videos?: number; skip_duplicate_check?: boolean }) =>
    call<{ status: string; channel_id: string }>('extractor/sensor/trigger-now', { method: 'POST', json: body }),
  deleteChannel: (channel: string) =>
    call<{ status: string; channel_id: string }>(`extractor/sensor/channels/${encodeURIComponent(channel)}`, {
      method: 'DELETE',
    }),
  removeSchedule: (channel: string) =>
    call<{ status: string; channel_id: string }>(`extractor/sensor/schedule/${encodeURIComponent(channel)}`, {
      method: 'DELETE',
    }),

  /* core-db-service */
  deleteResult: (videoId: string) =>
    call<{ status: string; video_id: string; deleted_rows: number }>(`extractor/results/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
    }),
  inspiration: (query: { target: string; state?: 'pending' | 'used' | 'all'; limit?: number; offset?: number }) =>
    call<InspirationResponse>('extractor/inspiration', { query }),
  setInspirationUsed: (target: string, videoId: string, used: boolean) =>
    call<{ status: string }>('extractor/inspiration/used', { method: 'POST', json: { target, video_id: videoId, used } }),
  listLinks: (target: string) => call<{ data: ChannelLink[] }>('core/links', { query: { target } }),
  link: (target: string, kind: LinkKind, ref: string) =>
    call<{ data: ChannelLink }>('core/links', { method: 'PUT', json: { target_channel_id: target, kind, ref_id: ref } }),
  unlink: (target: string, kind: LinkKind, ref: string) =>
    call<{ data: { deleted: number } }>('core/links', { method: 'DELETE', query: { target, kind, ref } }),
  coreAccounts: () => call<{ data: CoreAccount[] }>('core/accounts'),
  jobLogs: (service: string, query: { limit?: number; offset?: number; status?: JobStatus | '' }) =>
    call<{ data: JobLog[]; pagination: Pagination }>(`core/jobs/logs/${encodeURIComponent(service)}`, { query }),

  /* ms-media-hub */
  mediaProviders: () => call<{ data: { providers: MediaProvider[] } }>('media/providers'),
  mediaSearch: (query: { q: string; type?: string; provider?: string; page?: number; limit?: number }) =>
    call<SearchResponse>('media/search', { query }),
  mediaGenerate: (body: {
    task: 'ai_text' | 'ai_image';
    provider?: string;
    prompt: string;
    options?: { max_tokens?: number; temperature?: number };
  }) => call<GenerateResponse>('media/generate', { method: 'POST', json: body }),

  /* ms-youtube */
  youtubeAuthUrl: () => call<{ data: { url: string } }>('youtube/auth/url'),
  youtubeAccounts: () => call<{ data: { accounts: YoutubeAccount[] } }>('youtube/auth/accounts'),
  youtubeVideoStats: (videoId: string, accountId: string) =>
    call<{ data: { stats: VideoStats } }>(`youtube/analytics/videos/${encodeURIComponent(videoId)}/stats`, {
      query: { accountId },
    }),
  youtubeChannelAnalytics: (query: { accountId: string; startDate: string; endDate: string; metrics?: string }) =>
    call<{ data: { analytics: ChannelAnalytics } }>('youtube/analytics/channel', { query }),
  analyticsCatalog: () => call<{ data: { reports: AnalyticsCatalogItem[] } }>('youtube/analytics/reports'),
  analyticsReport: (accountId: string, reportId: string, query: { startDate: string; endDate: string; videoId?: string; top?: number }) =>
    call<{ data: { report: AnalyticsReport } }>(`youtube/analytics/reports/${encodeURIComponent(reportId)}`, {
      query: { accountId, ...query },
    }),
  analyticsBundle: (accountId: string, query: { startDate: string; endDate: string; top?: number }) =>
    call<{ data: { bundle: AnalyticsBundle } }>('youtube/analytics/bundle', { query: { accountId, ...query } }),
  youtubeDisconnect: (accountId: string) =>
    call<{ data: { id: string; revoked: boolean; disconnected: boolean } }>(
      `youtube/auth/accounts/${encodeURIComponent(accountId)}`,
      { method: 'DELETE' },
    ),
  reportJobs: (accountId: string) => call<{ data: { jobs: ReportJob[] } }>('youtube/reports/jobs', { query: { accountId } }),
  enableReports: (accountId: string) =>
    call<{ data: { jobs: ReportJob[]; created: string[] } }>('youtube/reports/jobs', { method: 'POST', json: { accountId } }),
  jobReports: (accountId: string, jobId: string) =>
    call<{ data: { reports: ReportFile[] } }>(`youtube/reports/jobs/${encodeURIComponent(jobId)}/reports`, { query: { accountId } }),
  downloadReport: (accountId: string, jobId: string, reportId: string) =>
    callText(`youtube/reports/jobs/${encodeURIComponent(jobId)}/reports/${encodeURIComponent(reportId)}/download`, {
      query: { accountId },
    }),
  youtubeDeleteVideo: (videoId: string, accountId: string) =>
    call<{ data: { videoId: string; deleted: boolean } }>(`youtube/videos/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
      query: { accountId },
    }),
};

/** Subida con progreso (fetch no expone el avance de subida). Los metadatos van ANTES del archivo. */
export function uploadYoutubeVideo(
  fields: { accountId: string; title: string; privacyStatus: string; description?: string; tags?: string; categoryId?: string },
  file: File,
  onProgress: (fraction: number) => void,
): Promise<{ id?: string; snippet?: { title?: string } }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/youtube/videos/upload');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError('NETWORK', 'Error de red durante la subida', 0));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(JSON.parse(xhr.responseText).data.video);
      try {
        fail(xhr.status, xhr.responseText);
      } catch (err) {
        reject(err);
      }
    };
    xhr.send(form);
  });
}
