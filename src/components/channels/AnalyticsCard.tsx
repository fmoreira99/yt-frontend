'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { buildAiPackage, labelOfColumn, periodLabel, periodOf } from '@/lib/analytics-export';
import type { Channel } from '@/lib/channels';
import { downloadFile, slug, toCsv } from '@/lib/csv';
import { isoDay } from '@/lib/format';
import { useAction, useQuery } from '@/lib/hooks';
import { fetchAllVideos } from '@/lib/videos';
import { Button, Card, ErrorBox, Spinner } from '../ui';
import { useToast } from '../Toast';

const RANGES = [7, 28, 90, 365, 0];
const rangeText = (days: number) => (days === 0 ? 'Todo' : days === 365 ? '1 año' : `${days} días`);
const TOP_VIDEOS = 10;

/** Lo que Studio muestra en Analytics -> Modo avanzado, descargable por reporte (CSV) o todo junto para una IA (JSON). */
export function AnalyticsCard({ channel }: { channel: Channel }) {
  const toast = useToast();
  const accountId = channel.connection!.accountId;
  const base = slug(channel.name);
  const [days, setDays] = useState(28);
  const [current, setCurrent] = useState<string | null>(null);
  const catalog = useQuery(() => api.analyticsCatalog(), []);

  const downloadReport = useAction(async (id: string) => {
    setCurrent(id);
    try {
      const { data } = await api.analyticsReport(accountId, id, {
        ...periodOf(days),
        ...(id === 'retention_top' ? { top: TOP_VIDEOS } : {}),
      });
      const { columns, rows } = data.report;
      if (!rows.length) return toast.info('YouTube no devolvió datos para ese reporte y periodo');
      downloadFile(`${base}-${id}-${periodLabel(days)}-${isoDay()}.csv`, toCsv(columns.map(labelOfColumn), rows));
      toast.success(`${rows.length} filas descargadas`);
    } finally {
      setCurrent(null);
    }
  });

  const downloadAll = useAction(async () => {
    const [{ data }, extracted] = await Promise.all([
      api.analyticsBundle(accountId, { ...periodOf(days), top: TOP_VIDEOS }),
      fetchAllVideos(channel.id).catch(() => []),
    ]);
    const failed = Object.keys(data.bundle.errors).length;
    downloadFile(
      `${base}-paquete-ia-${periodLabel(days)}-${isoDay()}.json`,
      JSON.stringify(buildAiPackage(data.bundle, extracted), null, 2),
      'application/json',
    );
    if (failed) toast.info(`Paquete descargado; ${failed} reporte(s) no estaban disponibles (constan en el archivo)`);
    else toast.success('Paquete completo descargado');
  });

  const busy = downloadReport.loading || downloadAll.loading;
  const reports = (catalog.data?.data.reports ?? []).filter((r) => !r.requiresVideo);

  return (
    <Card title="Analíticas de YouTube">
      <div className="stack">
        <p className="small muted">
          Lo que ves en Studio → Analytics → Modo avanzado: rendimiento por video, retención, fuentes de tráfico, búsquedas, audiencia y
          más. Las impresiones y el CTR de miniaturas solo los entrega YouTube en los reportes diarios automáticos (más abajo).
        </p>
        <div className="seg" role="radiogroup" aria-label="Periodo">
          {RANGES.map((d) => (
            <button key={d} role="radio" aria-checked={days === d} className="seg-item" disabled={busy} onClick={() => setDays(d)}>
              {rangeText(d)}
            </button>
          ))}
        </div>

        <div className="stack-sm">
          <div>
            <Button variant="primary" icon="extract" loading={downloadAll.loading} disabled={busy} onClick={() => void downloadAll.run()}>
              Paquete completo para IA (JSON)
            </Button>
          </div>
          <p className="small muted">
            Todos los reportes de abajo y la retención de tus {TOP_VIDEOS} videos más vistos en un solo archivo, con los videos extraídos
            si los hay. Puede tardar hasta un minuto.
          </p>
          <ErrorBox message={downloadAll.error} />
        </div>

        <div className="stack-sm">
          <h3>Reportes sueltos (CSV)</h3>
          {catalog.loading && !catalog.data && <Spinner label="Cargando reportes…" />}
          <ErrorBox message={catalog.error} onRetry={catalog.reload} />
          {reports.length > 0 && (
            <ul className="history">
              {reports.map((report) => (
                <li key={report.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong className="small">{report.label}</strong>
                    <p className="small muted">{report.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="extract"
                    loading={downloadReport.loading && current === report.id}
                    disabled={busy}
                    onClick={() => void downloadReport.run(report.id)}
                  >
                    CSV
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <ErrorBox message={downloadReport.error} />
        </div>
      </div>
    </Card>
  );
}
