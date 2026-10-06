import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatDate, formatDuration, formatNumber } from '@/lib/format';
import type { VideoAnalysis, VideoMetadata } from '@/lib/types';
import { Badge, Chips } from './ui';

export function VideoCard({
  metadata,
  analysis,
  analysisError,
  extractedAt,
  transcriptAvailable,
  select,
  footer,
}: {
  metadata: VideoMetadata;
  analysis: VideoAnalysis | null;
  analysisError?: string;
  extractedAt?: string;
  transcriptAvailable?: boolean;
  /** Casilla para seleccionar el video (borrado en lote). */
  select?: { checked: boolean; onChange: (checked: boolean) => void };
  footer?: ReactNode;
}) {
  const stats = [
    metadata.channel_title,
    metadata.view_count != null && `${formatNumber(metadata.view_count)} vistas`,
    metadata.duration_seconds != null && formatDuration(metadata.duration_seconds),
    extractedAt ? `Extraído ${formatDate(extractedAt)}` : metadata.published_at && formatDate(metadata.published_at),
  ].filter(Boolean);

  return (
    <article className="card card-flush video-card">
      <div className="thumb-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="thumb" src={metadata.thumbnail_url ?? ''} alt="" loading="lazy" />
        {select && (
          <input
            type="checkbox"
            className="thumb-select"
            checked={select.checked}
            onChange={(e) => select.onChange(e.target.checked)}
            aria-label={`Seleccionar ${metadata.title}`}
          />
        )}
      </div>
      <div className="stack-sm" style={{ minWidth: 0 }}>
        <Link href={`/results/${metadata.video_id}`} className="title">
          {metadata.title}
        </Link>
        <div className="muted small">{stats.join(' · ')}</div>
        {analysis ? (
          <>
            <p className="soft">{analysis.summary}</p>
            {analysis.hook && <p className="small muted">Gancho: “{analysis.hook}”</p>}
            <Chips items={analysis.topics} max={5} />
          </>
        ) : (
          <div className="row">
            <Badge tone="warning">Sin análisis IA</Badge>
            {analysisError && <span className="small muted">{analysisError}</span>}
          </div>
        )}
        {transcriptAvailable === false && <Badge tone="warning">Sin guion</Badge>}
        {footer && (
          <div className="row" style={{ gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </article>
  );
}
