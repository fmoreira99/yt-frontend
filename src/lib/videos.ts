import { api } from './api';
import type { StoredResult } from './types';

/** Todas las extracciones guardadas de un canal (de 100 en 100). */
export async function fetchAllVideos(channelId: string): Promise<StoredResult[]> {
  const all: StoredResult[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await api.listResults({ channel_id: channelId, limit: 100, offset });
    all.push(...page.data);
    if (page.data.length < 100) break;
  }
  return all;
}
