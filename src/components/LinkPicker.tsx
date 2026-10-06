'use client';

import { useChannelChoices } from '@/lib/links';
import { Badge, Field, Spinner } from './ui';

/** Casillas para elegir a qué canales propios vincular (opcional). */
export function LinkPicker({
  value,
  onChange,
  label = 'Vincular a mis canales (opcional)',
  hint,
  exclude = [],
  layout = 'row',
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  hint?: string;
  exclude?: string[];
  layout?: 'row' | 'column';
}) {
  const { choices, loading } = useChannelChoices();
  const list = choices.filter((c) => !exclude.includes(c.id));

  if (!list.length) {
    return loading ? <Spinner label="Cargando canales…" /> : null;
  }

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Field label={label} hint={hint}>
      <div className={layout === 'column' ? 'stack-sm' : 'row'} style={layout === 'column' ? undefined : { gap: 16 }}>
        {list.map((c) => (
          <label key={c.id} className="check">
            <input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id)} />
            {c.name}
            {c.connected && <Badge tone="primary">Google</Badge>}
          </label>
        ))}
      </div>
    </Field>
  );
}
