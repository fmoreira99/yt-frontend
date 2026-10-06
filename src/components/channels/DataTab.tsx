'use client';

import { api } from '@/lib/api';
import { slug, toCsv, downloadFile } from '@/lib/csv';
import { useAction } from '@/lib/hooks';
import { isoDay } from '@/lib/format';
import { fetchAllVideos } from '@/lib/videos';
import { Button, Card, ErrorBox } from '../ui';
import { useToast } from '../Toast';
import type { TabProps } from './ChannelDrawer';
import { AnalyticsCard } from './AnalyticsCard';
import { ReportsCard } from './ReportsCard';

export function DataTab({ channel }: TabProps) {
  const toast = useToast();
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

      {canAnalytics ? (
        <AnalyticsCard channel={channel} />
      ) : (
        <Card title="Analíticas de YouTube">
          <p className="small muted">Conecta este canal con Google (pestaña Resumen) para descargar sus analíticas de YouTube.</p>
        </Card>
      )}

      {canAnalytics && <ReportsCard channel={channel} />}
    </div>
  );
}
