'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Badge, Button, Card, ErrorBox, Field, PageHeader, Tabs } from '@/components/ui';
import { VideoCard } from '@/components/VideoCard';
import type { ExtractVideosResponse } from '@/lib/types';

function VideosTab() {
  const [text, setText] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [requireTranscript, setRequireTranscript] = useState(true);
  const extract = useAction(api.extractVideos);

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
          <div className="row">
            <Button type="submit" variant="primary" icon="extract" loading={extract.loading} disabled={!urls.length || urls.length > 25}>
              Extraer {urls.length > 0 && `(${urls.length})`}
            </Button>
            {extract.loading && <span className="muted small">Puede tardar: se extrae metadata, guion y análisis IA.</span>}
          </div>
        </form>
      </Card>

      <ErrorBox message={extract.error} />
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
  const scan = useAction(api.extractChannel);
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
          <div className="row">
            <Button type="submit" variant="primary" icon="search" loading={scan.loading} disabled={!channel.trim()}>
              Escanear canal
            </Button>
            {scan.loading && <span className="muted small">Escanear un canal puede tardar más de un minuto.</span>}
          </div>
        </form>
      </Card>

      <ErrorBox message={scan.error} />
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
