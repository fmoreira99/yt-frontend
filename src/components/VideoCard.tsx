import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatCompact, formatDate, formatDuration, formatRelative } from '@/lib/format';
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
  /** Casilla para seleccionar el video (acciones en lote). */
  select?: { checked: boolean; onChange: (checked: boolean) => void };
  /** Acciones de la tarjeta (alineadas a la derecha). */
  footer?: ReactNode;
}) {
  const when = extractedAt
    ? { text: `Extraído ${formatRelative(extractedAt)}`, full: formatDate(extractedAt) }
    : metadata.published_at
      ? { text: formatDate(metadata.published_at), full: undefined }
      : null;
  const warnings = [!analysis && 'Sin análisis IA', transcriptAvailable === false && 'Sin guion'].filter(Boolean) as string[];

  return (
    <article className={`vcard${select?.checked ? ' vcard-selected' : ''}`}>
      <div className="vcard-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={metadata.thumbnail_url ?? ''} alt="" loading="lazy" />
        {metadata.duration_seconds != null && <span className="vcard-duration">{formatDuration(metadata.duration_seconds)}</span>}
        {select && (
          <input
            type="checkbox"
            className="vcard-check"
            checked={select.checked}
            onChange={(e) => select.onChange(e.target.checked)}
            aria-label={`Seleccionar ${metadata.title}`}
          />
        )}
      </div>

      <div className="vcard-body">
        <Link href={`/results/${metadata.video_id}`} className="vcard-title">
          {metadata.title}
        </Link>
        <div className="vcard-meta">
          {metadata.channel_title && <span className="vcard-channel">{metadata.channel_title}</span>}
          {metadata.view_count != null && <span>{formatCompact(metadata.view_count)} vistas</span>}
          {when && <span title={when.full}>{when.text}</span>}
        </div>

        {analysis && (
          <>
            <p className="vcard-summary">{analysis.summary}</p>
            {analysis.hook && <p className="vcard-hook">“{analysis.hook}”</p>}
            <Chips items={analysis.topics} max={4} />
          </>
        )}

        {(warnings.length > 0 || footer) && (
          <div className="vcard-footer">
            <div className="row" style={{ gap: 8 }}>
              {warnings.map((w) => (
                <Badge key={w} tone="warning">
                  {w}
                </Badge>
              ))}
              {!analysis && analysisError && <span className="small muted">{analysisError}</span>}
            </div>
            {footer && <div className="vcard-actions">{footer}</div>}
          </div>
        )}
      </div>
    </article>
  );
}
