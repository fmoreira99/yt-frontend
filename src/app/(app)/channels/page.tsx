'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { buildChannels, channelState, type Channel } from '@/lib/channels';
import { DEFAULT_CRON } from '@/lib/cron';
import { formatCompact } from '@/lib/format';
import { useQuery } from '@/lib/hooks';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Button, Card, Empty, ErrorBox, PageHeader } from '@/components/ui';
import { AddChannel } from '@/components/channels/AddChannel';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { ChannelDrawer } from '@/components/channels/ChannelDrawer';

type Filter = 'all' | 'active' | 'paused' | 'connected';

function matches(channel: Channel, filter: Filter): boolean {
  const state = channelState(channel);
  if (filter === 'active') return state === 'active' || state === 'running' || state === 'error';
  if (filter === 'paused') return state === 'paused';
  if (filter === 'connected') return channel.connection !== null;
  return true;
}

function ChannelsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  // Cada fuente carga por separado: la lista aparece con lo primero que llegue y se completa sola.
  const accounts = useQuery(() => api.coreAccounts());
  const schedules = useQuery(() => api.scheduleStatus());
  const results = useQuery(() => api.listResults({ limit: 100 }));
  const youtube = useQuery(() => api.youtubeAccounts());

  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  const allResults = results.data?.data;
  const channels = useMemo(
    () =>
      buildChannels({
        accounts: accounts.data?.data ?? [],
        schedules: schedules.data?.schedules ?? null,
        results: allResults ?? [],
        youtube: youtube.data?.data.accounts ?? [],
      }),
    [accounts.data, schedules.data, allResults, youtube.data],
  );

  const reloadStatus = useCallback(() => {
    void accounts.reload();
    void schedules.reload();
    void youtube.reload();
  }, [accounts, schedules, youtube]);

  // Avisa si la carga inicial tarda (servicios dormidos en Render).
  useEffect(() => {
    if (accounts.data) return setSlow(false);
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [accounts.data]);

  // Mientras haya un escaneo en curso, refresca el estado cada 8 s.
  const anyRunning = channels.some((c) => c.monitor?.running);
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(() => void schedules.reload(), 8000);
    return () => clearInterval(timer);
  }, [anyRunning, schedules]);

  // Vuelta de Google OAuth (/auth/youtube/callback redirige aquí con ?connected= o ?error=).
  const connected = params.get('connected');
  const oauthError = params.get('error');
  useEffect(() => {
    if (!connected && !oauthError) return;
    if (connected) {
      toast.success(`Cuenta conectada: ${connected}`);
      void youtube.reload();
    } else toast.error(oauthError!);
    const next = new URLSearchParams(window.location.search);
    next.delete('connected');
    next.delete('error');
    router.replace(next.size ? `/channels?${next}` : '/channels');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, oauthError]);

  const selectedId = params.get('c');
  const selected = channels.find((c) => c.id === selectedId) ?? null;
  const open = (id: string) => router.push(`/channels?c=${encodeURIComponent(id)}`, { scroll: false });
  const close = useCallback(() => router.replace('/channels', { scroll: false }), [router]);

  async function act(channel: Channel, work: () => Promise<unknown>, success: string) {
    setBusyId(channel.id);
    try {
      await work();
      toast.success(success);
      setTimeout(reloadStatus, 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo completar la acción');
    } finally {
      setBusyId(null);
    }
  }

  const visible = channels.filter((c) => matches(c, filter));
  const count = (f: Filter) => channels.filter((c) => matches(c, f)).length;
  const totalVideos = channels.reduce((n, c) => n + c.stats.videos, 0);
  const totalViews = channels.reduce((n, c) => n + c.stats.views, 0);
  const initialLoading = !accounts.data && accounts.loading;
  const youtubeUnavailable = !youtube.loading && youtube.error !== null;

  return (
    <>
      <PageHeader
        title="Canales"
        description="Conecta, monitorea y administra tus canales de YouTube desde un solo lugar."
        actions={
          <Button variant="primary" icon="play" onClick={() => setAdding((v) => !v)}>
            Añadir canal
          </Button>
        }
      />

      {adding && (
        <AddChannel
          canConnect
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            toast.success('Canal añadido. El primer escaneo está en marcha.');
            reloadStatus();
            open(id);
          }}
        />
      )}

      <ErrorBox message={accounts.error} onRetry={accounts.reload} />
      {schedules.error && !accounts.error && (
        <div className="alert alert-info row-between">
          <span>No se pudo leer el estado del extractor: se muestra lo guardado. {schedules.error}</span>
          <Button size="sm" onClick={schedules.reload}>Reintentar</Button>
        </div>
      )}
      {youtubeUnavailable && (
        <div className="alert alert-info row-between">
          <span>ms-youtube no responde: no se pueden mostrar los canales conectados con Google.</span>
          <Button size="sm" onClick={youtube.reload}>Reintentar</Button>
        </div>
      )}

      {initialLoading && (
        <div className="stack">
          <div className="channel-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card skeleton-card" aria-hidden />
            ))}
          </div>
          <p className="muted small" role="status">
            {slow ? 'Despertando los servicios… las primeras cargas pueden tardar hasta un minuto.' : 'Cargando canales…'}
          </p>
        </div>
      )}

      {accounts.data && channels.length === 0 && !adding && (
        <Card>
          <Empty icon="play" title="Aún no hay canales">
            Pega el enlace de un canal para monitorear sus videos nuevos, o conecta el tuyo con Google para ver sus estadísticas.
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={() => setAdding(true)}>Añadir el primer canal</Button>
            </div>
          </Empty>
        </Card>
      )}

      {channels.length > 0 && (
        <>
          <div className="row-between">
            <div className="seg" role="radiogroup" aria-label="Filtrar canales">
              {(
                [
                  ['all', 'Todos'],
                  ['active', 'Activos'],
                  ['paused', 'Pausados'],
                  ['connected', 'Google'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="radio" aria-checked={filter === id} className="seg-item" onClick={() => setFilter(id)}>
                  {label} <span className="seg-count">{count(id)}</span>
                </button>
              ))}
            </div>
            <span className="small muted row" style={{ gap: 6 }}>
              {(schedules.loading || results.loading || youtube.loading) && <span className="spinner" style={{ width: 12, height: 12 }} />}
              {totalVideos} videos analizados · {formatCompact(totalViews)} vistas
            </span>
          </div>

          {visible.length === 0 ? (
            <Card>
              <Empty icon="list" title="Ningún canal en esta vista">Cambia el filtro para ver el resto.</Empty>
            </Card>
          ) : (
            <div className="channel-grid">
              {visible.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  busy={busyId === channel.id}
                  onOpen={() => open(channel.id)}
                  onScan={() => act(channel, () => api.triggerNow({ channel_id: channel.id }), `Escaneo iniciado: ${channel.name}`)}
                  onResume={() =>
                    act(
                      channel,
                      () =>
                        api.createSchedule({
                          channel_id: channel.id,
                          cron_expression: channel.monitor?.cron ?? DEFAULT_CRON,
                          max_videos: channel.monitor?.maxVideos ?? undefined,
                        }),
                      `Monitoreo reanudado: ${channel.name}`,
                    )
                  }
                  onMonitor={() =>
                    act(
                      channel,
                      () => api.createSchedule({ channel_id: channel.id, cron_expression: DEFAULT_CRON, max_videos: 10 }),
                      `Monitoreo activado: ${channel.name}`,
                    )
                  }
                />
              ))}
            </div>
          )}
          <p className="small muted row" style={{ gap: 6 }}>
            <Icon name="clock" size={14} /> Los servicios gratuitos duermen tras 15 min sin uso: los escaneos programados solo corren mientras el extractor está despierto.
          </p>
        </>
      )}

      {selected && (
        <ChannelDrawer
          channel={selected}
          channels={channels}
          videos={(allResults ?? []).filter((r) => r.metadata.channel_id === selected.id)}
          onClose={close}
          onChanged={reloadStatus}
        />
      )}
    </>
  );
}

export default function ChannelsPage() {
  return (
    <Suspense>
      <ChannelsContent />
    </Suspense>
  );
}
