'use client';

import { avatarHue, channelState, initials, STATE_LABEL, type Channel } from '@/lib/channels';
import { describeCron } from '@/lib/cron';
import { formatCompact, formatRelative } from '@/lib/format';
import { Icon } from '../Icon';
import { Badge, Button } from '../ui';

export function Avatar({ channel, size = 44 }: { channel: Channel; size?: number }) {
  if (channel.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={channel.avatar} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  const hue = avatarHue(channel.id);
  return (
    <span
      className="avatar avatar-initials"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 55% 42%)` }}
      aria-hidden
    >
      {initials(channel.name)}
    </span>
  );
}

const STATE_TONE = { running: 'info', error: 'danger', active: 'success', paused: undefined, connected: 'primary' } as const;

export function StateBadge({ channel }: { channel: Channel }) {
  const state = channelState(channel);
  return (
    <Badge tone={STATE_TONE[state]}>
      {state === 'running' ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> : <span className="dot" />}
      {STATE_LABEL[state]}
    </Badge>
  );
}

export function ChannelCard({
  channel,
  busy,
  onOpen,
  onScan,
  onResume,
  onMonitor,
}: {
  channel: Channel;
  busy: boolean;
  onOpen: () => void;
  onScan: () => void;
  onResume: () => void;
  onMonitor: () => void;
}) {
  const state = channelState(channel);
  const { monitor, connection, stats } = channel;

  let schedule: string;
  if (!monitor) schedule = 'Sin monitoreo automático';
  else if (!monitor.active) schedule = monitor.needsRestore ? 'Programación sin cargar en el extractor' : 'Monitoreo pausado';
  else schedule = `${describeCron(monitor.cron)} · próximo ${formatRelative(monitor.nextRunAt)}`;

  const stop = (handler: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    handler();
  };

  return (
    <article
      className={`card channel-card state-${state}`}
      role="button"
      tabIndex={0}
      aria-label={`${channel.name}: ${STATE_LABEL[state]}. Abrir detalle`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Avatar channel={channel} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="channel-name truncate">{channel.name}</div>
          <div className="small muted truncate">
            {stats.lastPublishedAt ? `Último video ${formatRelative(stats.lastPublishedAt)}` : <span className="mono">{channel.id}</span>}
          </div>
        </div>
        <div className="channel-badges">
          <StateBadge channel={channel} />
          {connection && (
            <Badge tone="primary">
              <Icon name="check" size={12} /> Google
            </Badge>
          )}
        </div>
      </div>

      <div className="channel-stats">
        {stats.videos > 0 ? (
          <>
            <span><strong>{stats.videos}</strong> {stats.videos === 1 ? 'video' : 'videos'}</span>
            <span><strong>{formatCompact(stats.views)}</strong> vistas</span>
            <span><strong>{stats.analyzed}</strong> con IA</span>
          </>
        ) : (
          <span className="muted">Sin videos extraídos todavía</span>
        )}
      </div>

      <div className="row-between" style={{ flexWrap: 'nowrap' }}>
        <span
          className={`small truncate ${monitor?.needsRestore || state === 'error' ? 'text-warn' : 'muted'}`}
          title={state === 'error' && monitor?.lastError ? monitor.lastError : undefined}
        >
          {state === 'error' && monitor?.lastError ? monitor.lastError : schedule}
        </span>
        {!monitor ? (
          <Button size="sm" variant="secondary" loading={busy} onClick={stop(onMonitor)}>
            Monitorear
          </Button>
        ) : monitor.active ? (
          <Button size="sm" variant="secondary" icon="refresh" loading={busy || monitor.running} onClick={stop(onScan)}>
            Escanear
          </Button>
        ) : (
          <Button size="sm" variant="secondary" loading={busy} onClick={stop(onResume)}>
            Reanudar
          </Button>
        )}
      </div>
    </article>
  );
}
