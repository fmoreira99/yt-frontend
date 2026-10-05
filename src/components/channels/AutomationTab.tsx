'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DEFAULT_CRON, describeCron, presetFor, SCHEDULE_PRESETS } from '@/lib/cron';
import { useAction, useQuery } from '@/lib/hooks';
import { formatDate, formatRelative } from '@/lib/format';
import { Badge, Button, Card, Empty, ErrorBox, Field, Spinner, StatusBadge } from '../ui';
import { useToast } from '../Toast';
import type { TabProps } from './ChannelDrawer';

const VIDEO_COUNTS = [5, 10, 20, 50];
const TRIGGERS: Record<string, string> = { cron: 'programado', manual: 'manual', on_demand: 'a demanda' };

export function AutomationTab({ channel, onChanged }: TabProps) {
  const toast = useToast();
  const monitor = channel.monitor;
  const [custom, setCustom] = useState(monitor?.cron ?? DEFAULT_CRON);

  const save = useAction(async (cron: string, maxVideos: number | null, message: string) => {
    await api.createSchedule({ channel_id: channel.id, cron_expression: cron, max_videos: maxVideos ?? undefined });
    toast.success(message);
    onChanged();
  });
  const pause = useAction(async () => {
    try {
      await api.removeSchedule(channel.id);
    } catch (err) {
      // Si el extractor ya no lo tenía cargado, el resultado buscado (pausado) ya se cumple.
      if (!(err instanceof ApiError && err.code === 'SCHEDULE_NOT_FOUND')) throw err;
    }
    toast.success('Monitoreo pausado');
    onChanged();
  });
  const scan = useAction(async () => {
    await api.triggerNow({ channel_id: channel.id });
    toast.success('Escaneo iniciado');
    setTimeout(onChanged, 1500);
  });

  const logs = useQuery(() => api.jobLogs('yt-extractor-service', { limit: 100 }), [channel.id]);
  const history = (logs.data?.data ?? [])
    .filter(
      (l) =>
        l.job_type === 'channel_sensor' &&
        l.status !== 'running' &&
        (l.account_id === monitor?.accountId || l.payload.channel === channel.id),
    )
    .slice(0, 6);

  if (!monitor) {
    return (
      <Empty icon="clock" title="Este canal no se monitorea">
        Actívalo para revisar automáticamente si hay videos nuevos y analizarlos.
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" loading={save.loading} onClick={() => void save.run(DEFAULT_CRON, 10, 'Monitoreo activado')}>
            Monitorear este canal
          </Button>
        </div>
        <ErrorBox message={save.error} />
      </Empty>
    );
  }

  const busy = save.loading || pause.loading;
  const maxVideos = monitor.maxVideos ?? 10;
  const preset = presetFor(monitor.cron);

  return (
    <div className="stack-lg">
      <Card className="stack">
        <div className="row-between">
          <div>
            <h3>Monitoreo automático</h3>
            <p className="small muted">
              {monitor.active ? `${describeCron(monitor.cron)} · próximo ${formatRelative(monitor.nextRunAt)}` : 'Pausado: no se revisan videos nuevos.'}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={monitor.active}
            aria-label="Monitoreo automático"
            className="switch"
            disabled={busy}
            onClick={() => void (monitor.active ? pause.run() : save.run(monitor.cron, monitor.maxVideos, 'Monitoreo reanudado'))}
          >
            <span />
          </button>
        </div>
        {monitor.needsRestore && (
          <div className="alert alert-info">La programación no estaba cargada en el extractor. Reanúdala con el interruptor para volver a activarla.</div>
        )}
        <ErrorBox message={pause.error ?? save.error ?? scan.error} />
      </Card>

      <Card title="Frecuencia">
        <div className="stack">
          <div className="seg" role="radiogroup" aria-label="Frecuencia">
            {SCHEDULE_PRESETS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={monitor.active && preset?.id === p.id}
                className="seg-item"
                disabled={busy}
                onClick={() => void save.run(p.cron, monitor.maxVideos, `Revisión: ${describeCron(p.cron)}`)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Field label="Videos a revisar en cada escaneo" hint="Los más recientes del canal">
            <div className="seg" role="radiogroup" aria-label="Videos por escaneo">
              {VIDEO_COUNTS.map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={maxVideos === n}
                  className="seg-item"
                  disabled={busy}
                  onClick={() => void save.run(monitor.cron, n, `Se revisarán ${n} videos por escaneo`)}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <details>
            <summary className="small muted" style={{ cursor: 'pointer' }}>Expresión cron personalizada</summary>
            <form
              className="row"
              style={{ marginTop: 8, alignItems: 'flex-end' }}
              onSubmit={(e) => {
                e.preventDefault();
                void save.run(custom.trim(), monitor.maxVideos, 'Frecuencia actualizada');
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <Field label="Cron" hint="minuto hora día mes día-semana · mínimo cada 5 min">
                  <input className="input mono" value={custom} onChange={(e) => setCustom(e.target.value)} />
                </Field>
              </div>
              <Button type="submit" loading={save.loading} disabled={!custom.trim()}>Aplicar</Button>
            </form>
          </details>
        </div>
      </Card>

      <Card
        title="Actividad"
        actions={
          <Button size="sm" variant="secondary" icon="refresh" loading={scan.loading || monitor.running} onClick={() => void scan.run()}>
            Escanear ahora
          </Button>
        }
      >
        <div className="stack">
          <div className="row" style={{ gap: 16 }}>
            <span className="small muted">Última ejecución</span>
            {monitor.running ? (
              <Badge tone="info">en curso</Badge>
            ) : monitor.lastStatus ? (
              <StatusBadge status={monitor.lastStatus} />
            ) : (
              <span className="small muted">—</span>
            )}
            <span className="small">{formatRelative(monitor.lastRunAt)}</span>
          </div>
          {monitor.lastError && <div className="alert alert-danger">{monitor.lastError}</div>}

          {logs.loading && !logs.data && <Spinner label="Cargando historial…" />}
          {history.length > 0 && (
            <ul className="history">
              {history.map((l) => {
                const r = (l.result ?? {}) as { extracted?: number; skipped?: number; failed?: number };
                return (
                  <li key={l.id}>
                    <StatusBadge status={l.status} />
                    <span className="small">{formatDate(l.finished_at ?? l.created_at)}</span>
                    <span className="small muted">{TRIGGERS[String(l.payload.trigger)] ?? ''}</span>
                    <span className="small muted history-result">
                      {l.status === 'failed'
                        ? (l.error_message ?? 'Falló')
                        : `${r.extracted ?? 0} nuevos · ${r.skipped ?? 0} ya vistos · ${r.failed ?? 0} fallidos`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {logs.data && history.length === 0 && <p className="small muted">Todavía no hay ejecuciones registradas.</p>}
        </div>
      </Card>
    </div>
  );
}
