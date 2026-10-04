import { timingSafeEqual } from 'node:crypto';
import { adminClient, synchronize } from '@/lib/server';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
function isCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const supplied = Buffer.from(header); const required = Buffer.from(expected);
  return !!secret && supplied.length === required.length && timingSafeEqual(supplied, required);
}
async function run() {
  try { return Response.json(await synchronize(), {headers: {'Cache-Control': 'no-store'}}); }
  catch (error) { return Response.json({error: error instanceof Error ? error.message : 'Refresh failed. Previous rankings are safe.'}, {status: 503}); }
}
export async function GET(request: Request) {
  if (!isCron(request)) return Response.json({error: 'Unauthorized'}, {status: 401});
  return run();
}
export async function POST(request: Request) {
  const db = adminClient();
  if (!db) return Response.json({error: 'Cloud setup is pending. Follow SETUP.md to enable live refresh.'}, {status: 503});
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const {data, error} = await db.auth.getUser(bearer);
  if (error || !data.user) return Response.json({error: 'Sign in to refresh rankings.'}, {status: 401});
  if (!process.env.OWNER_EMAIL || data.user.email?.toLowerCase() !== process.env.OWNER_EMAIL.toLowerCase()) return Response.json({error: 'Only the tracker owner can refresh the source. Daily checks are automatic.'}, {status: 403});
  return run();
}
