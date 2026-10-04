'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { Badge, Card, Empty, ErrorBox, Field, PageHeader, Pager, Spinner, StatusBadge } from '@/components/ui';
import type { JobStatus } from '@/lib/types';

const LIMIT = 25;
const KNOWN_SERVICES = ['yt-extractor-service', 'ms-youtube', 'ms-media-hub'];

function AccountsCard() {
  const accounts = useQuery(() => api.coreAccounts());
  const list = accounts.data?.data ?? [];
  return (
    <Card title="Cuentas guardadas">
      {accounts.loading && <Spinner label="Cargando…" />}
      <ErrorBox message={accounts.error} onRetry={accounts.reload} />
      {accounts.data && list.length === 0 && <Empty icon="database" title="Sin cuentas">Las cuentas aparecerán aquí cuando un servicio las registre.</Empty>}
      {list.length > 0 && (
        <div className="table-wrap" style={{ margin: '0 -24px -24px' }}>
          <table>
            <thead><tr><th>Cuenta</th><th>Proveedor</th><th>Permisos</th><th>Token vence</th></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td><div style={{ fontWeight: 600 }}>{a.name ?? a.external_id}</div><div className="small muted">{a.email ?? a.external_id}</div></td>
                  <td><Badge tone="primary">{a.provider}</Badge></td>
                  <td className="small muted">{a.scopes.length ? `${a.scopes.length} scopes` : '—'}</td>
                  <td>{formatDate(a.token_expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LogsCard() {
  const [service, setService] = useState(KNOWN_SERVICES[0]);
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [offset, setOffset] = useState(0);
  const logs = useQuery(() => api.jobLogs(service, { limit: LIMIT, offset, status }), [service, status, offset]);
  const rows = logs.data?.data ?? [];

  return (
    <Card title="Registro de tareas">
      <div className="stack-lg">
        <div className="form-grid">
          <Field label="Servicio">
            <input className="input" list="services" value={service} onChange={(e) => { setService(e.target.value.trim()); setOffset(0); }} />
            <datalist id="services">{KNOWN_SERVICES.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Estado">
            <select className="select" value={status} onChange={(e) => { setStatus(e.target.value as JobStatus | ''); setOffset(0); }}>
              <option value="">Todos</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
              <option value="running">running</option>
              <option value="pending">pending</option>
            </select>
          </Field>
        </div>

        {logs.loading && <Spinner label="Cargando…" />}
        <ErrorBox message={logs.error} onRetry={logs.reload} />
        {logs.data && rows.length === 0 && <Empty icon="list" title="Sin registros">No hay tareas con estos filtros.</Empty>}
        {rows.length > 0 && (
          <div className="table-wrap" style={{ margin: '0 -24px' }}>
            <table>
              <thead><tr><th>Tarea</th><th>Estado</th><th>Inicio</th><th>Fin</th></tr></thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <details>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{log.job_type}</summary>
                        <div className="stack-sm" style={{ marginTop: 8 }}>
                          {log.error_message && <div className="alert alert-danger">{log.error_message}</div>}
                          <pre>{JSON.stringify({ payload: log.payload, result: log.result }, (k, v) => (k === 'transcript' ? '[omitido]' : v), 2)}</pre>
                        </div>
                      </details>
                    </td>
                    <td><StatusBadge status={log.status} /></td>
                    <td className="small">{formatDate(log.started_at ?? log.created_at)}</td>
                    <td className="small">{formatDate(log.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logs.data && <Pager offset={offset} limit={LIMIT} count={rows.length} onChange={setOffset} />}
      </div>
    </Card>
  );
}

export default function CorePage() {
  return (
    <>
      <PageHeader title="Base de datos" description="Cuentas y registro de tareas guardados en core-db-service. Los tokens nunca se muestran." />
      <AccountsCard />
      <LogsCard />
    </>
  );
}
