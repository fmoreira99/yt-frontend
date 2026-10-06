import { isoDay } from './format';
import type { AnalyticsBundle, AnalyticsReport } from './types';

/** Nombres de columna de la API de YouTube -> encabezados en español para los CSV. */
export const COLUMN_LABELS: Record<string, string> = {
  video: 'video_id',
  title: 'titulo',
  publishedAt: 'publicado',
  durationSeconds: 'duracion_s',
  tags: 'tags',
  description: 'descripcion',
  day: 'fecha',
  views: 'vistas',
  engagedViews: 'vistas_interesadas',
  estimatedMinutesWatched: 'minutos_vistos',
  averageViewDuration: 'duracion_media_s',
  averageViewPercentage: 'porcentaje_visto',
  likes: 'me_gusta',
  comments: 'comentarios',
  shares: 'compartidos',
  subscribersGained: 'suscriptores_ganados',
  subscribersLost: 'suscriptores_perdidos',
  videoThumbnailImpressions: 'impresiones_miniatura',
  videoThumbnailImpressionsClickRate: 'ctr_miniatura',
  insightTrafficSourceType: 'fuente_trafico',
  insightTrafficSourceDetail: 'detalle_fuente',
  country: 'pais',
  ageGroup: 'edad',
  gender: 'genero',
  viewerPercentage: 'porcentaje_audiencia',
  deviceType: 'dispositivo',
  operatingSystem: 'sistema_operativo',
  insightPlaybackLocationType: 'lugar_reproduccion',
  creatorContentType: 'tipo_contenido',
  subscribedStatus: 'estado_suscripcion',
  sharingService: 'servicio_compartir',
  elapsedVideoTimeRatio: 'avance_video',
  audienceWatchRatio: 'audiencia_que_sigue',
  relativeRetentionPerformance: 'retencion_relativa',
};

export const labelOfColumn = (column: string) => COLUMN_LABELS[column] ?? column;

/** `days` = 0 -> todo el historial del canal. YouTube Analytics va con ~2 días de retraso: el día de hoy no tiene datos. */
export const periodOf = (days: number) => ({
  startDate: days === 0 ? 'all' : isoDay(-days),
  endDate: isoDay(-1),
});

export const periodLabel = (days: number) => (days === 0 ? 'todo' : days === 365 ? '1-ano' : `${days}d`);

/** Filas -> objetos con los nombres de columna de la API (estables para consumirlos desde código/IA). */
export function toRecords(report: Pick<AnalyticsReport, 'columns' | 'rows'>): Record<string, string | number>[] {
  return report.rows.map((row) => Object.fromEntries(report.columns.map((column, i) => [column, row[i]])));
}

/** Un único JSON con todo lo necesario para que una IA analice el canal (más lo extraído por el extractor, si hay). */
export function buildAiPackage(bundle: AnalyticsBundle, extractedVideos: unknown[]) {
  return {
    generado: bundle.generatedAt,
    canal: { id: bundle.channelId, nombre: bundle.channelTitle },
    periodo: { desde: bundle.startDate, hasta: bundle.endDate },
    nota:
      'Cada reporte trae `descripcion`, `columnas` y `registros` (un objeto por fila, con los nombres de la API de YouTube Analytics). ' +
      '`glosario` traduce cada columna. `avance_video` (elapsedVideoTimeRatio) va de 0 a 1 y `audiencia_que_sigue` es la fracción de la audiencia que sigue viendo en ese punto.',
    glosario: COLUMN_LABELS,
    reportes: Object.fromEntries(
      Object.entries(bundle.reports).map(([id, report]) => [
        id,
        {
          titulo: report.label,
          columnas: report.columns,
          registros: toRecords(report),
          ...(report.skippedMetrics?.length ? { metricas_no_disponibles: report.skippedMetrics } : {}),
          ...(report.notes?.length ? { avisos: report.notes } : {}),
        },
      ]),
    ),
    ...(Object.keys(bundle.errors).length ? { reportes_con_error: bundle.errors } : {}),
    ...(extractedVideos.length ? { videos_extraidos: extractedVideos } : {}),
  };
}
