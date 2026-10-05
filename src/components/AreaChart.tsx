'use client';

import { useEffect, useRef, useState } from 'react';

export interface ChartPoint {
  /** YYYY-MM-DD */
  x: string;
  y: number;
}

const HEIGHT = 220;
const PAD = { left: 48, right: 20, top: 16, bottom: 28 };

const dayLabel = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('es');

/** Escala "agradable": 4 intervalos con paso 1/2/5 × 10^n. */
function scale(max: number): { step: number; top: number } {
  if (max <= 0) return { step: 1, top: 4 };
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  return { step, top: step * 4 };
}

/**
 * Serie temporal de una sola métrica: línea de 2 px, relleno al 10 %, cuadrícula recesiva,
 * cursor vertical con tooltip (también con teclado) y vista de tabla.
 */
export function AreaChart({
  points,
  label,
  format = (v) => full.format(v),
  loading,
}: {
  points: ChartPoint[];
  label: string;
  format?: (value: number) => string;
  loading?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const count = points.length;
  if (count === 0) return <div className="chart-empty muted">Sin datos en este periodo</div>;

  const { step, top } = scale(Math.max(...points.map((p) => p.y)));
  const innerWidth = width - PAD.left - PAD.right;
  const x = (i: number) => PAD.left + (count === 1 ? innerWidth / 2 : (i / (count - 1)) * innerWidth);
  const y = (value: number) => PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom);
  const baseline = y(0);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = `${line} L${x(count - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const xTicks = [...new Set([0, 1, 2, 3, 4].map((k) => Math.round((k * (count - 1)) / 4)))];
  const last = points[count - 1];
  const active = hover !== null ? points[hover] : null;

  const indexFromPointer = (clientX: number, rect: DOMRect) => {
    const ratio = (clientX - rect.left - PAD.left) / innerWidth;
    return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
  };

  return (
    <div ref={wrapRef} className="viz chart" style={{ opacity: loading ? 0.5 : 1 }}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${label}: ${points.length} días, último valor ${format(last.y)}`}
        tabIndex={0}
        onPointerMove={(e) => setHover(indexFromPointer(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? count - 1) - 1));
          else if (e.key === 'ArrowRight') setHover((h) => Math.min(count - 1, (h ?? count - 1) + 1));
          else if (e.key === 'Escape') setHover(null);
          else return;
          e.preventDefault();
        }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="chart-axis">
              {compact.format(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'} className="chart-axis">
            {dayLabel.format(new Date(`${points[i].x}T00:00:00Z`))}
          </text>
        ))}

        <path d={area} className="chart-area" />
        <path d={line} className="chart-line" />

        {active && hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={baseline} className="chart-cursor" />
            <circle cx={x(hover)} cy={y(active.y)} r={5} className="chart-dot" />
          </g>
        ) : (
          <g>
            <circle cx={x(count - 1)} cy={y(last.y)} r={5} className="chart-dot" />
            <text x={x(count - 1) - 10} y={y(last.y) - 12} textAnchor="end" className="chart-end-label">
              {format(last.y)}
            </text>
          </g>
        )}
      </svg>

      {active && hover !== null && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(width - 150, Math.max(0, x(hover) - 70)), top: 0 }}
          role="status"
        >
          <strong>{format(active.y)}</strong>
          <span className="small muted">
            <i className="line-key" /> {label}
          </span>
          <span className="small muted">{dayLong.format(new Date(`${active.x}T00:00:00Z`))}</span>
        </div>
      )}

      <details className="chart-table">
        <summary className="small muted">Ver como tabla</summary>
        <div className="table-wrap" style={{ maxHeight: 220 }}>
          <table>
            <thead>
              <tr>
                <th>Día</th>
                <th className="right">{label}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.x}>
                  <td>{p.x}</td>
                  <td className="right">{format(p.y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
