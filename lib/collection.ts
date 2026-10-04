import type { Collection, Dragon, Mode, Status } from './types';
export function rankChange(current: number, previous?: number): number | null {
  return previous === undefined ? null : previous - current;
}
export function parseCollection(value: unknown): Collection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The backup must contain a dragon collection.');
  const collection: Collection = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!/^\d+$/.test(id) || Number(id) <= 0 || !raw || typeof raw !== 'object') throw new Error('Invalid dragon in backup.');
    const item = raw as Record<string, unknown>;
    if (!['owned', 'acquired', 'summon'].includes(String(item.status))) throw new Error('Invalid collection status.');
    if (item.acquiredAt !== null && item.acquiredAt !== undefined && (typeof item.acquiredAt !== 'string' || !Number.isFinite(Date.parse(item.acquiredAt)))) throw new Error('Invalid acquisition date.');
    collection[id] = { status: item.status as Status, acquiredAt: typeof item.acquiredAt === 'string' ? item.acquiredAt : null };
  }
  if (Object.keys(collection).length > 10000) throw new Error('Backup is too large.');
  return collection;
}
export function filterDragons(dragons: Dragon[], collection: Collection, options: {query: string; list: string; rarity: string; element: string; mode: Mode; changesOnly: boolean; previous: Record<string, Record<Mode, number>>}) {
  const query = options.query.trim().toLowerCase();
  return dragons.filter(d => {
    const item = collection[d.id];
    return (!query || `${d.name} ${d.family} ${d.skills.join(' ')}`.toLowerCase().includes(query)) &&
      (options.list === 'all' || (options.list === 'tracked' ? !!item : options.list === 'owned' ? item?.status === 'owned' || item?.status === 'acquired' : item?.status === options.list)) &&
      (!options.rarity || d.rarity === options.rarity) && (!options.element || d.elements.includes(options.element)) &&
      (!options.changesOnly || (options.previous[d.id] !== undefined && options.previous[d.id][options.mode] !== d.ranks[options.mode]));
  }).sort((a,b) => a.ranks[options.mode] - b.ranks[options.mode] || a.id - b.id);
}
