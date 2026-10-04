'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, uploadYoutubeVideo } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { formatDate, formatNumber } from '@/lib/format';
import { Badge, Button, Card, Empty, ErrorBox, Field, PageHeader, Spinner, Tabs } from '@/components/ui';
import type { YoutubeAccount } from '@/lib/types';

type Tab = 'accounts' | 'upload' | 'stats' | 'analytics';

const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Extrae el ID de 11 caracteres de una URL o devuelve el texto tal cual. */
function videoIdFrom(input: string): string {
  const match = input.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return match?.[1] ?? input.trim();
}

function AccountSelect({ accounts, value, onChange }: { accounts: YoutubeAccount[]; value: string; onChange: (id: string) => void }) {
  return (
    <Field label="Cuenta">
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {accounts.length === 0 && <option value="">Conecta una cuenta primero</option>}
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.channelTitle}</option>)}
      </select>
    </Field>
  );
}

function AccountsTab({ accounts, loading, onReload }: { accounts: YoutubeAccount[]; loading: boolean; onReload: () => void }) {
  const connect = useAction(async () => {
    const { data } = await api.youtubeAuthUrl();
    window.location.href = data.url;
  });
  return (
    <Card
      title="Canales conectados"
      actions={<Button variant="primary" size="sm" icon="play" loading={connect.loading} onClick={() => void connect.run()}>Conectar cuenta</Button>}
    >
      <ErrorBox message={connect.error} />
      {loading && <Spinner label="Cargando…" />}
      {!loading && accounts.length === 0 && (
        <Empty icon="play" title="Ninguna cuenta conectada">Conecta tu canal con Google para subir videos y ver analíticas.</Empty>
      )}
      <div className="stack">
        {accounts.map((a) => (
          <div key={a.id} className="row" style={{ gap: 16 }}>
            {a.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.thumbnailUrl} alt="" width={40} height={40} style={{ borderRadius: '50%' }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{a.channelTitle}</div>
              <div className="small muted mono">{a.channelId}</div>
            </div>
            <span className="small muted">Conectada {formatDate(a.createdAt)}</span>
          </div>
        ))}
      </div>
      {accounts.length > 0 && <div style={{ marginTop: 16 }}><Button size="sm" variant="ghost" icon="refresh" onClick={onReload}>Actualizar</Button></div>}
    </Card>
  );
}

function UploadTab({ accounts, accountId, setAccountId }: { accounts: YoutubeAccount[]; accountId: string; setAccountId: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [progress, setProgress] = useState(0);
  const upload = useAction(async () => {
    setProgress(0);
    return uploadYoutubeVideo({ accountId, title: title.trim(), description, tags, privacyStatus: privacy }, file!, setProgress);
  });
  const video = upload.result;

  return (
    <Card title="Subir video" className="card-accent">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void upload.run(); }}>
        <div className="form-grid">
          <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
          <Field label="Visibilidad">
            <select className="select" value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
              <option value="private">Privado</option>
              <option value="unlisted">No listado</option>
              <option value="public">Público</option>
            </select>
          </Field>
        </div>
        <Field label="Título"><input className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Descripción"><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Tags" hint="Separados por comas"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <Field label="Archivo de video" hint={file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'MP4, MOV, WebM…'}>
          <input className="input" type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        {upload.loading && (
          <div className="stack-sm">
            <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <span className="small muted">{progress < 1 ? `Subiendo… ${Math.round(progress * 100)}%` : 'Procesando en YouTube…'}</span>
          </div>
        )}
        <ErrorBox message={upload.error} />
        {video?.id && (
          <div className="alert alert-success">
            Video subido: <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">{video.snippet?.title ?? video.id}</a>
          </div>
        )}
        <div>
          <Button type="submit" variant="primary" icon="upload" loading={upload.loading} disabled={!file || !title.trim() || !accountId}>Subir</Button>
        </div>
      </form>
    </Card>
  );
}

function StatsTab({ accounts, accountId, setAccountId }: { accounts: YoutubeAccount[]; accountId: string; setAccountId: (id: string) => void }) {
  const [input, setInput] = useState('');
  const stats = useAction(() => api.youtubeVideoStats(videoIdFrom(input), accountId));
  const del = useAction(() => api.youtubeDeleteVideo(videoIdFrom(input), accountId));
  const s = stats.result?.data.stats;

  async function remove() {
    if (!window.confirm('¿Eliminar este video de YouTube? Esta acción no se puede deshacer.')) return;
    if (await del.run()) stats.reset();
  }

  return (
    <div className="stack-lg">
      <Card title="Estadísticas de un video" className="card-accent">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void stats.run(); }}>
          <div className="form-grid">
            <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
            <Field label="Video"><input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="URL o ID" /></Field>
          </div>
          <div className="row">
            <Button type="submit" variant="primary" loading={stats.loading} disabled={!input.trim() || !accountId}>Consultar</Button>
            <Button variant="danger" icon="trash" loading={del.loading} disabled={!input.trim() || !accountId} onClick={remove}>Eliminar video</Button>
          </div>
        </form>
      </Card>
      <ErrorBox message={stats.error ?? del.error} />
      {del.result && <div className="alert alert-success">Video {del.result.data.videoId} eliminado.</div>}
      {s && (
        <Card title={s.title} actions={<Badge>{formatDate(s.publishedAt)}</Badge>}>
          <div className="grid">
            <div><div className="muted small">Vistas</div><div className="stat-value">{formatNumber(s.viewCount)}</div></div>
            <div><div className="muted small">Me gusta</div><div className="stat-value">{formatNumber(s.likeCount)}</div></div>
            <div><div className="muted small">Comentarios</div><div className="stat-value">{formatNumber(s.commentCount)}</div></div>
            <div><div className="muted small">Duración</div><div className="stat-value">{s.duration}</div></div>
          </div>
        </Card>
      )}
    </div>
  );
}

function AnalyticsTab({ accounts, accountId, setAccountId }: { accounts: YoutubeAccount[]; accountId: string; setAccountId: (id: string) => void }) {
  const [start, setStart] = useState(isoDay(-28));
  const [end, setEnd] = useState(isoDay(-1));
  const analytics = useAction(() => api.youtubeChannelAnalytics({ accountId, startDate: start, endDate: end }));
  const a = analytics.result?.data.analytics;

  return (
    <div className="stack-lg">
      <Card title="Analíticas del canal" className="card-accent">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void analytics.run(); }}>
          <div className="form-grid">
            <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
            <Field label="Desde"><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Hasta"><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <div><Button type="submit" variant="primary" loading={analytics.loading} disabled={!accountId || !start || !end}>Consultar</Button></div>
        </form>
      </Card>
      <ErrorBox message={analytics.error} />
      {a && (
        <Card title={`${a.startDate} → ${a.endDate}`}>
          {a.rows.length === 0 ? (
            <Empty icon="list" title="Sin datos">YouTube no devolvió filas para este rango.</Empty>
          ) : (
            <div className="table-wrap" style={{ margin: '0 -24px -24px' }}>
              <table>
                <thead><tr>{a.metrics.map((m) => <th key={m} className="right">{m}</th>)}</tr></thead>
                <tbody>
                  {a.rows.map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j} className="right">{typeof cell === 'number' ? formatNumber(cell) : cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function YoutubeContent() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>('accounts');
  const [accountId, setAccountId] = useState('');
  const accounts = useQuery(async () => {
    const res = await api.youtubeAccounts();
    const list = res.data.accounts;
    setAccountId((current) => current || list[0]?.id || '');
    return list;
  });
  const list = accounts.data ?? [];
  const connected = params.get('connected');
  const oauthError = params.get('error');

  return (
    <>
      <PageHeader title="YouTube" description="Conecta tu canal para subir videos y consultar estadísticas a través de ms-youtube." />
      {connected && <div className="alert alert-success">Cuenta conectada: {connected}</div>}
      {oauthError && <div className="alert alert-danger">{oauthError}</div>}
      <ErrorBox message={accounts.error} onRetry={accounts.reload} />

      <Tabs
        tabs={[
          { id: 'accounts', label: 'Cuentas' },
          { id: 'upload', label: 'Subir video' },
          { id: 'stats', label: 'Estadísticas' },
          { id: 'analytics', label: 'Analíticas' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'accounts' && <AccountsTab accounts={list} loading={accounts.loading} onReload={accounts.reload} />}
      {tab === 'upload' && <UploadTab accounts={list} accountId={accountId} setAccountId={setAccountId} />}
      {tab === 'stats' && <StatsTab accounts={list} accountId={accountId} setAccountId={setAccountId} />}
      {tab === 'analytics' && <AnalyticsTab accounts={list} accountId={accountId} setAccountId={setAccountId} />}
    </>
  );
}

export default function YoutubePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <YoutubeContent />
    </Suspense>
  );
}
