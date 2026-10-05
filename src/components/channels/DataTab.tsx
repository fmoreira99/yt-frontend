'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { slug, toCsv, downloadFile } from '@/lib/csv';
import { useAction } from '@/lib/hooks';
import { isoDay } from '@/lib/format';
import type { StoredResult } from '@/lib/types';
import { Button, Card, ErrorBox } from '../ui';
import { useToast } from '../Toast';
import type { TabProps } from './ChannelDrawer';
import { ReportsCard } from './ReportsCard';

const METRIC_LABELS: Record<string, string> = {
  views: 'vistas',
  estimatedMinutesWatched: 'minutos_vistos',
  averageViewDuration: 'duracion_media_s',
  subscribersGained: 'suscriptores_ganados',
  subscribersLost: 'suscriptores_perdidos',
  likes: 'me_gusta',
  comments: 'comentarios',
  shares: 'compartidos',
};
const ALL_METRICS = Object.keys(METRIC_LABELS).join(',');
const RANGES = [7, 28, 90, 365];

/** Todas las extracciones guardadas del canal (de 100 en 100). */
async function fetchAllVideos(channelId: string): Promise<StoredResult[]> {
  const all: StoredResult[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await api.listResults({ channel_id: channelId, limit: 100, offset });
    all.push(...page.data);
    if (page.data.length < 100) break;
  }
  return all;
}

export function DataTab({ channel }: TabProps) {
  const toast = useToast();
  const [days, setDays] = useState(28);
  const base = slug(channel.name);

  const exportVideos = useAction(async (format: 'csv' | 'json') => {
    const videos = await fetchAllVideos(channel.id);
    if (!videos.length) return toast.info('Este canal todavía no tiene videos guardados');

    if (format === 'json') {
      downloadFile(`${base}-videos-${isoDay()}.json`, JSON.stringify(videos, null, 2), 'application/json');
    } else {
      const headers = ['video_id', 'url', 'titulo', 'canal', 'publicado', 'extraido', 'vistas', 'me_gusta', 'duracion_s', 'tags', 'keywords', 'resumen_ia', 'temas', 'gancho', 'idioma', 'guion_disponible'];
      const rows = videos.map((v) => [
        v.video_id,
        v.metadata.url,
        v.metadata.title,
        v.metadata.channel_title,
        v.metadata.published_at,
        v.extracted_at,
        v.metadata.view_count,
        v.metadata.like_count,
        v.metadata.duration_seconds,
        v.metadata.tags.join('; '),
        (v.analysis?.keywords ?? v.metadata.keywords).join('; '),
        v.analysis?.summary,
        v.analysis?.topics.join('; '),
        v.analysis?.hook,
        v.analysis?.language,
        v.transcript_available ? 'sí' : 'no',
      ]);
      downloadFile(`${base}-videos-${isoDay()}.csv`, toCsv(headers, rows));
    }
    toast.success(`${videos.length} videos descargados`);
  });

  const exportAnalytics = useAction(async () => {
    const { data } = await api.youtubeChannelAnalytics({
      accountId: channel.connection!.accountId,
      startDate: isoDay(-days),
      endDate: isoDay(-1),
      metrics: ALL_METRICS,
    });
    const { rows, metrics } = data.analytics;
    if (!rows.length) return toast.info('YouTube no devolvió datos para ese periodo');
    downloadFile(`${base}-analiticas-${days}d-${isoDay()}.csv`, toCsv(['fecha', ...metrics.map((m) => METRIC_LABELS[m] ?? m)], rows));
    toast.success(`${rows.length} días de analíticas descargados`);
  });

  const canAnalytics = Boolean(channel.connection?.hasAnalytics);

  return (
    <div className="stack-lg">
      <Card title="Videos y análisis">
        <div className="stack">
          <p className="small muted">
            Todos los videos extraídos de este canal con sus métricas, resumen, temas y palabras clave.
          </p>
          <div className="row">
            <Button icon="extract" loading={exportVideos.loading} onClick={() => void exportVideos.run('csv')}>
              Descargar CSV
            </Button>
            <Button variant="ghost" loading={exportVideos.loading} onClick={() => void exportVideos.run('json')}>
              JSON completo
            </Button>
          </div>
          <ErrorBox message={exportVideos.error} />
        </div>
      </Card>

      <Card title="Analíticas de YouTube">
        <div className="stack">
          {canAnalytics ? (
            <>
              <p className="small muted">
                Datos diarios del canal: vistas, minutos vistos, duración media, suscriptores, me gusta, comentarios y compartidos.
              </p>
              <div className="row">
                <div className="seg" role="radiogroup" aria-label="Periodo">
                  {RANGES.map((d) => (
                    <button key={d} role="radio" aria-checked={days === d} className="seg-item" onClick={() => setDays(d)}>
                      {d === 365 ? '1 año' : `${d} días`}
                    </button>
                  ))}
                </div>
                <Button variant="primary" icon="extract" loading={exportAnalytics.loading} onClick={() => void exportAnalytics.run()}>
                  Descargar CSV
                </Button>
              </div>
              <ErrorBox message={exportAnalytics.error} />
            </>
          ) : (
            <p className="small muted">
              Conecta este canal con Google (pestaña Resumen) para descargar sus analíticas de YouTube.
            </p>
          )}
        </div>
      </Card>

      {canAnalytics && <ReportsCard channel={channel} />}
    </div>
  );
}
