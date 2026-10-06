'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { Icon } from '@/components/Icon';
import { Button, Card, Empty, ErrorBox, PageHeader, Pager, Spinner } from '@/components/ui';
import { LinkVideoButton } from '@/components/LinkVideoButton';
import { useToast } from '@/components/Toast';
import { VideoCard } from '@/components/VideoCard';

const LIMIT = 20;
const CHANNEL_ID = /^UC[\w-]{22}$/;

export default function ResultsPage() {
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [channel, setChannel] = useState('');
  const [applied, setApplied] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const results = useQuery(() => api.listResults({ limit: LIMIT, offset, channel_id: applied || undefined }), [offset, applied]);
  const analyze = useAction(api.analyzePending);

  async function runAnalysis() {
    const summary = await analyze.run({ limit: 10, channel_id: applied || undefined });
    if (summary) void results.reload();
  }

  const rows = results.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.video_id));
  const invalidChannel = channel !== '' && !CHANNEL_ID.test(channel);

  const remove = useAction(async (ids: string[]) => {
    const what = ids.length === 1 ? 'este video' : `${ids.length} videos`;
    if (!window.confirm(`¿Eliminar ${what}?\n\nSe borran su extracción, guion y análisis, y los vínculos a tus canales. Podrás volver a extraerlo.`)) return;

    const failed: string[] = [];
    for (let i = 0; i < ids.length; i += 3) {
      const batch = ids.slice(i, i + 3);
      const done = await Promise.allSettled(batch.map((id) => api.deleteResult(id)));
      done.forEach((d, n) => d.status === 'rejected' && failed.push(batch[n]));
    }
    const ok = ids.length - failed.length;
    if (ok) toast.success(ok === 1 ? 'Video eliminado' : `${ok} videos eliminados`);
    if (failed.length) toast.error(`No se pudieron eliminar ${failed.length} video(s)`);
    setSelected(new Set(failed));
    if (ok === rows.length && offset > 0) setOffset(Math.max(0, offset - LIMIT));
    else void results.reload();
  });

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function applyFilter(value: string) {
    setOffset(0);
    setSelected(new Set());
    setApplied(value);
  }

  return (
    <>
      <PageHeader title="Resultados" description="Videos ya extraídos, del más reciente al más antiguo." />

      <div className="stack">
        <div className="toolbar">
          <form
            className="row"
            style={{ gap: 8, flexWrap: 'nowrap', flex: '1 1 320px', maxWidth: 440 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!invalidChannel) applyFilter(channel);
            }}
          >
            <div className="search">
              <Icon name="search" size={16} />
              <input
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value.trim())}
                placeholder="Filtrar por ID de canal (UC…)"
                aria-label="Filtrar por ID de canal"
                aria-invalid={invalidChannel}
              />
            </div>
            <Button type="submit" disabled={invalidChannel || channel === applied}>
              Filtrar
            </Button>
          </form>
          <Button icon="sparkles" loading={analyze.loading} onClick={runAnalysis}>
            Analizar pendientes
          </Button>
        </div>
        {invalidChannel && <p className="small" style={{ color: 'var(--danger-fg)' }}>Formato: UC seguido de 22 caracteres.</p>}
        {applied && (
          <div className="row" style={{ gap: 8 }}>
            <span className="small muted">Filtrando por</span>
            <span className="chip-filter">
              <span className="mono">{applied}</span>
              <button type="button" aria-label="Quitar filtro" onClick={() => (setChannel(''), applyFilter(''))}>
                <Icon name="x" size={14} />
              </button>
            </span>
          </div>
        )}

        {analyze.result && (
          <div className="alert alert-success">
            {analyze.result.analyzed.length} analizados
            {analyze.result.failed.length > 0 && `, ${analyze.result.failed.length} fallidos`}
            {analyze.result.has_more && ' · quedan más pendientes: vuelve a ejecutarlo'}.
          </div>
        )}
        <ErrorBox message={analyze.error} />
        <ErrorBox message={remove.error} />
      </div>

      {results.loading && <Spinner label="Cargando…" />}
      <ErrorBox message={results.error} onRetry={results.reload} />

      {results.data && (
        <div className={`stack${selected.size > 0 ? ' list-selecting' : ''}`}>
          {rows.length === 0 && (
            <Card>
              <Empty icon="list" title="No hay resultados">
                Todavía no se extrajo ningún video {applied && 'de este canal'}.
              </Empty>
            </Card>
          )}

          {rows.length > 0 &&
            (selected.size > 0 ? (
              <div className="selbar" role="region" aria-label="Acciones sobre la selección">
                <span>
                  <strong>{selected.size}</strong> {selected.size === 1 ? 'seleccionado' : 'seleccionados'}
                </span>
                <div className="selbar-actions">
                  <LinkVideoButton videoIds={[...selected]} label="Vincular a canal" />
                  <Button size="sm" variant="danger" icon="trash" loading={remove.loading} onClick={() => void remove.run([...selected])}>
                    Eliminar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="row-between">
                <label className="check">
                  <input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.video_id)) : new Set())} />
                  Seleccionar todos
                </label>
                <span className="small muted">
                  {rows.length} {rows.length === 1 ? 'video' : 'videos'}
                  {offset > 0 && ` · desde el ${offset + 1}`}
                </span>
              </div>
            ))}

          {rows.map((r) => (
            <VideoCard
              key={r.video_id}
              metadata={r.metadata}
              analysis={r.analysis}
              extractedAt={r.extracted_at}
              transcriptAvailable={r.transcript_available}
              select={{ checked: selected.has(r.video_id), onChange: (on) => toggle(r.video_id, on) }}
              footer={
                <>
                  <LinkVideoButton videoIds={[r.video_id]} />
                  <Button
                    size="sm"
                    variant="ghost-danger"
                    icon="trash"
                    aria-label="Eliminar video"
                    title="Eliminar"
                    disabled={remove.loading}
                    onClick={() => void remove.run([r.video_id])}
                  />
                </>
              }
            />
          ))}
          <Pager offset={offset} limit={LIMIT} count={rows.length} onChange={(o) => (setSelected(new Set()), setOffset(o))} />
        </div>
      )}
    </>
  );
}
