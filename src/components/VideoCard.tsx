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
}: {
  metadata: VideoMetadata;
  analysis: VideoAnalysis | null;
  analysisError?: string;
  extractedAt?: string;
  transcriptAvailable?: boolean;
}) {
  const stats = [
    metadata.channel_title,
    metadata.view_count != null && `${formatNumber(metadata.view_count)} vistas`,
    metadata.duration_seconds != null && formatDuration(metadata.duration_seconds),
    extractedAt ? `Extraído ${formatDate(extractedAt)}` : metadata.published_at && formatDate(metadata.published_at),
  ].filter(Boolean);

  return (
    <article className="card card-flush video-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="thumb" src={metadata.thumbnail_url ?? ''} alt="" loading="lazy" />
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
      </div>
    </article>
  );
}
