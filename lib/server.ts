import { createClient } from '@supabase/supabase-js';
import seed from '@/data/rankings.json';
import { fetchRankings } from './ditlep';
import type { Rankings, Snapshot, Mode } from './types';

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
export async function readRankings(): Promise<Rankings> {
  const db = adminClient();
  let current = seed as Snapshot; let previous: Snapshot | null = null;
  let storage: Rankings['storage'] = 'bundled'; let warning: string | undefined;
  let checkedAt = current.fetchedAt;
  if (db) {
    const [{data, error}, state] = await Promise.all([
      db.from('ranking_snapshots').select('payload').order('id', { ascending: false }).limit(2),
      db.from('ranking_sync').select('checked_at,last_error').eq('id', 1).single()
    ]);
    if (error || state.error) warning = 'Cloud rankings are unavailable. Showing the bundled snapshot.';
    else {
      if (data?.length) {current = data[0].payload; previous = data[1]?.payload || null; storage = 'cloud';}
      else warning = 'Cloud storage is connected. Sign in and refresh to save your first snapshot.';
      if (state.data?.checked_at) checkedAt = state.data.checked_at;
      if (state.data?.last_error) warning = 'The last source check failed. The last successful rankings are preserved.';
    }
  } else warning = 'Cloud setup is pending. These are real rankings from the bundled snapshot; automatic updates are not active yet.';
  return {...current, previous: Object.fromEntries((previous?.dragons || []).map(d => [d.id, d.ranks])), previousAt: previous?.fetchedAt || null, checkedAt, storage, warning};
}
export async function synchronize() {
  const db = adminClient();
  if (!db) throw new Error('Complete Supabase setup before enabling automatic updates.');
  const token = crypto.randomUUID();
  const { data: claimed, error: claimError } = await db.rpc('claim_ranking_sync', { lease_token: token });
  if (claimError) throw new Error('Database setup is incomplete. Run the migration in the setup guide.');
  if (!claimed) return { updated: false, message: 'Rankings were checked within the last hour, or a refresh is already running.' };
  try {
    const previous = await readRankings();
    const next = await fetchRankings(previous.dragons.length);
    const { data, error } = await db.rpc('finish_ranking_sync', { lease_token: token, snapshot: next });
    if (error) throw new Error('Could not save the new ranking snapshot. Previous rankings are safe.');
    return { updated: data, message: data ? `Updated ${next.dragons.length.toLocaleString()} dragons. A new snapshot was saved.` : 'Checked Ditlep. Rankings have not changed.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Source refresh failed';
    await db.rpc('fail_ranking_sync', { lease_token: token, message: message.slice(0, 500) });
    throw error;
  }
}
export async function historyFor(id: number) {
  const db = adminClient();
  if (!db) return [];
  const {data, error} = await db.rpc('dragon_rank_history', { dragon_id: id });
  if (error) throw new Error('History is temporarily unavailable');
  return data as { fetched_at: string; ranks: Record<Mode, number> }[];
}
