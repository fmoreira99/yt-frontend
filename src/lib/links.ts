import { useMemo } from 'react';
import { api } from './api';
import { CHANNEL_PROVIDER } from './channels';
import { useQuery } from './hooks';
import type { LinkKind } from './types';

export interface ChannelChoice {
  id: string;
  name: string;
  /** Conectado con Google: seguro que es un canal propio. */
  connected: boolean;
}

/** Canales entre los que se puede elegir (monitoreados + conectados), los de Google primero. */
export function useChannelChoices() {
  const accounts = useQuery(() => api.coreAccounts());
  const youtube = useQuery(() => api.youtubeAccounts());

  const choices = useMemo(() => {
    const byId = new Map<string, ChannelChoice>();
    for (const a of accounts.data?.data ?? []) {
      if (a.provider === CHANNEL_PROVIDER) byId.set(a.external_id, { id: a.external_id, name: a.name ?? a.external_id, connected: false });
    }
    for (const y of youtube.data?.data.accounts ?? []) {
      byId.set(y.channelId, { id: y.channelId, name: y.channelTitle, connected: true });
    }
    return [...byId.values()].sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name));
  }, [accounts.data, youtube.data]);

  return { choices, loading: accounts.loading || youtube.loading, error: accounts.error };
}

/** Vincula cada referencia a cada canal propio (en tandas pequeñas para no saturar al core). */
export async function linkAll(targets: string[], kind: Exclude<LinkKind, 'used'>, refs: string[]): Promise<void> {
  const pairs = targets.flatMap((target) => refs.map((ref) => [target, ref] as const));
  for (let i = 0; i < pairs.length; i += 4) {
    await Promise.all(pairs.slice(i, i + 4).map(([target, ref]) => api.link(target, kind, ref)));
  }
}
