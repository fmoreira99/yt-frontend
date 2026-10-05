'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { formatCompact, formatNumber, formatRelative, isoDay } from '@/lib/format';
import { Icon } from '../Icon';
import { AreaChart } from '../AreaChart';
import { BarList } from '../BarList';
import { Button, Card, ErrorBox, Spinner } from '../ui';
import type { TabProps } from './ChannelDrawer';

type MetricId = 'views' | 'minutes' | 'subs';
const RANGES = [7, 28, 90];
const METRICS: Record<MetricId, { label: string; column: number }> = {
  views: { label: 'Vistas', column: 1 },
  minutes: { label: 'Minutos vistos', column: 2 },
  subs: { label: 'Suscriptores ganados', column: 3 },
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="small muted">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && <span className="small muted">{hint}</span>}
    </div>
  );
}

function useConnect() {
  return useAction(async () => {
    const { data } = await api.youtubeAuthUrl();
    window.location.href = data.url;
  });
}

function AnalyticsPanel({ accountId }: { accountId: string }) {
  const [days, setDays] = useState(28);
  const [metric, setMetric] = useState<MetricId>('views');
  const connect = useConnect();

  // Se pide el doble de rango para comparar contra el periodo anterior con una sola llamada.
  const query = useQuery(
    () =>
      api.youtubeChannelAnalytics({
        accountId,
        startDate: isoDay(-days * 2),
        endDate: isoDay(-1),
        metrics: 'views,estimatedMinutesWatched,subscribersGained',
      }),
    [accountId, days],
  );

  const column = METRICS[metric].column;
  const series = (query.data?.data.analytics.rows ?? []).map((row) => ({ x: String(row[0]), y: Number(row[column]) || 0 }));
  const cutoff = isoDay(-days);
  const current = series.filter((p) => p.x >= cutoff);
  const previous = series.filter((p) => p.x < cutoff);
  const total = sum(current.map((p) => p.y));
  const before = sum(previous.map((p) => p.y));
  const delta = before > 0 ? (total - before) / before : null;

  return (
    <Card title="Estadísticas del canal">
      <div className="stack">
        <div className="row-between">
          <div className="seg" role="radiogroup" aria-label="Periodo">
            {RANGES.map((d) => (
              <button key={d} role="radio" aria-checked={days === d} className="seg-item" onClick={() => setDays(d)}>
                {d} días
              </button>
            ))}
          </div>
          <div className="seg" role="radiogroup" aria-label="Métrica">
            {(Object.keys(METRICS) as MetricId[]).map((id) => (
              <button key={id} role="radio" aria-checked={metric === id} className="seg-item" onClick={() => setMetric(id)}>
                {METRICS[id].label}
              </button>
            ))}
          </div>
        </div>

        {query.error ? (
          <div className="stack-sm">
            <ErrorBox message={query.error} onRetry={query.reload} />
            <div>
              <Button size="sm" loading={connect.loading} onClick={() => void connect.run()}>
                Volver a conectar con Google
              </Button>
            </div>
          </div>
        ) : query.loading && !query.data ? (
          <Spinner label="Consultando YouTube Analytics…" />
        ) : (
          <>
            <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
              <span className="stat-hero">{formatNumber(total)}</span>
              {delta !== null && (
                <span className={`delta ${delta >= 0 ? 'delta-up' : 'delta-down'}`}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))} % <span className="muted">vs. periodo anterior</span>
                </span>
              )}
            </div>
            <AreaChart points={current} label={METRICS[metric].label} loading={query.loading} />
          </>
        )}
      </div>
    </Card>
  );
}

export function SummaryTab({ channel, videos }: TabProps) {
  const connect = useConnect();
  const { stats, connection } = channel;
  const top = [...videos]
    .sort((a, b) => (b.metadata.view_count ?? 0) - (a.metadata.view_count ?? 0))
    .slice(0, 5)
    .map((v) => ({ id: v.video_id, label: v.metadata.title, value: v.metadata.view_count ?? 0, href: `/results/${v.video_id}` }));

  return (
    <div className="stack-lg">
      {stats.videos > 0 && (
        <div className="kpis">
          <Kpi label="Videos extraídos" value={String(stats.videos)} hint={`${stats.analyzed} con análisis IA`} />
          <Kpi label="Vistas (extraídos)" value={formatCompact(stats.views)} />
          <Kpi label="Me gusta" value={formatCompact(stats.likes)} />
          <Kpi label="Último video" value={stats.lastPublishedAt ? formatRelative(stats.lastPublishedAt) : '—'} />
        </div>
      )}

      {connection?.hasAnalytics ? (
        <AnalyticsPanel accountId={connection.accountId} />
      ) : (
        <Card className="callout">
          <div className="row-between">
            <div style={{ maxWidth: '46ch' }}>
              <h3>{connection ? 'Falta el permiso de Analytics' : 'Conecta este canal para ver sus estadísticas'}</h3>
              <p className="small muted" style={{ marginTop: 4 }}>
                {connection
                  ? 'La cuenta conectada no tiene acceso a YouTube Analytics. Vuelve a conectarla aceptando todos los permisos.'
                  : 'Con tu cuenta de Google verás visitas diarias, minutos vistos y suscriptores, y podrás descargar los datos. Inicia sesión con la cuenta propietaria del canal.'}
              </p>
            </div>
            <Button variant="primary" icon="play" loading={connect.loading} onClick={() => void connect.run()}>
              {connection ? 'Reconectar' : 'Conectar con Google'}
            </Button>
          </div>
          <ErrorBox message={connect.error} />
        </Card>
      )}

      {top.length > 0 && (
        <Card title="Videos con más vistas">
          <BarList items={top} />
        </Card>
      )}
      {top.length === 0 && (
        <p className="small muted row" style={{ gap: 8 }}>
          <Icon name="list" size={14} /> Aún no hay videos extraídos de este canal. Usa “Escanear” o activa el monitoreo.
        </p>
      )}
    </div>
  );
}
