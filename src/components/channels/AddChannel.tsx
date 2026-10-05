'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { SCHEDULE_PRESETS } from '@/lib/cron';
import { useAction } from '@/lib/hooks';
import { Button, ErrorBox } from '../ui';

/** Alta en un paso: pega el canal, elige cada cuánto y listo (se programa y se lanza el primer escaneo). */
export function AddChannel({
  onAdded,
  onClose,
  canConnect,
}: {
  onAdded: (channelId: string) => void;
  onClose?: () => void;
  canConnect: boolean;
}) {
  const [input, setInput] = useState('');
  const [cron, setCron] = useState<string>('0 */6 * * *');

  const add = useAction(async () => {
    const { schedule } = await api.createSchedule({ channel_id: input.trim(), cron_expression: cron, max_videos: 10 });
    // El primer escaneo es opcional: si ya hay uno en curso no es un error.
    await api.triggerNow({ channel_id: schedule.channel_id }).catch(() => undefined);
    return schedule.channel_id;
  });
  const connect = useAction(async () => {
    const { data } = await api.youtubeAuthUrl();
    window.location.href = data.url;
  });

  return (
    <section className="card card-accent add-channel stack">
      <div className="row-between">
        <h2>Añadir canal</h2>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </div>

      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const id = await add.run();
          if (id) onAdded(id);
        }}
      >
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 280px' }}>
            <label htmlFor="channel-input">Enlace, @usuario o ID del canal</label>
            <input
              id="channel-input"
              className="input"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://youtube.com/@canal"
            />
          </div>
          <Button type="submit" variant="primary" icon="play" loading={add.loading} disabled={!input.trim()}>
            Monitorear
          </Button>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <span className="small muted">Revisar cada</span>
          <div className="seg" role="radiogroup" aria-label="Frecuencia">
            {SCHEDULE_PRESETS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={cron === p.cron} className="seg-item" onClick={() => setCron(p.cron)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {add.loading && <p className="small muted">Buscando el canal y lanzando el primer escaneo…</p>}
        <ErrorBox message={add.error} />
      </form>

      {canConnect && (
        <div className="add-divider">
          <span>o, si es tu canal</span>
        </div>
      )}
      {canConnect && (
        <div className="row-between">
          <p className="small muted" style={{ maxWidth: '46ch' }}>
            Conéctalo con Google para ver visitas, minutos vistos y suscriptores, y poder subir videos.
          </p>
          <Button loading={connect.loading} onClick={() => void connect.run()}>
            Conectar con Google
          </Button>
        </div>
      )}
      <ErrorBox message={connect.error} />
    </section>
  );
}
