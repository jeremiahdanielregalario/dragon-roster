import { readRankings } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(await readRankings(), {headers: {'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'}});
  } catch {
    return Response.json({error: 'Could not load rankings. Please try again.'}, {status: 503});
  }
}
