'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Channel } from '@/lib/channels';
import { downloadFile, slug } from '@/lib/csv';
import { useAction, useQuery } from '@/lib/hooks';
import type { ReportFile, ReportJob } from '@/lib/types';
import { Button, Card, ErrorBox, Spinner } from '../ui';
import { useToast } from '../Toast';

const LABELS: Array<[string, string]> = [
  ['channel_basic', 'Resumen diario'],
  ['channel_traffic_source', 'Fuentes de tráfico'],
  ['channel_demographics', 'Demografía'],
  ['channel_device_os', 'Dispositivos y sistema'],
  ['channel_playback_location', 'Dónde se reproduce'],
  ['channel_sharing_service', 'Dónde se comparte'],
];
const labelOf = (job: ReportJob) => LABELS.find(([prefix]) => job.reportTypeId.startsWith(prefix))?.[1] ?? job.name;

const day = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
// Los reportes cubren un día completo que empieza a medianoche (hora del Pacífico): el día es el de startTime.
const dayOf = (report: ReportFile) => day.format(new Date(`${report.startTime.slice(0, 10)}T00:00:00Z`));

function JobReports({ job, accountId, base }: { job: ReportJob; accountId: string; base: string }) {
  const reports = useQuery(() => api.jobReports(accountId, job.id), [accountId, job.id]);
  const [all, setAll] = useState(false);
  const download = useAction(async (report: ReportFile) => {
    const csv = await api.downloadReport(accountId, job.id, report.id);
    downloadFile(`${base}-${slug(labelOf(job))}-${report.startTime.slice(0, 10)}.csv`, csv);
  });

  const list = reports.data?.data.reports ?? [];
  const shown = all ? list : list.slice(0, 5);

  return (
    <div className="stack-sm">
      <h3>{labelOf(job)}</h3>
      {reports.loading && !reports.data && <Spinner label="Consultando…" />}
      <ErrorBox message={reports.error} onRetry={reports.reload} />
      {reports.data && list.length === 0 && (
        <p className="small muted">Todavía no hay reportes: YouTube tarda hasta 2 días en generar el primero.</p>
      )}
      {shown.length > 0 && (
        <ul className="history">
          {shown.map((report) => (
            <li key={report.id}>
              <span className="small" style={{ flex: 1 }}>{dayOf(report)}</span>
              <Button size="sm" variant="ghost" icon="extract" loading={download.loading} onClick={() => void download.run(report)}>
                CSV
              </Button>
            </li>
          ))}
        </ul>
      )}
      {list.length > 5 && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>
            {all ? 'Mostrar menos' : `Mostrar los ${list.length}`}
          </Button>
        </div>
      )}
      <ErrorBox message={download.error} />
    </div>
  );
}

/** Reportes masivos que YouTube genera solo cada día (YouTube Reporting API), listos para descargar. */
export function ReportsCard({ channel }: { channel: Channel }) {
  const toast = useToast();
  const accountId = channel.connection!.accountId;
  const jobs = useQuery(() => api.reportJobs(accountId), [accountId]);
  const enable = useAction(async () => {
    const { data } = await api.enableReports(accountId);
    toast.success(data.created.length ? 'Reportes diarios activados' : 'Los reportes ya estaban activados');
    await jobs.reload();
  });

  const list = jobs.data?.data.jobs ?? [];
  return (
    <Card title="Reportes diarios automáticos">
      <div className="stack">
        <p className="small muted">
          YouTube prepara solo un reporte por día (resumen por video, fuentes de tráfico, demografía, dispositivos, lugar de reproducción y compartidos) y lo conserva 60 días. Actívalos una vez y
          descárgalos cuando quieras; el primero aparece unos 2 días después.
        </p>
        {jobs.loading && !jobs.data && <Spinner label="Consultando YouTube…" />}
        <ErrorBox message={jobs.error} onRetry={jobs.reload} />
        {jobs.data && list.length === 0 && (
          <div>
            <Button variant="primary" loading={enable.loading} onClick={() => void enable.run()}>
              Activar reportes diarios
            </Button>
          </div>
        )}
        <ErrorBox message={enable.error} />
        {list.map((job) => (
          <JobReports key={job.id} job={job} accountId={accountId} base={slug(channel.name)} />
        ))}
      </div>
    </Card>
  );
}
