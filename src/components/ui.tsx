'use client';

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <div className="row-between card-title">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ghost-danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', icon, loading, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)}
    >
      {loading ? <span className="spinner" /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Badge({ tone, children }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'primary'; children: ReactNode }) {
  return <span className={cx('badge', tone && `badge-${tone}`)}>{children}</span>;
}

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'info' | undefined> = {
  ok: 'success', active: 'success', success: 'success', cache: 'success',
  running: 'info', pending: 'info', stale: 'warning', degraded: 'warning', skipped: 'warning',
  quota_exhausted: 'warning', quota_exceeded: 'warning', circuit_open: 'warning',
  down: 'danger', failed: 'danger', error: 'danger',
};

const STATUS_LABELS: Record<string, string> = {
  success: 'Correcto',
  failed: 'Fallido',
  running: 'En curso',
  pending: 'Pendiente',
  skipped: 'Omitido',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status]}>{label ?? STATUS_LABELS[status] ?? status.replaceAll('_', ' ')}</Badge>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div className="alert alert-danger row-between" role="alert">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function Empty({ icon = 'list', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3 style={{ color: 'var(--text)' }}>{title}</h3>
      {children && <p style={{ maxWidth: '44ch' }}>{children}</p>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string }>; value: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} role="tab" aria-selected={tab.id === value} className="tab" onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={copied ? 'check' : 'copy'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* portapapeles no disponible */
        }
      }}
    >
      {copied ? 'Copiado' : label}
    </Button>
  );
}

export function Pager({ offset, limit, count, onChange }: { offset: number; limit: number; count: number; onChange: (offset: number) => void }) {
  return (
    <div className="row-between">
      <span className="muted small">
        {count ? `Mostrando ${offset + 1}–${offset + count}` : 'Sin más resultados'}
      </span>
      <div className="row">
        <Button size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          Anterior
        </Button>
        <Button size="sm" disabled={count < limit} onClick={() => onChange(offset + limit)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

export function Chips({ items, max = 12 }: { items: string[]; max?: number }) {
  if (!items.length) return null;
  return (
    <div className="chips">
      {items.slice(0, max).map((item) => (
        <span key={item} className="chip">
          {item}
        </span>
      ))}
    </div>
  );
}
