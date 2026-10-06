'use client';

import { useEffect, useRef, useState } from 'react';
import { channelUrl, type Channel } from '@/lib/channels';
import type { StoredResult } from '@/lib/types';
import { Icon } from '../Icon';
import { Button, CopyButton, Tabs } from '../ui';
import { Avatar, StateBadge } from './ChannelCard';
import { AutomationTab } from './AutomationTab';
import { DataTab } from './DataTab';
import { InspirationTab } from './InspirationTab';
import { SummaryTab } from './SummaryTab';
import { VideosTab } from './VideosTab';

export interface TabProps {
  channel: Channel;
  videos: StoredResult[];
  onChanged: () => void;
  onClose: () => void;
}

type TabId = 'summary' | 'videos' | 'inspiration' | 'automation' | 'data';

export function ChannelDrawer({ channel, channels, videos, onClose, onChanged }: TabProps & { channels: Channel[] }) {
  const [tab, setTab] = useState<TabId>('summary');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={channel.name}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-header">
          <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <Avatar channel={channel} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="truncate" style={{ fontSize: 18, lineHeight: '26px' }}>{channel.name}</h2>
              <div className="row" style={{ gap: 4 }}>
                <span className="small muted mono truncate">{channel.id}</span>
                <CopyButton text={channel.id} label="" />
              </div>
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <StateBadge channel={channel} />
                <a href={channelUrl(channel.id)} target="_blank" rel="noreferrer" className="small row" style={{ gap: 4 }}>
                  Abrir en YouTube <Icon name="external" size={12} />
                </a>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Cerrar">
              ✕
            </Button>
          </div>
          <Tabs
            tabs={[
              { id: 'summary', label: 'Resumen' },
              { id: 'videos', label: `Videos${videos.length ? ` (${videos.length})` : ''}` },
              { id: 'inspiration', label: 'Inspiración' },
              { id: 'automation', label: 'Automatización' },
              { id: 'data', label: 'Datos' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </header>

        <div className="drawer-body">
          {tab === 'summary' && <SummaryTab channel={channel} videos={videos} onChanged={onChanged} onClose={onClose} />}
          {tab === 'videos' && <VideosTab channel={channel} videos={videos} onChanged={onChanged} onClose={onClose} />}
          {tab === 'inspiration' && <InspirationTab channel={channel} channels={channels} />}
          {tab === 'automation' && <AutomationTab channel={channel} videos={videos} onChanged={onChanged} onClose={onClose} />}
          {tab === 'data' && <DataTab channel={channel} videos={videos} onChanged={onChanged} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
