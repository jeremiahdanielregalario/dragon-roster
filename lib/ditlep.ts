import { modes, type Dragon, type Mode, type Snapshot } from './types';

export const SOURCE = 'https://www.ditlep.com/dragon/rank';
const rankKeys: Record<Mode, string> = { overall: 'globalRank', damage: 'damageRank', tank: 'tankRank', support: 'supportRank', arena: 'arenaRank' };
function numeric(value: unknown, label: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) throw new Error(`Invalid source ${label}`);
  return value;
}
export function normalizeDragon(value: unknown): Dragon {
  if (!value || typeof value !== 'object') throw new Error('Invalid dragon record');
  const d = value as Record<string, any>;
  if (!d.name || typeof d.name !== 'string' || !d.rank?.breakdown) throw new Error('Source ranking fields changed');
  const ranks = {} as Dragon['ranks']; const scores = {} as Dragon['scores'];
  for (const mode of modes) {
    ranks[mode] = numeric(d.rank[rankKeys[mode]], `${mode} rank`, 1);
    scores[mode] = numeric(d.rank[`${mode}Score`], `${mode} score`);
  }
  const b = d.rank.breakdown;
  const imagePath = typeof d.image === 'string' && /^dragons\/ui_[\w-]+$/.test(d.image) ? d.image.replace('dragons/ui', 'dragons/HD/thumb') : '';
  return {
    id: numeric(d.typeId, 'id', 1), name: d.name, slug: d.urlName || '',
    image: imagePath ? `https://dci-static-s1.socialpointgames.com/static/dragoncity/mobile/ui/${imagePath}_3.png` : '',
    rarity: String(d.rarity), elements: Array.isArray(d.elements) ? d.elements.map(String) : [],
    category: numeric(d.category, 'category'), family: String(d.familyName || ''),
    summonOrbs: numeric(d.seedsToSummon ?? 0, 'summon orbs'),
    skills: Array.isArray(d.skills) ? d.skills.map((s: any) => String(s.name || '')).filter(Boolean) : [],
    warnings: Array.isArray(d.rank.warnings) ? d.rank.warnings.map(String) : [],
    confidence: numeric(d.rank.confidence, 'confidence'), ranks, scores,
    stats: { attack: numeric(b.attack, 'attack'), life: numeric(b.life, 'life'), move: numeric(b.moveExpectedValue, 'move'), speed: numeric(b.speed, 'speed'), sustain: numeric(b.sustainDefense, 'sustain'), utility: numeric(b.utility, 'utility') }
  };
}
export function validateDataset(dragons: Dragon[], expected: number, previousCount = 0) {
  if (!Number.isInteger(expected) || expected < 1 || dragons.length !== expected || new Set(dragons.map(d => d.id)).size !== expected) throw new Error('Source returned an incomplete or duplicate ranking list');
  if (previousCount && dragons.length < previousCount * 0.9) throw new Error('Source unexpectedly lost more than 10% of dragons; keeping the previous snapshot');
}
export async function fetchRankings(previousCount = 0): Promise<Snapshot> {
  const dragons: Dragon[] = []; let total = 0; const pageSize = 2500;
  // One bounded request normally covers the entire source. Paginate if the source grows or caps pageSize.
  const signal = AbortSignal.timeout(45000);
  let effectivePageSize = pageSize;
  for (let page = 0; page < 30; page++) {
    const response = await fetch('https://www.ditlep.com/Dragon/Search', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ dragonName: '', rarities: [], elements: [], families: [], orderBy: 1, rankingMode: 'overall', page, pageSize: effectivePageSize }),
      cache: 'no-store', signal
    });
    if (!response.ok) throw new Error(`Ditlep responded with HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 1) throw new Error('Ditlep response format changed');
    if (page && total !== data.total) throw new Error('Ranking list changed during refresh; retry later');
    total = data.total;
    if (!data.items.length) break;
    if (!page) effectivePageSize = data.items.length;
    dragons.push(...data.items.map(normalizeDragon));
    if (dragons.length >= total) break;
  }
  validateDataset(dragons, total, previousCount);
  dragons.sort((a, b) => a.ranks.overall - b.ranks.overall || a.id - b.id);
  return { source: SOURCE, fetchedAt: new Date().toISOString(), dragons };
}
