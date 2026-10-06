'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Badge, Button, Card, ErrorBox, Field, PageHeader, Tabs } from '@/components/ui';
import { LinkPicker } from '@/components/LinkPicker';
import { VideoCard } from '@/components/VideoCard';
import { linkAll } from '@/lib/links';
import type { ExtractVideosResponse } from '@/lib/types';

function VideosTab() {
  const [text, setText] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [requireTranscript, setRequireTranscript] = useState(true);
  const [targets, setTargets] = useState<string[]>([]);
  const [linkNote, setLinkNote] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const extract = useAction(async (body: Parameters<typeof api.extractVideos>[0]) => {
    setLinkNote(null);
    const res = await api.extractVideos(body);
    // Vincular es opcional: si falla, la extracción ya está guardada y no se pierde el resultado.
    const ids = [...res.extracted.map((v) => v.video_id), ...res.skipped];
    if (targets.length && ids.length) {
      try {
        await linkAll(targets, 'video', ids);
        setLinkNote({ tone: 'success', text: `${ids.length} video(s) vinculados a ${targets.length} canal(es). Aparecen en su cola de inspiración.` });
      } catch (err) {
        setLinkNote({ tone: 'danger', text: `Se extrajo, pero no se pudo vincular: ${err instanceof Error ? err.message : 'error desconocido'}. Puedes vincular desde Resultados.` });
      }
    }
    return res;
  });

  const urls = text.split(/[\s,]+/).filter(Boolean);
  const result: ExtractVideosResponse | null = extract.result;

  return (
    <div className="stack-lg">
      <Card className="card-accent">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void extract.run({ urls, skip_duplicate_check: skipDuplicates, require_transcript: requireTranscript });
          }}
        >
          <Field label="URLs o IDs de video" hint="Una por línea. Máximo 25 por petición.">
            <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          </Field>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
              Re-extraer aunque ya exista
            </label>
            <label className="check">
              <input type="checkbox" checked={requireTranscript} onChange={(e) => setRequireTranscript(e.target.checked)} />
              Exigir guion
            </label>
          </div>
          <LinkPicker value={targets} onChange={setTargets} hint="Los videos aparecerán en la cola de inspiración de esos canales." />
          <div className="row">
            <Button type="submit" variant="primary" icon="extract" loading={extract.loading} disabled={!urls.length || urls.length > 25}>
              Extraer {urls.length > 0 && `(${urls.length})`}
            </Button>
            {extract.loading && <span className="muted small">Puede tardar: se extrae metadata, guion y análisis IA.</span>}
          </div>
        </form>
      </Card>

      <ErrorBox message={extract.error} />
      {linkNote && <div className={`alert alert-${linkNote.tone}`}>{linkNote.text}</div>}
      {result && (
        <div className="stack">
          <div className="row">
            <Badge tone="success">{result.extracted.length} extraídos</Badge>
            {result.skipped.length > 0 && <Badge tone="warning">{result.skipped.length} ya procesados</Badge>}
            {result.errors.length > 0 && <Badge tone="danger">{result.errors.length} con error</Badge>}
          </div>
          {result.extracted.map((v) => (
            <VideoCard key={v.video_id} metadata={v.metadata} analysis={v.analysis} analysisError={v.analysis_error} transcriptAvailable={v.transcript_available} />
          ))}
          {result.skipped.length > 0 && (
            <div className="alert alert-info">
              Ya estaban procesados: {result.skipped.join(', ')}. Activa “Re-extraer” para forzarlo.
            </div>
          )}
          {result.errors.map((e, i) => (
            <div key={i} className="alert alert-danger">
              <strong>{e.video_id ?? e.input}</strong> — {e.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelTab() {
  const [channel, setChannel] = useState('');
  const [maxVideos, setMaxVideos] = useState('10');
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const [linkNote, setLinkNote] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const scan = useAction(async (body: Parameters<typeof api.extractChannel>[0]) => {
    setLinkNote(null);
    const res = await api.extractChannel(body);
    if (targets.length) {
      try {
        // El canal entero pasa a ser fuente de inspiración: también entrarán sus videos futuros.
        await linkAll(targets, 'channel', [res.channel_id]);
        setLinkNote({ tone: 'success', text: `Canal vinculado a ${targets.length} canal(es) tuyos. Sus videos extraídos están en la cola de inspiración.` });
      } catch (err) {
        setLinkNote({ tone: 'danger', text: `Se escaneó, pero no se pudo vincular: ${err instanceof Error ? err.message : 'error desconocido'}.` });
      }
    }
    return res;
  });
  const summary = scan.result;

  return (
    <div className="stack-lg">
      <Card className="card-accent">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void scan.run({ channel_id: channel.trim(), max_videos: Number(maxVideos) || undefined, skip_duplicate_check: skipDuplicates });
          }}
        >
          <div className="form-grid">
            <Field label="Canal" hint="ID (UC…), @handle o URL del canal">
              <input className="input" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="@canal" />
            </Field>
            <Field label="Videos a revisar" hint="1 a 50 (los más recientes)">
              <input className="input" type="number" min={1} max={50} value={maxVideos} onChange={(e) => setMaxVideos(e.target.value)} />
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
            Re-extraer aunque ya exista
          </label>
          <LinkPicker value={targets} onChange={setTargets} label="Usar como inspiración de mis canales (opcional)" hint="Sus guiones aparecerán en la cola de esos canales." />
          <div className="row">
            <Button type="submit" variant="primary" icon="search" loading={scan.loading} disabled={!channel.trim()}>
              Escanear canal
            </Button>
            {scan.loading && <span className="muted small">Escanear un canal puede tardar más de un minuto.</span>}
          </div>
        </form>
      </Card>

      <ErrorBox message={scan.error} />
      {linkNote && <div className={`alert alert-${linkNote.tone}`}>{linkNote.text}</div>}
      {summary && (
        <div className="stack">
          <div className="row">
            <h2>{summary.channel_title ?? summary.channel_id}</h2>
            <Badge tone={summary.status === 'success' ? 'success' : 'danger'}>{summary.status}</Badge>
          </div>
          <div className="row">
            <Badge>{summary.total_found} encontrados</Badge>
            <Badge tone="success">{summary.extracted} extraídos</Badge>
            <Badge tone="warning">{summary.skipped} omitidos</Badge>
            {summary.failed > 0 && <Badge tone="danger">{summary.failed} fallidos</Badge>}
          </div>
          {summary.videos.map((v) => (
            <VideoCard key={v.video_id} metadata={v.metadata} analysis={v.analysis} analysisError={v.analysis_error} transcriptAvailable={v.transcript_available} />
          ))}
          {summary.errors.map((e) => (
            <div key={e.video_id} className="alert alert-danger">
              <strong>{e.video_id}</strong> — {e.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExtractPage() {
  const [tab, setTab] = useState<'videos' | 'channel'>('videos');
  return (
    <>
      <PageHeader title="Extraer" description="Obtén metadata, guion y análisis IA de videos sueltos o de los últimos videos de un canal." />
      <Tabs
        tabs={[
          { id: 'videos', label: 'Videos' },
          { id: 'channel', label: 'Canal' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'videos' ? <VideosTab /> : <ChannelTab />}
    </>
  );
}
