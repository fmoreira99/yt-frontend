'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { Button, Card, Empty, ErrorBox, Field, PageHeader, Pager, Spinner } from '@/components/ui';
import { VideoCard } from '@/components/VideoCard';

const LIMIT = 20;

export default function ResultsPage() {
  const [offset, setOffset] = useState(0);
  const [channel, setChannel] = useState('');
  const [applied, setApplied] = useState('');
  const results = useQuery(() => api.listResults({ limit: LIMIT, offset, channel_id: applied || undefined }), [offset, applied]);
  const analyze = useAction(api.analyzePending);

  async function runAnalysis() {
    const summary = await analyze.run({ limit: 10, channel_id: applied || undefined });
    if (summary) void results.reload();
  }

  const invalidChannel = channel !== '' && !/^UC[\w-]{22}$/.test(channel);

  return (
    <>
      <PageHeader
        title="Resultados"
        description="Videos ya extraídos, del más reciente al más antiguo."
        actions={
          <Button icon="sparkles" loading={analyze.loading} onClick={runAnalysis}>
            Analizar pendientes
          </Button>
        }
      />

      {analyze.result && (
        <div className="alert alert-success">
          {analyze.result.analyzed.length} analizados
          {analyze.result.failed.length > 0 && `, ${analyze.result.failed.length} fallidos`}
          {analyze.result.has_more && ' · quedan más pendientes: vuelve a ejecutarlo'}.
        </div>
      )}
      <ErrorBox message={analyze.error} />

      <Card>
        <form
          className="row"
          style={{ alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setApplied(channel);
          }}
        >
          <div style={{ flex: '1 1 280px' }}>
            <Field label="Filtrar por ID de canal" hint={invalidChannel ? 'Formato: UC seguido de 22 caracteres' : undefined}>
              <input className="input" value={channel} onChange={(e) => setChannel(e.target.value.trim())} placeholder="UCxxxxxxxxxxxxxxxxxxxxxx" />
            </Field>
          </div>
          <Button type="submit" disabled={invalidChannel}>
            Filtrar
          </Button>
        </form>
      </Card>

      {results.loading && <Spinner label="Cargando…" />}
      <ErrorBox message={results.error} onRetry={results.reload} />
      {results.data && (
        <div className="stack">
          {results.data.data.length === 0 && (
            <Card>
              <Empty icon="list" title="No hay resultados">
                Todavía no se extrajo ningún video {applied && 'de este canal'}.
              </Empty>
            </Card>
          )}
          {results.data.data.map((r) => (
            <VideoCard key={r.video_id} metadata={r.metadata} analysis={r.analysis} extractedAt={r.extracted_at} transcriptAvailable={r.transcript_available} />
          ))}
          <Pager offset={offset} limit={LIMIT} count={results.data.data.length} onChange={setOffset} />
        </div>
      )}
    </>
  );
}
