// Upgrade test: migrations that change existing data are run against a database that already has
// approved cards, the way production meets them (the security test starts from an empty one).
// Run: node supabase/tests/upgrade.test.mjs
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { readFileSync, mkdtempSync, readdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = mkdtempSync(join(tmpdir(), 'pp-up-'));
chmodSync(base, 0o777);
const db = new EmbeddedPostgres({ databaseDir: join(base, 'data'), user: 'postgres', password: 'pw', port: 54330, persistent: false });

const A = '00000000-0000-0000-0000-00000000000a';
const ADMIN = '00000000-0000-0000-0000-0000000000ad';
/** The last migration production had before the Museum. */
const BEFORE = '20261005000100';

let pass = 0, fail = 0;
const check = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, '→', JSON.stringify(detail)); } };

async function as(c, uid, sql, params = []) {
  await c.query('begin');
  try {
    await c.query('set local role authenticated');
    await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    const r = await c.query(sql, params);
    await c.query('commit');
    return r;
  } catch (e) { await c.query('rollback'); throw e; }
}
const snapshot = async (c) => (await c.query(`select card->'projects' as p from published_cards where profile_id=$1`, [A])).rows[0].p;

await db.initialise();
await db.start();
const c = new pg.Client({ host: 'localhost', port: 54330, user: 'postgres', password: 'pw', database: 'postgres' });
await c.connect();
try {
  await c.query(readFileSync(join(here, 'stub_supabase.sql'), 'utf8'));
  const migDir = join(here, '..', 'migrations');
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql') && !f.includes('storage')).sort();
  for (const f of files.filter((f) => f < BEFORE)) await c.query(readFileSync(join(migDir, f), 'utf8'));

  // Production before the Museum: an approved card with three projects…
  await c.query(`insert into auth.users (id, email) values ($1,'a@x.test'),($2,'ad@x.test')`, [A, ADMIN]);
  await c.query(`update user_roles set role='admin' where user_id=$1`, [ADMIN]);
  await as(c, A, `insert into profiles (id, username, full_name) values ($1,'jums','Jums')`, [A]);
  await as(c, A, `insert into projects (profile_id, title, github_url, sort_order) values ($1,'Kept','https://github.com/x/kept',0),($1,'Old name','https://github.com/x/renamed',1),($1,'Gone',null,2)`, [A]);
  await as(c, A, `select submit_for_review()`);
  await as(c, ADMIN, `select approve_profile($1)`, [A]);
  // …then edited in the draft: one renamed, one deleted.
  await as(c, A, `update projects set title='New name' where title='Old name'`);
  await as(c, A, `delete from projects where title='Gone'`);
  const rows = Object.fromEntries((await c.query(`select title, id from projects where profile_id=$1`, [A])).rows.map((r) => [r.title, r.id]));

  console.log('upgrade: Museum migrations on existing cards');
  for (const f of files.filter((f) => f >= BEFORE)) await c.query(readFileSync(join(migDir, f), 'utf8'));
  // Running them again (a retry after a partial run in the SQL editor) changes nothing.
  for (const f of files.filter((f) => f.includes('museum_relink') || f.includes('museum_follows_card'))) await c.query(readFileSync(join(migDir, f), 'utf8'));
  const p = await snapshot(c);
  check('the approved card still shows what was approved', p.map((x) => x.title).join() === 'Kept,Old name,Gone', p.map((x) => x.title));
  check('an unchanged project links to its draft row', p[0].id === rows['Kept'], p[0]);
  check('a renamed project links to its draft row by GitHub link', p[1].id === rows['New name'], p[1]);
  check('a project deleted from the draft still gets an id', typeof p[2].id === 'string' && !Object.values(rows).includes(p[2].id), p[2]);

  await as(c, ADMIN, `select admin_save_affiliation('cs-student','CS Student', true)`);
  await as(c, ADMIN, `select set_member_affiliation($1,'cs-student', true)`, [A]);
  const mine = (await as(c, A, `select my_museum() as m`)).rows[0].m;
  check('my_museum offers all three approved projects', mine.access && mine.projects.length === 3, mine);
  for (const x of p) await as(c, A, `select set_museum($1, true)`, [x.id]);
  // The curated Museum (D-130): an offer is a suggestion; the admin features what hangs.
  check('offers alone hang nothing', (await c.query(`select museum_exhibits() as e`)).rows[0].e.length === 0);
  for (const x of p) await as(c, ADMIN, `select admin_feature_project($1, true)`, [x.id]);
  const shown = (await c.query(`select museum_exhibits() as e`)).rows[0].e;
  check('all three hang in the Museum once featured, as approved', shown.map((e) => e.project.title).sort().join() === 'Gone,Kept,Old name', shown);

  await as(c, A, `select submit_for_review()`);
  await as(c, ADMIN, `select approve_profile($1)`, [A]);
  const after = (await c.query(`select museum_exhibits() as e`)).rows[0].e.map((e) => e.project.title).sort().join();
  check('re-approval keeps renamed and unchanged exhibits, drops the deleted one', after === 'Kept,New name', after);
} catch (e) {
  fail++;
  console.log('  ✗ upgrade crashed →', e.message);
} finally {
  await c.end();
  await db.stop();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
