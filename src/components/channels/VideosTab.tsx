'use client';

import Link from 'next/link';
import { formatCompact, formatDate, formatDuration } from '@/lib/format';
import { Badge, Empty } from '../ui';
import type { TabProps } from './ChannelDrawer';

export function VideosTab({ channel, videos }: TabProps) {
  if (videos.length === 0) {
    return (
      <Empty icon="extract" title="Aún no hay videos de este canal">
        {channel.monitor?.active
          ? 'El primer escaneo está en marcha o se hará en la próxima ejecución programada.'
          : 'Activa el monitoreo o usa “Escanear” para extraer sus últimos videos.'}
      </Empty>
    );
  }

  const sorted = [...videos].sort((a, b) => (b.metadata.published_at ?? '').localeCompare(a.metadata.published_at ?? ''));
  return (
    <div className="stack-sm">
      {sorted.map((v) => (
        <Link key={v.video_id} href={`/results/${v.video_id}`} className="video-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v.metadata.thumbnail_url ?? ''} alt="" loading="lazy" />
          <div style={{ minWidth: 0 }}>
            <div className="video-row-title">{v.metadata.title}</div>
            <div className="small muted">
              {[formatDate(v.metadata.published_at), `${formatCompact(v.metadata.view_count)} vistas`, formatDuration(v.metadata.duration_seconds)].join(' · ')}
            </div>
            {v.analysis ? (
              <div className="small soft video-row-summary">{v.analysis.summary}</div>
            ) : (
              <Badge tone="warning">Sin análisis IA</Badge>
            )}
          </div>
        </Link>
      ))}
      <p className="small muted">Se muestran los videos más recientes guardados. Usa “Datos” para descargarlos todos.</p>
    </div>
  );
}
