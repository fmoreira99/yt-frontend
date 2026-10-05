import Link from 'next/link';

const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('es');

/** Magnitud por categoría: barras de un solo tono, valor en la punta. */
export function BarList({ items }: { items: Array<{ id: string; label: string; value: number; href?: string }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="barlist viz">
      {items.map((item) => (
        <li key={item.id} title={`${item.label}: ${full.format(item.value)}`}>
          <div className="bl-label truncate">
            {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
          </div>
          <div className="bl-row">
            <div className="bl-track">
              <div className="bl-fill" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
            </div>
            <span className="bl-value">{compact.format(item.value)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
