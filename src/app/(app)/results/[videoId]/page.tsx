'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { formatDate, formatDuration, formatNumber } from '@/lib/format';
import { Badge, Button, Card, Chips, CopyButton, ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { LinkVideoButton } from '@/components/LinkVideoButton';
import { useToast } from '@/components/Toast';

export default function ResultDetailPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = use(params);
  const query = useQuery(() => api.getResult(videoId), [videoId]);
  const analyze = useAction(api.analyzePending);
  const router = useRouter();
  const toast = useToast();
  const remove = useAction(async () => {
    if (!window.confirm('¿Eliminar este video?\n\nSe borran su extracción, guion y análisis, y los vínculos a tus canales. Podrás volver a extraerlo.')) return;
    await api.deleteResult(videoId);
    toast.success('Video eliminado');
    router.push('/results');
  });
  const r = query.data?.data;

  return (
    <>
      <Link href="/results" className="small">← Resultados</Link>
      {query.loading && <Spinner label="Cargando…" />}
      <ErrorBox message={query.error} onRetry={query.reload} />

      {r && (
        <>
          <PageHeader
            title={r.metadata.title}
            description={[r.metadata.channel_title, formatDate(r.metadata.published_at)].filter((x) => x !== '—').join(' · ')}
            actions={
              <>
                <LinkVideoButton videoId={videoId} />
                <a href={r.metadata.url} target="_blank" rel="noreferrer">
                  <Button icon="external">Ver en YouTube</Button>
                </a>
                <Button variant="danger" icon="trash" loading={remove.loading} onClick={() => void remove.run()}>
                  Eliminar
                </Button>
              </>
            }
          />
          <ErrorBox message={remove.error} />

          <div className="grid">
            <Card><div className="muted small">Vistas</div><div className="stat-value">{formatNumber(r.metadata.view_count)}</div></Card>
            <Card><div className="muted small">Me gusta</div><div className="stat-value">{formatNumber(r.metadata.like_count)}</div></Card>
            <Card><div className="muted small">Duración</div><div className="stat-value">{formatDuration(r.metadata.duration_seconds)}</div></Card>
            <Card><div className="muted small">Guion</div><div className="stat-value" style={{ fontSize: 16 }}>{r.transcript_available ? `${formatNumber(r.transcript_chars)} car.` : 'No disponible'}</div></Card>
          </div>

          <Card
            title="Análisis IA"
            actions={
              !r.analysis && (
                <Button size="sm" icon="sparkles" loading={analyze.loading} onClick={async () => (await analyze.run({ video_ids: [videoId] })) && query.reload()}>
                  Analizar ahora
                </Button>
              )
            }
          >
            <ErrorBox message={analyze.error} />
            {r.analysis ? (
              <div className="stack">
                <p>{r.analysis.summary}</p>
                {r.analysis.hook && <p className="soft"><strong>Gancho:</strong> {r.analysis.hook}</p>}
                <div className="stack-sm"><span className="label">Temas</span><Chips items={r.analysis.topics} /></div>
                <div className="stack-sm"><span className="label">Keywords</span><Chips items={r.analysis.keywords} max={20} /></div>
                <div className="stack-sm"><span className="label">Hashtags</span><Chips items={r.analysis.hashtags} /></div>
                <div className="small muted">Generado con {r.analysis.provider}{r.analysis.model && ` · ${r.analysis.model}`}{r.analysis.language && ` · idioma: ${r.analysis.language}`}</div>
              </div>
            ) : (
              <p className="muted">Este video todavía no tiene análisis.</p>
            )}
          </Card>

          <Card title="Metadata">
            <div className="stack">
              {r.metadata.description && <p className="soft" style={{ whiteSpace: 'pre-wrap', maxWidth: '72ch' }}>{r.metadata.description}</p>}
              <div className="stack-sm"><span className="label">Tags</span><Chips items={r.metadata.tags} max={25} /></div>
              <Badge>Fuente: {r.metadata.source === 'youtube_api' ? 'YouTube API' : 'oEmbed (limitada)'}</Badge>
            </div>
          </Card>

          <Card title="Guion" actions={r.transcript && <CopyButton text={r.transcript} />}>
            {r.transcript ? (
              <pre style={{ maxHeight: 480 }}>{r.transcript}</pre>
            ) : (
              <p className="muted">No hay guion disponible para este video.</p>
            )}
            {r.transcript_source && <p className="small muted" style={{ marginTop: 12 }}>Origen: {r.transcript_source}</p>}
          </Card>
        </>
      )}
    </>
  );
}
