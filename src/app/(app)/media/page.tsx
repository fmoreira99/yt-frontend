'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { Badge, Button, Card, CopyButton, Empty, ErrorBox, Field, PageHeader, Spinner, StatusBadge, Tabs } from '@/components/ui';
import type { GenerateResponse, MediaItem } from '@/lib/types';

const TYPES = [
  { value: 'all', label: 'Todo' },
  { value: 'image', label: 'Imágenes' },
  { value: 'video', label: 'Video' },
  { value: 'gif', label: 'GIFs' },
  { value: 'icon', label: 'Iconos' },
];

function MediaCard({ item }: { item: MediaItem }) {
  return (
    <article className={`card media-card ${item.type === 'icon' ? 'icon' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumbnail_url || item.preview_url} alt={item.title} loading="lazy" />
      <div className="body">
        <div className="truncate" style={{ fontWeight: 600 }} title={item.title}>{item.title || 'Sin título'}</div>
        <div className="small muted truncate">{item.author.name} · {item.provider}</div>
        <div className="row" style={{ gap: 4 }}>
          <Badge>{item.type}</Badge>
          <span className="small muted truncate" title={item.license}>{item.license}</span>
        </div>
        <div className="row" style={{ gap: 0 }}>
          <a href={item.source_url} target="_blank" rel="noreferrer" className="small">Origen</a>
          <CopyButton text={item.full_url} label="URL" />
          {item.attribution && <CopyButton text={item.attribution} label="Atribución" />}
        </div>
      </div>
    </article>
  );
}

function SearchTab() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const search = useAction(api.mediaSearch);
  const data = search.result;

  const run = (nextPage: number) => {
    setPage(nextPage);
    return search.run({ q: q.trim(), type, provider: 'auto', page: nextPage, limit: 12 });
  };

  return (
    <div className="stack-lg">
      <Card className="card-accent">
        <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); void run(1); }}>
          <div style={{ flex: '1 1 260px' }}>
            <Field label="Buscar"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="montañas al amanecer" /></Field>
          </div>
          <div style={{ width: 160 }}>
            <Field label="Tipo">
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>
          <Button type="submit" variant="primary" icon="search" loading={search.loading} disabled={!q.trim()}>Buscar</Button>
        </form>
      </Card>

      <ErrorBox message={search.error} />
      {data && (
        <div className="stack">
          <div className="row">
            <span className="muted small">{data.total_results} resultados · página {data.page}</span>
            {Object.entries(data.providers).map(([id, status]) => (
              <span key={id} className="row" style={{ gap: 4 }}><span className="small muted">{id}</span><StatusBadge status={status} /></span>
            ))}
          </div>
          {data.data.length === 0 ? (
            <Card><Empty icon="image" title="Sin resultados">Prueba con otros términos o cambia el tipo de medio.</Empty></Card>
          ) : (
            <div className="media-grid">{data.data.map((item) => <MediaCard key={`${item.provider}-${item.id}`} item={item} />)}</div>
          )}
          <div className="row">
            <Button size="sm" disabled={page <= 1 || search.loading} onClick={() => run(page - 1)}>Anterior</Button>
            <Button size="sm" disabled={data.data.length === 0 || search.loading} onClick={() => run(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function GenerateTab() {
  const [task, setTask] = useState<'ai_text' | 'ai_image'>('ai_text');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState('0.7');
  const generate = useAction(api.mediaGenerate);
  const out: GenerateResponse | null = generate.result;

  return (
    <div className="stack-lg">
      <Card className="card-accent">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void generate.run({ task, provider: 'auto', prompt: prompt.trim(), options: { temperature: Number(temperature) } });
          }}
        >
          <div className="form-grid">
            <Field label="Tarea">
              <select className="select" value={task} onChange={(e) => setTask(e.target.value as typeof task)}>
                <option value="ai_text">Texto</option>
                <option value="ai_image">Imagen</option>
              </select>
            </Field>
            {task === 'ai_text' && (
              <Field label="Creatividad" hint="0 = preciso, 2 = creativo">
                <input className="input" type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(e.target.value)} />
              </Field>
            )}
          </div>
          <Field label="Prompt" hint={`${prompt.length}/4000`}>
            <textarea className="textarea" maxLength={4000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Escribe un guion corto sobre…" />
          </Field>
          <div className="row">
            <Button type="submit" variant="primary" icon="sparkles" loading={generate.loading} disabled={!prompt.trim()}>Generar</Button>
            {generate.loading && <span className="muted small">Las imágenes pueden tardar hasta un minuto.</span>}
          </div>
        </form>
      </Card>

      <ErrorBox message={generate.error} />
      {out && (
        <Card title="Resultado" actions={<Badge tone="primary">{out.provider}</Badge>}>
          {'content' in out.result ? (
            <div className="stack">
              <p style={{ whiteSpace: 'pre-wrap', maxWidth: '72ch' }}>{out.result.content}</p>
              <div className="row-between">
                <span className="small muted">{out.result.model}</span>
                <CopyButton text={out.result.content} />
              </div>
            </div>
          ) : (
            <div className="stack">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={out.result.url} alt={prompt} style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)' }} />
              <div className="row-between">
                <span className="small muted">{out.result.model} · el enlace caduca en {Math.round(out.result.expires_in / 60)} min</span>
                <a href={out.result.url} target="_blank" rel="noreferrer">Abrir</a>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ProvidersTab() {
  const providers = useQuery(() => api.mediaProviders());
  const list = providers.data?.data.providers ?? [];
  return (
    <Card title="Proveedores" actions={<Button size="sm" variant="ghost" icon="refresh" onClick={providers.reload}>Actualizar</Button>}>
      {providers.loading && !providers.data && <Spinner label="Cargando…" />}
      <ErrorBox message={providers.error} onRetry={providers.reload} />
      {list.length > 0 && (
        <div className="table-wrap" style={{ margin: '0 -24px -24px' }}>
          <table>
            <thead><tr><th>Proveedor</th><th>Categoría</th><th>Estado</th><th className="right">Cupo restante</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><span style={{ fontWeight: 600 }}>{p.name}</span> <span className="small muted mono">{p.id}</span></td>
                  <td>{p.category}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="right">{p.rate_limit_remaining ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function MediaPage() {
  const [tab, setTab] = useState<'search' | 'generate' | 'providers'>('search');
  return (
    <>
      <PageHeader title="Media Hub" description="Busca imágenes, video, GIFs e iconos de varios proveedores y genera texto o imágenes con IA." />
      <Tabs
        tabs={[{ id: 'search', label: 'Buscar' }, { id: 'generate', label: 'Generar con IA' }, { id: 'providers', label: 'Proveedores' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'search' ? <SearchTab /> : tab === 'generate' ? <GenerateTab /> : <ProvidersTab />}
    </>
  );
}
