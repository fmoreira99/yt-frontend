'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Channel } from '@/lib/channels';
import { formatDate, formatDuration, formatRelative } from '@/lib/format';
import { useAction, useQuery } from '@/lib/hooks';
import type { InspirationItem } from '@/lib/types';
import { Badge, Button, Card, Chips, CopyButton, Empty, ErrorBox, Pager, Spinner } from '../ui';
import { useToast } from '../Toast';

type State = 'pending' | 'used' | 'all';
const PAGE = 10;

function QueueItem({ item, position, targetId, onChanged }: { item: InspirationItem; position: number; targetId: string; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState<string | null>(null);

  const loadScript = useAction(async () => {
    const { data } = await api.getResult(item.video_id);
    setScript(data.transcript ?? '');
  });
  const toggleUsed = useAction(async () => {
    await api.setInspirationUsed(targetId, item.video_id, !item.used);
    toast.success(item.used ? 'Devuelto a la cola' : 'Marcado como usado');
    onChanged();
  });
  const unlinkVideo = useAction(async () => {
    await api.unlink(targetId, 'video', item.video_id);
    toast.info('Video quitado de la cola');
    onChanged();
  });

  const { metadata, analysis } = item;
  const meta = [
    metadata.channel_title,
    item.source === 'video' && 'video suelto',
    metadata.duration_seconds != null && formatDuration(metadata.duration_seconds),
  ].filter(Boolean);

  return (
    <li className="queue-item">
      <span className="queue-pos" aria-label={`Posición ${position}`}>
        {position}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={metadata.thumbnail_url ?? ''} alt="" loading="lazy" />
      <div className="stack-sm" style={{ minWidth: 0 }}>
        <Link href={`/results/${item.video_id}`} className="video-row-title">
          {metadata.title}
        </Link>
        <div className="small muted">
          {meta.join(' · ')} ·{' '}
          <span title={formatDate(item.first_extracted_at)}>monitoreado {formatRelative(item.first_extracted_at)}</span>
        </div>
        {analysis ? (
          <>
            <p className="small soft">{analysis.summary}</p>
            {analysis.hook && <p className="small muted">Gancho: “{analysis.hook}”</p>}
            <Chips items={analysis.topics} max={4} />
          </>
        ) : (
          <Badge tone="warning">Sin análisis IA</Badge>
        )}

        <div className="row" style={{ gap: 8 }}>
          {item.transcript_available ? (
            <Button
              size="sm"
              variant="secondary"
              loading={loadScript.loading}
              onClick={() => {
                setOpen((v) => !v);
                if (script === null) void loadScript.run();
              }}
            >
              {open ? 'Ocultar guion' : 'Ver guion'}
            </Button>
          ) : (
            <Badge tone="warning">Sin guion</Badge>
          )}
          {open && script && <CopyButton text={script} label="Copiar guion" />}
          <Button size="sm" variant={item.used ? 'ghost' : 'primary'} icon="check" loading={toggleUsed.loading} onClick={() => void toggleUsed.run()}>
            {item.used ? 'Volver a la cola' : 'Marcar como usado'}
          </Button>
          {item.source === 'video' && (
            <Button size="sm" variant="ghost" loading={unlinkVideo.loading} onClick={() => void unlinkVideo.run()}>
              Quitar
            </Button>
          )}
        </div>
        <ErrorBox message={loadScript.error ?? toggleUsed.error ?? unlinkVideo.error} />
        {open && script !== null && (script ? <pre style={{ maxHeight: 320 }}>{script}</pre> : <p className="small muted">Este video no tiene guion guardado.</p>)}
      </div>
    </li>
  );
}

/** Guiones de los canales que inspiran a este canal, en cola: el primero que se monitoreó es el primero en salir. */
export function InspirationTab({ channel, channels }: { channel: Channel; channels: Channel[] }) {
  const toast = useToast();
  const [state, setState] = useState<State>('pending');
  const [offset, setOffset] = useState(0);
  const [pick, setPick] = useState('');

  const links = useQuery(() => api.listLinks(channel.id), [channel.id]);
  const queue = useQuery(() => api.inspiration({ target: channel.id, state, limit: PAGE, offset }), [channel.id, state, offset]);

  const sources = (links.data?.data ?? []).filter((l) => l.kind === 'channel');
  const linked = new Set(sources.map((l) => l.ref_id));
  const nameOf = (id: string) => channels.find((c) => c.id === id)?.name ?? id;
  const options = channels.filter((c) => c.id !== channel.id && !linked.has(c.id));
  const standalone = (links.data?.data ?? []).filter((l) => l.kind === 'video').length;

  const refresh = () => {
    void links.reload();
    void queue.reload();
  };

  const addSource = useAction(async () => {
    await api.link(channel.id, 'channel', pick);
    toast.success(`Ahora te inspira ${nameOf(pick)}`);
    setPick('');
    refresh();
  });
  const removeSource = useAction(async (id: string) => {
    if (!window.confirm(`¿Dejar de usar «${nameOf(id)}» como inspiración de «${channel.name}»?\n\nSus videos siguen guardados; solo salen de esta cola.`)) return;
    await api.unlink(channel.id, 'channel', id);
    toast.info('Vínculo quitado');
    refresh();
  });

  const counts = queue.data?.counts;
  const noSources = links.data && sources.length === 0 && standalone === 0;

  return (
    <div className="stack-lg">
      <Card title="Canales que te inspiran">
        <div className="stack">
          <p className="small muted">
            Vincula uno o varios canales que monitoreas: sus videos y guiones llegan a la cola de inspiración de «{channel.name}». Es opcional y puedes
            cambiarlo cuando quieras.
          </p>
          {links.loading && !links.data && <Spinner label="Cargando vínculos…" />}
          <ErrorBox message={links.error} onRetry={links.reload} />
          {sources.length > 0 && (
            <ul className="history">
              {sources.map((l) => (
                <li key={l.id}>
                  <span style={{ flex: 1, minWidth: 0 }} className="truncate">
                    {nameOf(l.ref_id)}
                  </span>
                  <Button size="sm" variant="ghost" disabled={removeSource.loading} onClick={() => void removeSource.run(l.ref_id)}>
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {standalone > 0 && <p className="small muted">Además, {standalone} video(s) suelto(s) vinculados desde Extraer o Resultados.</p>}

          {options.length > 0 ? (
            <div className="row">
              <select className="select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Canal a vincular" style={{ flex: '1 1 200px' }}>
                <option value="">Elige un canal…</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button variant="primary" disabled={!pick} loading={addSource.loading} onClick={() => void addSource.run()}>
                Vincular
              </Button>
            </div>
          ) : (
            <p className="small muted">No hay más canales para vincular. Añade primero el canal que te inspira con «Añadir canal».</p>
          )}
          <ErrorBox message={addSource.error ?? removeSource.error} />
        </div>
      </Card>

      <Card title="Cola de inspiración">
        <div className="stack">
          <p className="small muted">Del primero que monitoreaste al más reciente: arriba, lo siguiente para inspirarte.</p>

          {noSources ? (
            <Empty icon="sparkles" title="Todavía no hay nada vinculado">
              Vincula un canal arriba o usa «Vincular a canal» en Resultados para que sus guiones aparezcan aquí.
            </Empty>
          ) : (
            <>
              <div className="seg" role="radiogroup" aria-label="Estado">
                {(
                  [
                    ['pending', 'Pendientes', counts?.pending],
                    ['used', 'Usados', counts?.used],
                    ['all', 'Todos', counts ? counts.pending + counts.used : undefined],
                  ] as const
                ).map(([id, label, n]) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={state === id}
                    className="seg-item"
                    onClick={() => {
                      setState(id);
                      setOffset(0);
                    }}
                  >
                    {label}
                    {n !== undefined && <span className="seg-count">{n}</span>}
                  </button>
                ))}
              </div>

              {queue.loading && !queue.data && <Spinner label="Cargando la cola…" />}
              <ErrorBox message={queue.error} onRetry={queue.reload} />
              {queue.data && queue.data.data.length === 0 && (
                <Empty icon="list" title={state === 'used' ? 'Aún no marcaste ninguno como usado' : state === 'pending' ? 'No hay nada pendiente' : 'Aún no hay videos'}>
                  {state === 'pending' && (counts?.used ?? 0) > 0
                    ? 'Ya usaste todo lo que había. Cuando se monitoreen videos nuevos aparecerán aquí.'
                    : 'Cuando se extraigan videos de los canales vinculados aparecerán aquí, ordenados por fecha de monitoreo.'}
                </Empty>
              )}
              {queue.data && queue.data.data.length > 0 && (
                <ol className="queue">
                  {queue.data.data.map((item, i) => (
                    <QueueItem key={item.video_id} item={item} position={offset + i + 1} targetId={channel.id} onChanged={refresh} />
                  ))}
                </ol>
              )}
              {queue.data && (queue.data.pagination.total > PAGE || offset > 0) && (
                <Pager offset={offset} limit={PAGE} count={queue.data.data.length} onChange={setOffset} />
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
