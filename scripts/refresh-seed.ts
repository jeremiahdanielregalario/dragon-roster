import { writeFile } from 'node:fs/promises';
import { fetchRankings } from '../lib/ditlep';
const snapshot = await fetchRankings();
await writeFile(new URL('../data/rankings.json', import.meta.url), JSON.stringify(snapshot));
console.log(`Saved ${snapshot.dragons.length} real dragons, fetched ${snapshot.fetchedAt}`);
