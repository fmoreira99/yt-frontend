const number = new Intl.NumberFormat('es');

export const formatNumber = (value: number | null | undefined) => (value == null ? '—' : number.format(value));

export function formatDate(value: string | number | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatMs(ms: number | undefined): string {
  if (ms == null) return '';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });

/** 1.234 -> "1,2 mil"; null -> "—". */
export const formatCompact = (value: number | null | undefined) => (value == null ? '—' : compact.format(value));

/** "hace 3 h" / "en 20 min". Pasado y futuro. */
export function formatRelative(value: string | number | null | undefined): string {
  if (!value) return '—';
  const time = typeof value === 'number' ? value : new Date(value).getTime();
  if (Number.isNaN(time)) return '—';

  const seconds = (time - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  const future = seconds > 0;
  if (abs < 60) return future ? 'en instantes' : 'hace instantes';

  let amount: string;
  if (abs < 3600) amount = `${Math.round(abs / 60)} min`;
  else if (abs < 86_400) amount = `${Math.round(abs / 3600)} h`;
  else if (abs < 30 * 86_400) amount = `${Math.round(abs / 86_400)} d`;
  else return new Date(time).toLocaleDateString('es', { dateStyle: 'medium' });
  return future ? `en ${amount}` : `hace ${amount}`;
}

/** Fecha YYYY-MM-DD (UTC) desplazada `offsetDays` desde hoy. */
export const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
