export const SCHEDULE_PRESETS = [
  { id: '30m', label: '30 min', cron: '*/30 * * * *' },
  { id: '1h', label: '1 hora', cron: '0 * * * *' },
  { id: '6h', label: '6 horas', cron: '0 */6 * * *' },
  { id: '1d', label: 'Diario', cron: '0 9 * * *' },
] as const;

export const DEFAULT_CRON = '0 */6 * * *';

const pad = (n: string) => n.padStart(2, '0');

// Cron -> texto ("Cada 6 h"). Si no es un patrón conocido devuelve la expresión tal cual.
export function describeCron(expression: string): string {
  const e = expression.trim().replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;
  if ((m = e.match(/^\*\/(\d+) \* \* \* \*$/))) return `Cada ${m[1]} min`;
  if (e === '0 * * * *') return 'Cada hora';
  if ((m = e.match(/^0 \*\/(\d+) \* \* \*$/))) return `Cada ${m[1]} h`;
  if ((m = e.match(/^(\d{1,2}) (\d{1,2}) \* \* \*$/))) return `Diario ${pad(m[2])}:${pad(m[1])}`;
  return e;
}

export const presetFor = (expression: string) =>
  SCHEDULE_PRESETS.find((p) => p.cron === expression.trim().replace(/\s+/g, ' '));
