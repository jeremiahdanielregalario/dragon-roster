import { historyFor } from '@/lib/server';
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('id') || '';
  if (!/^\d{1,8}$/.test(raw) || Number(raw) < 1) return Response.json({error: 'Invalid dragon'}, {status: 400});
  try { return Response.json(await historyFor(Number(raw)), {headers: {'Cache-Control': 'public, s-maxage=60'}}); }
  catch { return Response.json({error: 'History could not be loaded.'}, {status: 503}); }
}
