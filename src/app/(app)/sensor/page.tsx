'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { Badge, Button, Card, Empty, ErrorBox, Field, PageHeader, Spinner, StatusBadge } from '@/components/ui';

const PRESETS = [
  { label: 'Cada 30 min', cron: '*/30 * * * *' },
  { label: 'Cada hora', cron: '0 * * * *' },
  { label: 'Cada 6 horas', cron: '0 */6 * * *' },
  { label: 'Diario 09:00', cron: '0 9 * * *' },
];

export default function SensorPage() {
  const status = useQuery(() => api.scheduleStatus());
  const [channel, setChannel] = useState('');
  const [cron, setCron] = useState('0 * * * *');
  const [maxVideos, setMaxVideos] = useState('10');
  const [notice, setNotice] = useState<string | null>(null);

  const create = useAction(api.createSchedule);
  const trigger = useAction(api.triggerNow);
  const remove = useAction(api.removeSchedule);

  const schedules = status.data?.schedules ?? [];
  const anyRunning = schedules.some((s) => s.running);

  // Mientras haya un escaneo en curso, refresca el estado.
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(() => void status.reload(), 10_000);
    return () => clearInterval(timer);
  }, [anyRunning, status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const created = await create.run({ channel_id: channel.trim(), cron_expression: cron.trim(), max_videos: Number(maxVideos) || undefined });
    if (created) {
      setChannel('');
      setNotice(`Programación creada para ${created.schedule.channel_id}`);
      void status.reload();
    }
  }

  async function runNow(channelId: string) {
    const started = await trigger.run({ channel_id: channelId });
    if (started) {
      setNotice(`Escaneo iniciado para ${started.channel_id}`);
      setTimeout(() => void status.reload(), 1500);
    }
  }

  async function drop(channelId: string) {
    if (!window.confirm(`¿Eliminar la programación de ${channelId}?`)) return;
    if (await remove.run(channelId)) void status.reload();
  }

  return (
    <>
      <PageHeader title="Sensor" description="Escanea canales automáticamente con una expresión cron y guarda los videos nuevos." />

      <Card title="Nueva programación" className="card-accent">
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <Field label="Canal" hint="ID (UC…), @handle o URL">
              <input className="input" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="@canal" />
            </Field>
            <Field label="Cron" hint="minuto hora día mes día-semana">
              <input className="input mono" value={cron} onChange={(e) => setCron(e.target.value)} />
            </Field>
            <Field label="Videos por escaneo">
              <input className="input" type="number" min={1} max={50} value={maxVideos} onChange={(e) => setMaxVideos(e.target.value)} />
            </Field>
          </div>
          <div className="row">
            {PRESETS.map((p) => (
              <Button key={p.cron} size="sm" variant={cron === p.cron ? 'primary' : 'secondary'} onClick={() => setCron(p.cron)}>
                {p.label}
              </Button>
            ))}
          </div>
          <div>
            <Button type="submit" variant="primary" icon="clock" loading={create.loading} disabled={!channel.trim() || !cron.trim()}>
              Programar
            </Button>
          </div>
        </form>
      </Card>

      {notice && <div className="alert alert-success">{notice}</div>}
      <ErrorBox message={create.error ?? trigger.error ?? remove.error} />

      <Card
        title="Programaciones"
        actions={<Button size="sm" variant="ghost" icon="refresh" onClick={status.reload}>Actualizar</Button>}
      >
        {status.loading && !status.data && <Spinner label="Cargando…" />}
        <ErrorBox message={status.error} onRetry={status.reload} />
        {status.data && schedules.length === 0 && (
          <Empty icon="clock" title="Sin programaciones">Crea la primera para empezar a monitorear un canal.</Empty>
        )}
        {schedules.length > 0 && (
          <div className="table-wrap" style={{ margin: '0 -24px -24px' }}>
            <table>
              <thead>
                <tr><th>Canal</th><th>Cron</th><th>Próxima</th><th>Última</th><th></th></tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.channel_id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.channel_id}</div>
                      {s.max_videos && <div className="small muted">{s.max_videos} videos/escaneo</div>}
                    </td>
                    <td className="mono">{s.cron_expression}</td>
                    <td>{formatDate(s.next_run_at)}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        {s.running ? <Badge tone="info">en curso</Badge> : s.last_status ? <StatusBadge status={s.last_status} /> : <span className="muted">—</span>}
                      </div>
                      <div className="small muted">{formatDate(s.last_run_at)}</div>
                      {s.last_error && <div className="small" style={{ color: 'var(--danger-fg)' }}>{s.last_error}</div>}
                    </td>
                    <td className="right">
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                        <Button size="sm" onClick={() => runNow(s.channel_id)} disabled={s.running}>Ejecutar ahora</Button>
                        <Button size="sm" variant="danger" icon="trash" onClick={() => drop(s.channel_id)} aria-label="Eliminar" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
