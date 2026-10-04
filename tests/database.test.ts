import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('database isolates accounts, protects ranking writes, throttles sync, and retains history atomically', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');`);
    await db.exec(await readFile(new URL('../supabase/migrations/001_tracker.sql',import.meta.url),'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
      insert into public.dragon_collection(user_id,dragon_id,status) values ('11111111-1111-1111-1111-111111111111',3496,'owned');`);
    await assert.rejects(db.exec(`insert into public.dragon_collection(user_id,dragon_id,status) values ('22222222-2222-2222-2222-222222222222',3496,'owned')`));
    await assert.rejects(db.exec(`select public.claim_ranking_sync('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')`));
    await assert.rejects(db.exec(`select * from public.ranking_snapshots`));
    await db.exec(`set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222'`);
    assert.equal((await db.query('select * from public.dragon_collection')).rows.length,0);
    await db.exec(`update public.dragon_collection set status='summon'; delete from public.dragon_collection; reset role;`);
    assert.equal((await db.query<{status:string}>('select status from public.dragon_collection')).rows[0].status,'owned');
    await db.exec(`set role anon`);
    await assert.rejects(db.exec(`select * from public.dragon_collection`));
    await db.exec(`reset role; set role service_role;`);
    const token='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const other='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const claim=async(t:string)=>(await db.query<{ok:boolean}>('select public.claim_ranking_sync($1) as ok',[t])).rows[0].ok;
    assert.equal(await claim(token),true);assert.equal(await claim(other),false);
    const snapshot={fetchedAt:'2026-10-03T00:00:00Z',source:'https://www.ditlep.com/dragon/rank',dragons:[{id:3496,ranks:{overall:1,damage:3,tank:25,support:7,arena:5}}]};
    await assert.rejects(db.query('select public.finish_ranking_sync($1,$2)',[other,JSON.stringify(snapshot)]));
    await db.query('select public.finish_ranking_sync($1,$2)',[token,JSON.stringify(snapshot)]);
    assert.equal(await claim(token),false);
    await db.exec(`update public.ranking_sync set checked_at=now()-interval '2 hours'`);
    assert.equal(await claim(token),true);
    await db.query('select public.finish_ranking_sync($1,$2)',[token,JSON.stringify({...snapshot,fetchedAt:'2026-10-04T00:00:00Z'})]);
    assert.equal((await db.query('select * from public.ranking_snapshots')).rows.length,1,'Unchanged data must not create duplicate history');
    await db.exec(`update public.ranking_sync set checked_at=now()-interval '2 hours'`);
    assert.equal(await claim(token),true);
    await db.query('select public.fail_ranking_sync($1,$2)',[token,'Source unavailable']);
    assert.equal(await claim(other),false,'Failures must impose a retry cooldown');
    assert.equal((await db.query('select * from public.ranking_snapshots')).rows.length,1,'Failure must preserve data');
    for(let i=2;i<=32;i++) {
      await db.exec(`update public.ranking_sync set checked_at=null,lease_until=null`);
      assert.equal(await claim(token),true);
      const next={...snapshot,dragons:[{...snapshot.dragons[0],ranks:{...snapshot.dragons[0].ranks,overall:i}}]};
      await db.query('select public.finish_ranking_sync($1,$2)',[token,JSON.stringify(next)]);
    }
    assert.equal((await db.query('select * from public.ranking_snapshots')).rows.length,30);
    const history=await db.query<{ranks:{overall:number}}>('select * from public.dragon_rank_history(3496)');
    assert.equal(history.rows.length,30);assert.equal(history.rows.at(-1)?.ranks.overall,32);
  } finally {await db.close();}
});
