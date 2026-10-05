type Cell = string | number | boolean | null | undefined;

/**
 * CSV compatible con Excel. Los textos que empiezan por = + - @ se prefijan con ' para evitar
 * inyección de fórmulas (los títulos y descripciones vienen de YouTube, no son de confianza).
 */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const escape = (value: Cell): string => {
    if (value == null) return '';
    let text = String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  // BOM para que Excel abra el UTF-8 con tildes correctamente (solo CSV).
  const body = mime.startsWith('text/csv') ? `﻿${content}` : content;
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'canal';
