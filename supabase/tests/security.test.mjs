// Proves the security rules in the init migration on a throwaway Postgres.
// Run: node supabase/tests/security.test.mjs   (needs `embedded-postgres` and `pg` installed)
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { readFileSync, mkdtempSync, readdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = mkdtempSync(join(tmpdir(), 'pp-pg-'));
chmodSync(base, 0o777); // initdb runs as a separate postgres user when invoked as root
const dir = join(base, 'data');
const db = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54329, persistent: false });

const A = '00000000-0000-0000-0000-00000000000a'; // member
const B = '00000000-0000-0000-0000-00000000000b'; // another member
const ADMIN = '00000000-0000-0000-0000-0000000000ad';
const IMG = '11111111-2222-3333-4444-555555555555.webp'; // storage file name: <uuid>.<ext>

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log('  ✓', name); };
const bad = (name, e) => { fail++; console.log('  ✗', name, '→', e?.message ?? e); };

async function as(client, uid, sql, params = []) {
  await client.query('begin');
  try {
    if (uid === 'anon') await client.query('set local role anon');
    else { await client.query('set local role authenticated'); await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]); }
    const r = await client.query(sql, params);
    await client.query('commit');
    return r;
  } catch (e) { await client.query('rollback'); throw e; }
}
async function expectOk(client, name, uid, sql, params, check) {
  try { const r = await as(client, uid, sql, params); if (check && !check(r)) throw new Error('check failed: ' + JSON.stringify(r.rows)); ok(name); }
  catch (e) { bad(name, e); }
}
// Checks as the database owner (sees every row), for asserting what functions wrote.
async function expectSu(client, name, sql, params, check) {
  try { const r = await client.query(sql, params); if (!check(r)) throw new Error('check failed: ' + JSON.stringify(r.rows)); ok(name); }
  catch (e) { bad(name, e); }
}
async function expectErr(client, name, uid, sql, params, pattern) {
  try { await as(client, uid, sql, params); bad(name, 'expected an error, got success'); }
  catch (e) { pattern.test(e.message) ? ok(name) : bad(name, e); }
}

await db.initialise();
await db.start();
const c = new pg.Client({ host: 'localhost', port: 54329, user: 'postgres', password: 'pw', database: 'postgres' });
await c.connect();
try {
  await c.query(readFileSync(join(here, 'stub_supabase.sql'), 'utf8'));
  const migDir = join(here, '..', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql') && !f.includes('storage')).sort()) {
    await c.query(readFileSync(join(migDir, f), 'utf8'));
  }
  console.log('migration applied');

  // seed three auth users (trigger gives each a member role) and promote ADMIN
  await c.query(`insert into auth.users (id, email) values ($1,'a@x.test'),($2,'b@x.test'),($3,'ad@x.test')`, [A, B, ADMIN]);
  await c.query(`insert into auth.identities (user_id, provider, identity_data) values ($1,'github','{"user_name":"Muj-csv"}')`, [A]);
  await c.query(`update public.user_roles set role='admin' where user_id=$1`, [ADMIN]);

  console.log('drafts and privileges');
  await expectOk(c, 'member creates own draft', A, `insert into profiles (id, username, full_name, bio) values ($1,'muj-csv','Jum Flores','Builds things')`, [A]);
  await expectErr(c, 'member cannot create a draft for someone else', A, `insert into profiles (id, username, full_name) values ($1,'other','X')`, [B], /row-level security/);
  await expectErr(c, 'member cannot insert with status approved', A, `insert into profiles (id, username, full_name, status) values ($1,'sneaky','X','approved')`, [B], /permission denied/);
  await expectErr(c, 'reserved username rejected', B, `insert into profiles (id, username, full_name) values ($1,'admin','B')`, [B], /check constraint/);
  await expectOk(c, 'second member creates own draft', B, `insert into profiles (id, username, full_name) values ($1,'bee','B Member')`, [B]);
  await expectErr(c, 'avatar cannot be an outside URL', A, `update profiles set avatar_path='https://evil.example/me.png' where id=$1`, [A], /check constraint/);
  await expectErr(c, "avatar cannot point into another member's folder", A, `update profiles set avatar_path=$2 where id=$1`, [A, `${B}/${IMG}`], /check constraint/);
  await expectOk(c, 'avatar in own storage folder accepted', A, `update profiles set avatar_path=$2 where id=$1 returning avatar_path`, [A, `${A}/${IMG}`], (r) => r.rows[0].avatar_path === `${A}/${IMG}`);
  await expectErr(c, 'member cannot self-approve (status column)', A, `update profiles set status='approved' where id=$1`, [A], /permission denied/);
  await expectErr(c, 'member cannot self-feature', A, `update profiles set is_featured=true where id=$1`, [A], /permission denied/);
  await expectErr(c, 'member cannot write github_username', A, `update profiles set github_username='someone' where id=$1`, [A], /permission denied/);
  await expectOk(c, 'member cannot read another draft', A, `select * from profiles where id=$1`, [B], (r) => r.rowCount === 0);
  await expectOk(c, 'member update of another draft touches nothing', A, `update profiles set bio='hacked' where id=$1`, [B], (r) => r.rowCount === 0);
  await expectErr(c, 'member cannot grant themselves admin', A, `insert into user_roles (user_id, role) values ($1,'admin')`, [A], /permission denied/);
  await expectErr(c, 'member cannot call build_card directly', A, `select build_card($1)`, [B], /permission denied/);
  await expectErr(c, 'anon cannot read drafts', 'anon', `select * from profiles`, [], /permission denied/);

  console.log('github identity');
  await expectOk(c, 'sync_github_identity copies the verified handle', A, `select sync_github_identity() as gh`, [], (r) => r.rows[0].gh === 'Muj-csv');

  console.log('projects');
  await expectOk(c, 'member adds a github project', A, `insert into projects (profile_id, source, github_repo_id, title, github_url, language) values ($1,'github',101,'AgapAI','https://github.com/Muj-csv/agapai','TypeScript')`, [A]);
  await expectOk(c, 'member adds a manual project', A, `insert into projects (profile_id, title, project_url) values ($1,'Tessera','https://tessera.example.org')`, [A]);
  await expectErr(c, 'github project needs a repo id', A, `insert into projects (profile_id, source, title) values ($1,'github','X')`, [A], /check constraint/);
  await expectErr(c, 'member cannot add a project to another card', A, `insert into projects (profile_id, title) values ($1,'X')`, [B], /row-level security/);
  await expectErr(c, 'http (not https) project URL rejected', A, `insert into projects (profile_id, title, project_url) values ($1,'X','http://x.org')`, [A], /check constraint/);
  await expectErr(c, 'project cover cannot be an outside URL', A, `update projects set cover_path='https://evil.example/c.png' where profile_id=$1`, [A], /check constraint/);
  await expectErr(c, "project cover cannot point into another member's folder", A, `update projects set cover_path=$2 where profile_id=$1`, [A, `${B}/${IMG}`], /check constraint/);
  await expectOk(c, 'project cover in own storage folder accepted', A, `update projects set cover_path=$2 where profile_id=$1 and title='Tessera' returning cover_path`, [A, `${A}/${IMG}`], (r) => r.rowCount === 1);

  console.log('review flow');
  await expectErr(c, 'member cannot approve', A, `select approve_profile($1)`, [A], /NOT_ADMIN/);
  await expectErr(c, 'admin cannot approve a draft that was never submitted', ADMIN, `select approve_profile($1)`, [A], /NOT_PENDING/);
  await expectOk(c, 'member submits for review', A, `select submit_for_review() as s`, [], (r) => r.rows[0].s === 'pending_review');
  await expectErr(c, 'reject needs a note', ADMIN, `select reject_profile($1, '  ')`, [A], /NOTE_REQUIRED/);
  await expectOk(c, 'admin sees pending drafts', ADMIN, `select status from profiles where id=$1`, [A], (r) => r.rows[0].status === 'pending_review');
  await expectOk(c, 'admin approves', ADMIN, `select approve_profile($1)`, [A]);
  await expectOk(c, 'first approval gets member No.1', 'anon', `select member_no from published_cards where profile_id=$1`, [A], (r) => r.rows[0].member_no === 1);
  await expectErr(c, 'member cannot write member_no', A, `update profiles set member_no=99 where id=$1`, [A], /permission denied/);
  await expectErr(c, 'member cannot use the member number sequence', A, `select nextval('member_no_seq')`, [], /permission denied/);
  await expectOk(c, 'anon sees the published card with projects', 'anon', `select card from published_cards where username='muj-csv'`, [], (r) => r.rowCount === 1 && r.rows[0].card.projects.length === 2 && r.rows[0].card.github_username === 'Muj-csv');
  await expectOk(c, 'hidden email stays out of the public card', 'anon', `select card->'public_email' as e from published_cards`, [], (r) => r.rows[0].e === null);
  await expectOk(c, 'public card carries the storage paths', 'anon', `select card from published_cards`, [], (r) => r.rows[0].card.avatar_path === `${A}/${IMG}` && r.rows[0].card.projects.some((p) => p.cover_path === `${A}/${IMG}`) && !('avatar_url' in r.rows[0].card));

  console.log('edits after approval (D-002)');
  await expectOk(c, 'editing an approved card returns it to draft', A, `update profiles set bio='New bio' where id=$1 returning status`, [A], (r) => r.rows[0].status === 'draft');
  await expectOk(c, 'public card still shows the approved bio', 'anon', `select card->>'bio' as bio from published_cards`, [], (r) => r.rows[0].bio === 'Builds things');
  await expectErr(c, 'username is locked after approval', A, `update profiles set username='newname' where id=$1`, [A], /USERNAME_LOCKED/);
  await expectOk(c, 'email opt-in change does not reset review', A, `select submit_for_review()`, []);
  await expectOk(c, 'toggling email_updates keeps pending status', A, `update profiles set email_updates=true where id=$1 returning status`, [A], (r) => r.rows[0].status === 'pending_review');
  await expectOk(c, 'changing the photo returns the card to draft', A, `update profiles set avatar_path=$2 where id=$1 returning status`, [A, `${A}/22222222-3333-4444-5555-666666666666.webp`], (r) => r.rows[0].status === 'draft');
  await as(c, A, `select submit_for_review()`);
  await expectOk(c, 'adding a project returns the card to draft', A, `insert into projects (profile_id, title) values ($1,'DoDoTask')`, [A]);
  await expectOk(c, 'status is draft after project change', A, `select status from profiles where id=$1`, [A], (r) => r.rows[0].status === 'draft');
  for (let i = 0; i < 3; i++) await as(c, A, `insert into projects (profile_id, title) values ($1,$2)`, [A, 'P' + i]);
  await expectErr(c, 'seventh project is refused', A, `insert into projects (profile_id, title) values ($1,'P7')`, [A], /PROJECT_LIMIT/);

  console.log('admin tools');
  await expectErr(c, 'member cannot reject', A, `select reject_profile($1, 'no')`, [B], /NOT_ADMIN/);
  await expectErr(c, 'member cannot unpublish', B, `select unpublish_profile($1)`, [A], /NOT_ADMIN/);
  await expectErr(c, 'member cannot feature', A, `select set_featured($1, true)`, [A], /NOT_ADMIN/);
  await expectErr(c, 'member cannot rename', A, `select admin_set_username($1, 'taken-over')`, [B], /NOT_ADMIN/);
  await expectErr(c, 'anon cannot call moderation functions', 'anon', `select approve_profile($1)`, [A], /permission denied/);
  await expectOk(c, 'admin reads every draft and its projects', ADMIN, `select count(*)::int as n from projects where profile_id=$1`, [A], (r) => r.rows[0].n === 6);
  await expectErr(c, 'feature refuses a card that is not in the hall', ADMIN, `select set_featured($1, true)`, [B], /NOT_PUBLISHED/);
  await expectErr(c, 'unpublish refuses a card that is not in the hall', ADMIN, `select unpublish_profile($1)`, [B], /NOT_PUBLISHED/);
  await expectOk(c, 'refused unpublish leaves the draft alone', ADMIN, `select status, is_featured from profiles where id=$1`, [B], (r) => r.rows[0].status === 'draft' && r.rows[0].is_featured === false);
  await expectErr(c, 'rename refuses a reserved username', ADMIN, `select admin_set_username($1, 'admin')`, [A], /check constraint/);
  await expectErr(c, 'rename of a missing member is refused', ADMIN, `select admin_set_username($1, 'ghost')`, ['00000000-0000-0000-0000-0000000000ff'], /NO_PROFILE/);
  await expectOk(c, 'admin features a card', ADMIN, `select set_featured($1, true)`, [A]);
  await expectOk(c, 'feature shows on the public card', 'anon', `select is_featured, card->>'is_featured' as f from published_cards`, [], (r) => r.rows[0].is_featured === true && r.rows[0].f === 'true');
  await expectOk(c, 'admin renames a locked username', ADMIN, `select admin_set_username($1, 'Sensei')`, [A]);
  await expectOk(c, 'public card follows the rename', 'anon', `select username from published_cards`, [], (r) => r.rows[0].username === 'sensei');
  await expectErr(c, 'rename refuses a username someone has', ADMIN, `select admin_set_username($1, 'sensei')`, [B], /duplicate key/);
  await expectOk(c, 'admin unpublishes', ADMIN, `select unpublish_profile($1)`, [A]);
  await expectOk(c, 'unpublished card is gone for visitors', 'anon', `select * from published_cards`, [], (r) => r.rowCount === 0);
  await expectOk(c, 'second member submits', B, `select submit_for_review()`, []);
  await expectOk(c, 'second member gets member No.2', ADMIN, `select approve_profile($1)`, [B]);
  await expectOk(c, 'No.2 is on their public card', 'anon', `select member_no from published_cards where profile_id=$1`, [B], (r) => r.rows[0].member_no === 2);
  await expectOk(c, 'unpublished member edits and resubmits', A, `update profiles set bio='Back again' where id=$1 returning status`, [A], (r) => r.rows[0].status === 'draft');
  await as(c, A, `select submit_for_review()`);
  await expectOk(c, 're-approval keeps member No.1', ADMIN, `select approve_profile($1)`, [A]);
  await expectOk(c, 'public card shows No.1 again', 'anon', `select member_no from published_cards where profile_id=$1`, [A], (r) => r.rows[0].member_no === 1);
  await expectErr(c, 'anon cannot write public cards', 'anon', `insert into published_cards (profile_id, username, card) values ($1,'x','{}')`, [B], /permission denied/);

  console.log('PIPs (E1)');
  // So far: A was approved with 2 projects, then re-approved with 6; B was approved with none.
  const pips = async (uid) => (await as(c, uid, `select my_pips() as p`)).rows[0].p;
  await expectOk(c, 'approval rewards: A has welcome + 6 projects + 3 achievements = 500', A, `select my_pips() as p`, [], (r) => r.rows[0].p.eligible === true && r.rows[0].p.balance === 500);
  await expectOk(c, 'approval rewards: B has welcome + Card Holder = 150', B, `select my_pips() as p`, [], (r) => r.rows[0].p.balance === 150);
  await expectSu(c, 're-approval never re-grants the welcome reward', `select count(*)::int as n from pip_ledger where member_id=$1 and ref='first_approval'`, [A], (r) => r.rows[0].n === 1);
  await expectOk(c, 'achievements unlocked once each', ADMIN, `select count(*)::int as n from member_achievements where member_id=$1`, [A], (r) => r.rows[0].n === 3);
  await expectErr(c, 'member cannot insert ledger rows', A, `insert into pip_ledger (member_id, amount, reason, ref) values ($1, 1000, 'discover', 'x')`, [A], /permission denied/);
  await expectErr(c, 'member cannot change ledger rows', A, `update pip_ledger set amount = 9999 where member_id=$1`, [A], /permission denied/);
  await expectErr(c, 'member cannot delete ledger rows', A, `delete from pip_ledger where member_id=$1`, [A], /permission denied/);
  await expectErr(c, 'member cannot write discoveries', A, `insert into discoveries (member_id, card_id) values ($1,$2)`, [A, B], /permission denied/);
  await expectErr(c, 'member cannot grant themselves achievements', A, `insert into member_achievements (member_id, key) values ($1,'hall_walker')`, [A], /permission denied/);
  await expectErr(c, 'member cannot call grant_pips', A, `select grant_pips($1, 1000, 'discover', 'hack')`, [A], /permission denied/);
  await expectErr(c, 'member cannot call check_achievements', A, `select check_achievements($1)`, [A], /permission denied/);
  await expectErr(c, 'member cannot call reward_approval', A, `select reward_approval($1)`, [A], /permission denied/);
  await expectErr(c, 'anon cannot discover', 'anon', `select discover_card($1)`, [A], /permission denied/);
  await expectErr(c, 'anon cannot read balances', 'anon', `select my_pips()`, [], /permission denied/);
  await expectErr(c, 'anon cannot read the ledger', 'anon', `select * from pip_ledger`, [], /permission denied/);
  await expectOk(c, "member cannot read another member's ledger", A, `select * from pip_ledger where member_id=$1`, [B], (r) => r.rowCount === 0);
  await expectOk(c, "member cannot see whom another member discovered", A, `select * from discoveries where member_id=$1`, [B], (r) => r.rowCount === 0);
  await expectOk(c, 'achievements of members in the hall are public', 'anon', `select key from member_achievements where member_id=$1`, [A], (r) => r.rowCount === 3);

  await expectOk(c, 'discovering a member grants +5', A, `select discover_card($1) as d`, [B], (r) => r.rows[0].d.granted === true && r.rows[0].d.amount === 5 && r.rows[0].d.balance === 505);
  await expectOk(c, 'discovering them again grants nothing', A, `select discover_card($1) as d`, [B], (r) => r.rows[0].d.granted === false && r.rows[0].d.balance === 505);
  await expectOk(c, 'discovering yourself grants nothing', A, `select discover_card($1) as d`, [A], (r) => r.rows[0].d.granted === false);

  // More members: C stays a draft (not in the hall); M1..M10 get approved.
  const C = '00000000-0000-0000-0000-00000000000c';
  const Ms = Array.from({ length: 10 }, (_, i) => `00000000-0000-0000-0000-0000000001${String(i).padStart(2, '0')}`);
  await c.query(`insert into auth.users (id, email) select unnest($1::uuid[]), 'm' || generate_series(1, $2) || '@x.test'`, [[C, ...Ms], Ms.length + 1]);
  await c.query(`insert into profiles (id, username, full_name, status) select id, 'pipm' || row_number() over (), 'M', 'pending_review' from unnest($1::uuid[]) as id`, [[C, ...Ms]]);
  await c.query(`update profiles set status='draft' where id=$1`, [C]);
  for (const m of Ms) await as(c, ADMIN, `select approve_profile($1)`, [m]);
  await expectOk(c, 'a member not in the hall is not eligible and has 0', C, `select my_pips() as p`, [], (r) => r.rows[0].p.eligible === false && r.rows[0].p.balance === 0);
  await expectOk(c, 'a member not in the hall earns nothing for discovering', C, `select discover_card($1) as d`, [A], (r) => r.rows[0].d.granted === false);
  await expectSu(c, '…and nothing is recorded for them', `select count(*)::int as n from discoveries where member_id=$1`, [C], (r) => r.rows[0].n === 0);
  await expectOk(c, 'discovering a member not in the hall grants nothing', A, `select discover_card($1) as d`, [C], (r) => r.rows[0].d.granted === false);

  // Daily cap: pretend A already earned 95 discovery PIPs today.
  await c.query(`insert into pip_ledger (member_id, amount, reason, ref) select $1, 5, 'discover', 'cap-test-' || i from generate_series(1, 18) as i`, [A]);
  await expectOk(c, 'the discovery that reaches the daily cap of 100 still pays', A, `select discover_card($1) as d`, [Ms[0]], (r) => r.rows[0].d.amount === 5);
  await expectOk(c, 'past the daily cap a discovery pays 0…', A, `select discover_card($1) as d`, [Ms[1]], (r) => r.rows[0].d.granted === false && r.rows[0].d.new === true);
  await expectSu(c, '…but still counts toward achievements', `select count(*)::int as n from discoveries where member_id=$1`, [A], (r) => r.rows[0].n === 3);
  for (const m of Ms.slice(2, 8)) await as(c, A, `select discover_card($1)`, [m]);
  await expectOk(c, 'the 10th discovery unlocks Explorer (+100) once', A, `select discover_card($1) as d`, [Ms[8]], (r) => r.rows[0].d.unlocked.includes('explorer'));
  await expectSu(c, 'Explorer is recorded once', `select count(*)::int as n from pip_ledger where member_id=$1 and ref='achievement:explorer'`, [A], (r) => r.rows[0].n === 1);

  // Backfill and caps run through reward_approval (the migration calls it for every card in the hall).
  await c.query(`delete from pip_ledger where member_id=$1`, [Ms[9]]);
  await c.query(`delete from member_achievements where member_id=$1`, [Ms[9]]);
  await c.query(`select reward_approval($1)`, [Ms[9]]);
  await c.query(`select reward_approval($1)`, [Ms[9]]);
  await expectOk(c, 'backfill gives an approved member their rewards exactly once', Ms[9], `select my_pips() as p`, [], (r) => r.rows[0].p.balance === 150);
  await c.query(`insert into pip_ledger (member_id, amount, reason, ref) select $1, 25, 'project_live', 'cap-proj-' || i from generate_series(1, 12) as i`, [Ms[9]]);
  await c.query(`insert into projects (profile_id, title) values ($1, 'Thirteenth')`, [Ms[9]]);
  await c.query(`select reward_approval($1)`, [Ms[9]]);
  await expectSu(c, 'project rewards stop at 12 per member', `select count(*)::int as n from pip_ledger where member_id=$1 and reason='project_live'`, [Ms[9]], (r) => r.rows[0].n === 12);

  await as(c, ADMIN, `select unpublish_profile($1)`, [Ms[0]]);
  await expectOk(c, 'an unpublished member keeps their PIPs but stops earning', Ms[0], `select my_pips() as p`, [], (r) => r.rows[0].p.eligible === false && r.rows[0].p.balance === 150);
  await expectOk(c, "an unpublished member's achievements are no longer public", 'anon', `select * from member_achievements where member_id=$1`, [Ms[0]], (r) => r.rowCount === 0);

  console.log('Museum and affiliations');
  await expectErr(c, 'member cannot create affiliations', A, `select admin_save_affiliation('cs-student','CS Student', true)`, [], /NOT_ADMIN/);
  await expectErr(c, 'member cannot write affiliations directly', A, `insert into affiliations (key, name) values ('x','X')`, [], /permission denied/);
  await expectOk(c, 'admin creates a Museum affiliation', ADMIN, `select admin_save_affiliation('cs-student','CS Student', true)`, []);
  await expectOk(c, 'admin creates an org affiliation', ADMIN, `select admin_save_affiliation('org','Org Member', false)`, []);
  await expectErr(c, 'affiliation keys are checked', ADMIN, `select admin_save_affiliation('Bad Key!','X', false)`, [], /check constraint/);
  await expectOk(c, 'anyone can read the affiliation list', 'anon', `select key from affiliations order by sort`, [], (r) => r.rows.map((x) => x.key).join() === 'cs-student,org');
  await expectErr(c, 'member cannot grant themselves an affiliation', A, `select set_member_affiliation($1,'cs-student', true)`, [A], /NOT_ADMIN/);
  await expectErr(c, 'member cannot insert member_affiliations', A, `insert into member_affiliations (member_id, key) values ($1,'cs-student')`, [A], /permission denied/);
  await expectOk(c, 'snapshots carry project ids', 'anon', `select card->'projects' as p from published_cards where profile_id=$1`, [A], (r) => r.rows[0].p.length > 0 && r.rows[0].p.every((x) => typeof x.id === 'string'));
  const liveA = (await c.query(`select (card->'projects'->0->>'id') as id from published_cards where profile_id=$1`, [A])).rows[0].id;
  await expectErr(c, 'without Museum access a member cannot exhibit', A, `select set_museum($1, true)`, [liveA], /NO_MUSEUM_ACCESS/);
  await expectOk(c, 'admin grants CS Student to A', ADMIN, `select set_member_affiliation($1,'cs-student', true)`, [A]);
  await expectOk(c, 'affiliation chips are public for members in the hall', 'anon', `select key from member_affiliations where member_id=$1`, [A], (r) => r.rows[0]?.key === 'cs-student');
  await expectOk(c, 'my_museum reports access and live projects', A, `select my_museum() as m`, [], (r) => r.rows[0].m.access === true && r.rows[0].m.live.includes(liveA) && r.rows[0].m.entries.length === 0);
  await expectOk(c, 'a member with access exhibits a live project', A, `select set_museum($1, true) as on`, [liveA], (r) => r.rows[0].on === true);
  await expectOk(c, 'visitors see the exhibit as approved', 'anon', `select museum_exhibits() as e`, [], (r) => r.rows[0].e.length === 1 && r.rows[0].e[0].project.id === liveA && r.rows[0].e[0].username === 'sensei');
  await c.query(`insert into projects (profile_id, title) values ($1, 'Not yet approved')`, [B]);
  const bProj = (await c.query(`select id from projects where profile_id=$1 limit 1`, [B])).rows[0].id;
  await expectErr(c, "a member cannot exhibit someone else's project", A, `select set_museum($1, true)`, [bProj], /NOT_YOURS/);
  await as(c, A, `delete from projects where id = (select id from projects where profile_id=$1 and id <> $2 order by sort_order desc limit 1)`, [A, liveA]); // make room (max 6)
  const draftA = (await as(c, A, `insert into projects (profile_id, title) values ($1, 'Draft only') returning id`, [A])).rows[0].id;
  await expectErr(c, 'a project not in the approved card cannot be exhibited', A, `select set_museum($1, true)`, [draftA], /NOT_LIVE/);
  await expectErr(c, 'anon cannot exhibit', 'anon', `select set_museum($1, true)`, [liveA], /permission denied/);
  await expectErr(c, 'anon cannot read anyone’s museum settings', 'anon', `select my_museum()`, [], /permission denied/);
  await expectOk(c, "members can't see others' museum opt-ins", B, `select * from museum_entries`, [], (r) => r.rowCount === 0);
  await expectOk(c, 'removing the affiliation hides the exhibit', ADMIN, `select set_member_affiliation($1,'cs-student', false)`, [A]);
  await expectOk(c, '…from visitors', 'anon', `select museum_exhibits() as e`, [], (r) => r.rows[0].e.length === 0);
  await expectOk(c, 'granting it again brings the exhibit back', ADMIN, `select set_member_affiliation($1,'cs-student', true)`, [A]);
  await expectOk(c, '…for visitors', 'anon', `select jsonb_array_length(museum_exhibits()) as n`, [], (r) => r.rows[0].n === 1);
  await expectOk(c, 'a member can take a project out of the Museum', A, `select set_museum($1, false) as on`, [liveA], (r) => r.rows[0].on === false);
  await expectOk(c, 'deleting an affiliation removes it from members', ADMIN, `select admin_delete_affiliation('cs-student')`, []);
  await expectOk(c, '…and its chips are gone', 'anon', `select * from member_affiliations where member_id=$1`, [A], (r) => r.rowCount === 0);

  // Cards approved before the Museum whose projects were renamed afterwards (20261005000200).
  const rowIds = new Set((await c.query(`select id from projects where profile_id=$1`, [A])).rows.map((r) => r.id));
  // A project deleted from the draft since approval has no row to link to, so it stays without an id.
  const idsBefore = (await c.query(`select card->'projects' as p from published_cards where profile_id=$1`, [A])).rows[0].p.map((x) => (rowIds.has(x.id) ? x.id : null));
  await c.query(`update published_cards set card = jsonb_set(card, '{projects}', (select jsonb_agg(e - 'id' order by n) from jsonb_array_elements(card->'projects') with ordinality t(e, n))) where profile_id=$1`, [A]);
  await c.query(`update projects set title = 'Renamed after approval' where profile_id=$1 and github_url is not null`, [A]);
  await c.query(`update projects set title = upper(title) || '  ' where profile_id=$1 and github_url is null`, [A]);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261005000200_museum_relink.sql'), 'utf8'));
  await expectSu(c, 'relink matches renamed projects by link, and titles ignoring case and spaces', `select card->'projects' as p from published_cards where profile_id=$1`, [A],
    (r) => r.rows[0].p.map((x) => x.id).join() === idsBefore.join() && idsBefore.filter(Boolean).length >= 2);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261005000200_museum_relink.sql'), 'utf8'));
  await expectSu(c, 'relink is safe to run twice', `select card->'projects' as p from published_cards where profile_id=$1`, [A], (r) => r.rows[0].p.map((x) => x.id).join() === idsBefore.join());

  // The Museum follows the approved card, not the draft (20261005000300, D-071).
  await as(c, ADMIN, `select admin_save_affiliation('cs-student','CS Student', true)`);
  await as(c, ADMIN, `select set_member_affiliation($1,'cs-student', true)`, [A]);
  const linked = idsBefore.filter(Boolean);
  await expectOk(c, 'my_museum lists approved projects with their approved titles', A, `select my_museum() as m`, [],
    (r) => r.rows[0].m.projects.some((p) => p.title === 'AgapAI') && !r.rows[0].m.projects.some((p) => p.title === 'Renamed after approval'));
  await expectOk(c, 'a member exhibits two approved projects', A, `select set_museum($1, true), set_museum($2, true)`, [linked[0], linked[1]]);
  await as(c, A, `delete from projects where id=$1`, [linked[0]]);
  await expectOk(c, 'deleting a draft project leaves its approved exhibit in the Museum', 'anon', `select jsonb_array_length(museum_exhibits()) as n`, [], (r) => r.rows[0].n === 2);
  await expectOk(c, '…and it can still be taken out', A, `select set_museum($1, false) as on`, [linked[0]], (r) => r.rows[0].on === false);
  await as(c, A, `select set_museum($1, true)`, [linked[0]]);
  await as(c, A, `select submit_for_review()`);
  await as(c, ADMIN, `select approve_profile($1)`, [A]);
  await expectSu(c, 'approval drops the exhibit whose project left the card, keeps the rest', `select project_id from museum_entries where member_id=$1`, [A], (r) => r.rowCount === 1 && r.rows[0].project_id === linked[1]);
  await expectOk(c, '…and the Museum shows only what is on the approved card', 'anon', `select museum_exhibits() as e`, [], (r) => r.rows[0].e.length === 1 && r.rows[0].e[0].project.id === linked[1]);
  await as(c, ADMIN, `select set_featured($1, true)`, [A]);
  await expectOk(c, 'a featured maker\'s exhibits say so, for the pinned row', 'anon', `select museum_exhibits() as e`, [], (r) => r.rows[0].e.every((x) => x.featured === true));
  await as(c, ADMIN, `select set_featured($1, false)`, [A]);
  await expectOk(c, '…and stop saying so once unfeatured', 'anon', `select museum_exhibits() as e`, [], (r) => r.rows[0].e.every((x) => x.featured === false));
  // Console frames (20261006000400, D-091).
  await expectOk(c, 'an exhibit has no console until its maker picks one', 'anon', `select museum_exhibits() as e`, [], (r) => r.rows[0].e[0].console === null);
  await expectErr(c, 'anon cannot pick a console', 'anon', `select set_museum_console($1,'tv')`, [linked[1]], /permission denied/);
  await expectErr(c, "a member cannot pick the console of someone else's exhibit", B, `select set_museum_console($1,'tv')`, [linked[1]], /NOT_IN_MUSEUM/);
  await expectErr(c, 'only the five consoles can be picked', A, `select set_museum_console($1,'gamecube')`, [linked[1]], /BAD_CONSOLE/);
  await expectErr(c, 'a project not in the Museum has no console', A, `select set_museum_console($1,'tv')`, [linked[0]], /NOT_IN_MUSEUM/);
  await expectErr(c, 'members cannot write the console column directly', A, `update museum_entries set console='tv' where project_id=$1`, [linked[1]], /permission denied/);
  const statusBefore = (await c.query(`select status from profiles where id=$1`, [A])).rows[0].status;
  await expectOk(c, 'the maker picks a console', A, `select set_museum_console($1,'arcade') as v`, [linked[1]], (r) => r.rows[0].v === 'arcade');
  await expectOk(c, '…visitors see it on the exhibit', 'anon', `select museum_exhibits() as e`, [], (r) => r.rows[0].e[0].console === 'arcade');
  await expectOk(c, '…and the maker sees it in my_museum', A, `select my_museum() as m`, [], (r) => r.rows[0].m.consoles[linked[1]] === 'arcade');
  await expectOk(c, 'picking a console never sends the card to review', A, `select status from profiles where id=$1`, [A], (r) => r.rows[0].status === statusBefore);
  try { await c.query(`update museum_entries set console='handheld-x' where project_id=$1`, [linked[1]]); bad('the table itself rejects an unknown console', 'expected an error'); }
  catch (e) { /museum_entries_console_check/.test(e.message) ? ok('the table itself rejects an unknown console') : bad('the table itself rejects an unknown console', e); }
  await expectOk(c, 'the maker can go back to automatic', A, `select set_museum_console($1, null) as v`, [linked[1]], (r) => r.rows[0].v === null);
  await expectOk(c, '…and my_museum forgets it', A, `select my_museum() as m`, [], (r) => !(linked[1] in r.rows[0].m.consoles));
  await as(c, A, `select set_museum_console($1,'flip')`, [linked[1]]);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000400_museum_consoles.sql'), 'utf8'));
  await expectOk(c, 'the console migration is safe to run twice and keeps picks', 'anon', `select museum_exhibits() as e`, [], (r) => r.rows[0].e[0].console === 'flip');
  await expectErr(c, 'a member cannot read the admin Museum summary', A, `select admin_museum_summary()`, [], /NOT_ADMIN/);
  await expectErr(c, 'anon cannot read the admin Museum summary', 'anon', `select admin_museum_summary()`, [], /permission denied/);
  await expectOk(c, 'admin Museum summary counts approved projects and exhibits', ADMIN, `select admin_museum_summary() as s`, [],
    (r) => r.rows[0].s.length === 1 && r.rows[0].s[0].username === 'sensei' && r.rows[0].s[0].exhibits === 1 && r.rows[0].s[0].projects >= 1);
  await expectErr(c, 'members cannot write museum entries directly', A, `insert into museum_entries (project_id, member_id) values (gen_random_uuid(), $1)`, [A], /permission denied/);

  console.log('PIP MART (E2)');
  const NOCARD = '00000000-0000-0000-0000-0000000000cc'; // signed in, no card in the hall
  await c.query(`insert into auth.users (id, email) values ($1,'nocard@x.test')`, [NOCARD]);
  await as(c, NOCARD, `insert into profiles (id, username, full_name) values ($1,'nocard','No Card')`, [NOCARD]);
  const balA = Number((await as(c, A, `select my_pips() as p`)).rows[0].p.balance);
  await c.query(`insert into pip_ledger (member_id, amount, reason, ref) values ($1, $2, 'achievement', 'test:topup')`, [A, 500 - balA]);
  await expectErr(c, 'anon cannot buy', 'anon', `select buy_item('meadow')`, [], /permission denied/);
  await expectErr(c, 'anon cannot read anyone’s Mart', 'anon', `select my_mart()`, [], /permission denied/);
  await expectErr(c, 'a member without a card in the hall cannot buy', NOCARD, `select buy_item('meadow')`, [], /NOT_ELIGIBLE/);
  await expectOk(c, '…and their Mart says so', NOCARD, `select my_mart() as m`, [], (r) => r.rows[0].m.eligible === false);
  await expectOk(c, 'anyone can read the catalogue', 'anon', `select key from mart_items order by sort`, [], (r) => r.rows.map((x) => x.key).join() === 'meadow,dusk,pearl,gold');
  await expectErr(c, 'members cannot write the catalogue', A, `update mart_items set price = 1`, [], /permission denied/);
  await expectErr(c, 'members cannot give themselves items', A, `insert into inventory (member_id, item_key) values ($1,'gold')`, [A], /permission denied/);
  await expectErr(c, 'members cannot write their appearance directly', A, `insert into card_appearance (member_id, frame) values ($1,'gold')`, [A], /permission denied/);
  await expectErr(c, 'members cannot write the ledger to pay for things', A, `insert into pip_ledger (member_id, amount, reason, ref) values ($1, 5000, 'purchase', 'x')`, [A], /permission denied/);
  await expectErr(c, 'unknown items cannot be bought', A, `select buy_item('rainbow')`, [], /NO_SUCH_ITEM/);
  await expectOk(c, 'a member in the hall buys a frame they can afford', A, `select buy_item('meadow') as b`, [], (r) => r.rows[0].b.balance === 300);
  await expectSu(c, '…paid with one purchase row in the ledger', `select amount from pip_ledger where member_id=$1 and reason='purchase'`, [A], (r) => r.rowCount === 1 && r.rows[0].amount === -200);
  await expectErr(c, 'the same item cannot be bought twice', A, `select buy_item('meadow')`, [], /ALREADY_OWNED/);
  await expectErr(c, 'an item costing more than the balance is refused', A, `select buy_item('dusk')`, [], /NOT_ENOUGH_PIPS/);
  await expectOk(c, '…and nothing is spent', A, `select my_pips() as p`, [], (r) => r.rows[0].p.balance === 300);
  await c.query(`update mart_items set active = false where key = 'pearl'`);
  await expectErr(c, 'retired items cannot be bought', A, `select buy_item('pearl')`, [], /NO_SUCH_ITEM/);
  await c.query(`update mart_items set active = true where key = 'pearl'`);
  await expectOk(c, 'my_mart shows balance, prices and what I own', A, `select my_mart() as m`, [], (r) => r.rows[0].m.balance === 300 && r.rows[0].m.items.find((i) => i.key === 'meadow').owned === true && r.rows[0].m.items.find((i) => i.key === 'gold').owned === false);
  await expectErr(c, 'a frame not owned cannot be worn', A, `select equip_frame('gold')`, [], /NOT_OWNED/);
  await expectOk(c, 'an owned frame can be worn', A, `select equip_frame('meadow')`, []);
  await expectOk(c, 'visitors see the frame on the badge', 'anon', `select card_appearances() as a`, [], (r) => r.rows[0].a.some((x) => x.profile_id === A && x.frame === 'meadow' && x.label === null));
  await expectOk(c, 'other members cannot read someone’s appearance row', B, `select * from card_appearance`, [], (r) => r.rowCount === 0);
  await expectErr(c, 'a perk frame needs an affiliation that gives one', A, `select equip_frame('member', 'org')`, [], /NO_SUCH_PERK/);
  await expectErr(c, 'members cannot make an affiliation give a frame', A, `select admin_set_affiliation_frame('org', 'member')`, [], /NOT_ADMIN/);
  await expectErr(c, 'only the member frame can be given', ADMIN, `select admin_set_affiliation_frame('org', 'gold')`, [], /NO_SUCH_FRAME/);
  await expectOk(c, 'admin makes an affiliation give the member frame', ADMIN, `select admin_set_affiliation_frame('org', 'member')`, []);
  await expectErr(c, '…which only its members can wear', A, `select equip_frame('member', 'org')`, [], /NO_SUCH_PERK/);
  await as(c, ADMIN, `select set_member_affiliation($1,'org', true)`, [A]);
  await expectOk(c, 'my_mart lists the perk frame', A, `select my_mart() as m`, [], (r) => r.rows[0].m.perks.some((x) => x.key === 'org' && x.label === 'ORG MEMBER'));
  await expectOk(c, 'a member wears their affiliation’s frame for free', A, `select equip_frame('member', 'org')`, []);
  await expectOk(c, 'visitors see the label from the affiliation’s name', 'anon', `select card_appearances() as a`, [], (r) => r.rows[0].a.some((x) => x.profile_id === A && x.frame === 'member' && x.label === 'ORG MEMBER'));
  await expectSu(c, 'a name without MEMBER gets it added once', `select perk_label('Acm') as a, perk_label('CS Student') as b`, [], (r) => r.rows[0].a === 'ACM MEMBER' && r.rows[0].b === 'CS STUDENT MEMBER');
  await expectOk(c, 'perk frames cost nothing', A, `select my_pips() as p`, [], (r) => r.rows[0].p.balance === 300);
  await as(c, ADMIN, `select set_member_affiliation($1,'org', false)`, [A]);
  await expectOk(c, 'losing the affiliation takes the perk frame off the badge', 'anon', `select card_appearances() as a`, [], (r) => !r.rows[0].a.some((x) => x.profile_id === A));
  await expectOk(c, 'taking a frame off works', A, `select equip_frame(null)`, []);
  await expectErr(c, 'anon cannot read the frame check directly', 'anon', `select valid_frame($1)`, [A], /permission denied/);

  console.log('admin-made rewards (D-087)');
  const STYLE = JSON.stringify({ frame: 'plum', hi: 'band', shade: 'ink', trim: 'coin-hi', gap: 3, motion: 'twinkle', doodle: 'dusk' });
  await expectErr(c, 'members cannot design borders', A, `select admin_save_frame('aurora','Aurora','Night lights',300,true,$1::jsonb)`, [STYLE], /NOT_ADMIN/);
  await expectErr(c, 'anon cannot design borders', 'anon', `select admin_save_frame('aurora','Aurora','Night lights',300,true,$1::jsonb)`, [STYLE], /permission denied/);
  await expectErr(c, 'a border style may only name theme tones', ADMIN, `select admin_save_frame('aurora','Aurora','x',300,true,$1::jsonb)`, [JSON.stringify({ ...JSON.parse(STYLE), frame: 'red;background:url(x)' })], /BAD_STYLE/);
  await expectErr(c, '…and known motions', ADMIN, `select admin_save_frame('aurora','Aurora','x',300,true,$1::jsonb)`, [JSON.stringify({ ...JSON.parse(STYLE), motion: 'spin' })], /BAD_STYLE/);
  await expectErr(c, '…with no extra keys', ADMIN, `select admin_save_frame('aurora','Aurora','x',300,true,$1::jsonb)`, [JSON.stringify({ ...JSON.parse(STYLE), css: 'x' })], /BAD_STYLE/);
  await expectErr(c, 'the drawn-in-code frames cannot be overwritten', ADMIN, `select admin_save_frame('gold','Gold','x',300,true,$1::jsonb)`, [STYLE], /BUILT_IN/);
  await expectOk(c, 'admin designs a border for sale', ADMIN, `select admin_save_frame('aurora','Aurora','Night lights',300,true,$1::jsonb)`, [STYLE]);
  await expectOk(c, 'admin designs a reward-only border', ADMIN, `select admin_save_frame('champion','Champion','For winners',1,false,$1::jsonb)`, [JSON.stringify({ ...JSON.parse(STYLE), frame: 'gold', motion: 'flow' })]);
  await expectOk(c, 'the Mart sells the new border with its style', A, `select my_mart() as m`, [], (r) => { const i = r.rows[0].m.items.find((x) => x.key === 'aurora'); return i && i.style.trim === 'coin-hi' && i.for_sale === true; });
  await expectOk(c, '…but not the reward-only one', A, `select my_mart() as m`, [], (r) => !r.rows[0].m.items.some((x) => x.key === 'champion'));
  await expectErr(c, 'a reward-only border cannot be bought', A, `select buy_item('champion')`, [], /NO_SUCH_ITEM/);
  await expectOk(c, 'a designed border can be bought and worn', A, `select buy_item('aurora') as b`, [], (r) => r.rows[0].b.balance === 0);
  await as(c, A, `select equip_frame('aurora')`);
  await expectOk(c, 'visitors see the border with its style', 'anon', `select card_appearances() as a`, [], (r) => r.rows[0].a.some((x) => x.profile_id === A && x.frame === 'aurora' && x.style.motion === 'twinkle'));
  await expectErr(c, 'members cannot retire items', A, `select admin_set_item_active('aurora', false)`, [], /NOT_ADMIN/);
  await expectErr(c, 'members cannot list the admin catalogue', A, `select admin_mart_items()`, [], /NOT_ADMIN/);
  await expectOk(c, 'admins see every border with its style', ADMIN, `select admin_mart_items() as m`, [], (r) => r.rows[0].m.some((x) => x.key === 'champion' && x.for_sale === false));

  await expectErr(c, 'members cannot design badges', A, `select admin_save_badge('mvp','MVP','Most valuable',100,'crown','gold','champion')`, [], /NOT_ADMIN/);
  await expectErr(c, 'a badge needs a known gem', ADMIN, `select admin_save_badge('mvp','MVP','Most valuable',100,'skull','gold',null)`, [], /achievements_gem_check/);
  await expectErr(c, 'a badge reward is capped', ADMIN, `select admin_save_badge('mvp','MVP','Most valuable',999999,'crown','gold',null)`, [], /BAD_REWARD/);
  await expectErr(c, 'a badge can only give a border that exists', ADMIN, `select admin_save_badge('mvp','MVP','Most valuable',100,'crown','gold','nope')`, [], /NO_SUCH_ITEM/);
  await expectErr(c, 'the automatic achievements cannot be overwritten', ADMIN, `select admin_save_badge('explorer','Explorer','Renamed',1,'star','gold',null)`, [], /BUILT_IN/);
  await expectOk(c, 'admin designs a badge with PIPs and a border', ADMIN, `select admin_save_badge('mvp','MVP','Most valuable player',100,'crown','gold','champion')`, []);
  await expectErr(c, 'members cannot grant badges', A, `select admin_grant_badge($1,'mvp')`, [A], /NOT_ADMIN/);
  await expectErr(c, 'members cannot write member_achievements directly', A, `insert into member_achievements (member_id, key) values ($1,'mvp')`, [A], /permission denied/);
  await expectErr(c, 'a badge goes only to members in the hall', ADMIN, `select admin_grant_badge($1,'mvp')`, [NOCARD], /NOT_PUBLISHED/);
  await expectErr(c, 'automatic achievements cannot be granted by hand', ADMIN, `select admin_grant_badge($1,'explorer')`, [A], /NO_SUCH_BADGE/);
  await expectOk(c, 'admin grants a badge', ADMIN, `select admin_grant_badge($1,'mvp') as g`, [A], (r) => r.rows[0].g === true);
  await expectOk(c, '…which pays its PIPs', A, `select my_pips() as p`, [], (r) => r.rows[0].p.balance === 100);
  await expectOk(c, '…and gives its border', A, `select my_mart() as m`, [], (r) => r.rows[0].m.items.some((x) => x.key === 'champion' && x.owned));
  await expectOk(c, '…which the member can wear', A, `select equip_frame('champion')`, []);
  await expectOk(c, 'granting twice gives nothing more', ADMIN, `select admin_grant_badge($1,'mvp') as g`, [A], (r) => r.rows[0].g === false);
  await expectOk(c, '…and pays nothing more', A, `select my_pips() as p`, [], (r) => r.rows[0].p.balance === 100);
  await expectOk(c, 'visitors see the badge pinned on the card', 'anon', `select card_pins() as p`, [], (r) => r.rows[0].p.some((x) => x.profile_id === A && x.pins[0].key === 'mvp' && x.pins[0].gem === 'crown'));
  await expectErr(c, 'members cannot revoke badges', A, `select admin_revoke_badge($1,'mvp')`, [A], /NOT_ADMIN/);
  await expectOk(c, 'admin revokes a badge', ADMIN, `select admin_revoke_badge($1,'mvp') as r`, [A], (r) => r.rows[0].r === true);
  await expectOk(c, '…it leaves the card', 'anon', `select card_pins() as p`, [], (r) => !r.rows[0].p.some((x) => x.profile_id === A));
  await expectOk(c, '…but what it gave stays the member’s', A, `select my_mart() as m`, [], (r) => r.rows[0].m.balance === 100 && r.rows[0].m.items.some((x) => x.key === 'champion' && x.owned));
  await expectOk(c, 'automatic achievements cannot be revoked by hand', ADMIN, `select admin_revoke_badge($1,'first_card') as r`, [A], (r) => r.rows[0].r === false);
  await expectOk(c, 'admin retires a border from sale', ADMIN, `select admin_set_item_active('aurora', false)`, []);
  await expectOk(c, '…its owners keep it', A, `select my_mart() as m`, [], (r) => r.rows[0].m.items.some((x) => x.key === 'aurora' && x.owned));
  await as(c, A, `select equip_frame(null)`);

  console.log('project collaborators (D-089)');
  const [P1, P2] = (await c.query(`select id from projects where profile_id=$1 order by sort_order, created_at`, [A])).rows.map((r) => r.id);
  // A member edits (back to draft), resubmits, and an admin approves: a new public snapshot.
  const reapprove = async () => {
    await as(c, A, `update profiles set bio = coalesce(bio, '') || '.' where id=$1`, [A]);
    await as(c, A, `select submit_for_review()`);
    await as(c, ADMIN, `select approve_profile($1)`, [A]);
  };
  const collabsOf = (r, pid) => r.rows[0].card.projects.find((p) => p.id === pid)?.collaborators ?? null;
  await expectErr(c, 'anon cannot tag collaborators', 'anon', `select tag_collaborator($1,'bee')`, [P1], /permission denied/);
  await expectErr(c, 'only the owner can tag on a project', B, `select tag_collaborator($1,'pipm2')`, [P1], /NOT_YOURS/);
  await expectErr(c, 'a member not in the hall cannot be tagged', A, `select tag_collaborator($1,'pipm1')`, [P1], /NOT_IN_HALL/);
  const nameOf = async (id) => (await c.query(`select username from published_cards where profile_id=$1`, [id])).rows[0].username;
  const nameA = await nameOf(A);
  const nameB = await nameOf(B);
  await expectErr(c, 'you cannot tag yourself', A, `select tag_collaborator($1,$2)`, [P1, nameA], /SELF/);
  await expectOk(c, 'the owner tags a member of the hall (any case), pending', A, `select tag_collaborator($1,upper($2)) as t`, [P1, nameB], (r) => r.rows[0].t.status === 'pending' && r.rows[0].t.username === nameB);
  await expectOk(c, 'tagging again changes nothing', A, `select tag_collaborator($1,$2) as t`, [P1, nameB], (r) => r.rows[0].t.status === 'pending');
  await expectOk(c, 'the tagged member sees the request', B, `select status from project_collaborators where project_id=$1`, [P1], (r) => r.rowCount === 1 && r.rows[0].status === 'pending');
  await expectOk(c, 'another member cannot see it', Ms[1], `select * from project_collaborators`, [], (r) => r.rowCount === 0);
  await expectErr(c, 'visitors cannot read tags', 'anon', `select * from project_collaborators`, [], /permission denied/);
  await expectErr(c, 'nobody writes tags directly', B, `update project_collaborators set status='accepted'`, [], /permission denied/);
  await expectErr(c, '…nor inserts them', A, `insert into project_collaborators (project_id, member_id, status) values ($1,$2,'accepted')`, [P1, Ms[1]], /permission denied/);
  await reapprove();
  await expectOk(c, 'a pending tag is not on the public card', 'anon', `select card from published_cards where profile_id=$1`, [A], (r) => Array.isArray(collabsOf(r, P1)) && collabsOf(r, P1).length === 0);
  await expectErr(c, 'only the tagged member can answer', Ms[1], `select respond_collaboration($1, true)`, [P1], /NO_REQUEST/);
  await expectErr(c, '…not even the owner', A, `select respond_collaboration($1, true)`, [P1], /NO_REQUEST/);
  await expectOk(c, 'the tagged member accepts', B, `select respond_collaboration($1, true)`, [P1]);
  await expectOk(c, 'an accepted tag waits for the next approval', 'anon', `select card from published_cards where profile_id=$1`, [A], (r) => collabsOf(r, P1).length === 0);
  await reapprove();
  await expectOk(c, '…then visitors see the collaborator on the project', 'anon', `select card from published_cards where profile_id=$1`, [A], (r) => collabsOf(r, P1).length === 1 && collabsOf(r, P1)[0].username === nameB);
  await expectOk(c, 'the collaborator sees it among their collaborations', B, `select my_collaborations() as m`, [], (r) => r.rows[0].m.incoming.some((x) => x.project_id === P1 && x.status === 'accepted' && x.owner_username === nameA));
  await expectOk(c, 'the owner sees who accepted', A, `select my_collaborations() as m`, [], (r) => r.rows[0].m.outgoing.some((x) => x.project_id === P1 && x.username === nameB && x.status === 'accepted'));
  await expectErr(c, 'anon cannot read collaborations', 'anon', `select my_collaborations()`, [], /permission denied/);
  await expectErr(c, 'only the owner can untag', B, `select untag_collaborator($1,$2)`, [P1, B], /NOT_YOURS/);
  await expectOk(c, 'the collaborator can leave the project', B, `select leave_collaboration($1)`, [P1]);
  await expectErr(c, 'someone who left cannot be tagged again', A, `select tag_collaborator($1,$2)`, [P1, nameB], /DECLINED/);
  await expectOk(c, 'the owner cannot wipe a decline', A, `select untag_collaborator($1,$2)`, [P1, B]);
  await expectSu(c, '…it stays declined', `select status from project_collaborators where project_id=$1 and member_id=$2`, [P1, B], (r) => r.rows[0].status === 'declined');
  await reapprove();
  await expectOk(c, 'after leaving and approval, the collaborator is off the card', 'anon', `select card from published_cards where profile_id=$1`, [A], (r) => collabsOf(r, P1).length === 0);
  for (const m of Ms.slice(1, 8)) await as(c, A, `select tag_collaborator($1, (select username from published_cards where profile_id=$2))`, [P1, m]);
  await expectErr(c, 'a project has at most 8 tags', A, `select tag_collaborator($1, (select username from published_cards where profile_id=$2))`, [P1, Ms[8]], /TOO_MANY/);
  await expectOk(c, 'the owner untags a pending tag', A, `select untag_collaborator($1,$2)`, [P1, Ms[1]]);
  await expectSu(c, '…and it is gone', `select count(*)::int as n from project_collaborators where project_id=$1 and member_id=$2`, [P1, Ms[1]], (r) => r.rows[0].n === 0);
  await expectOk(c, 'a member can decline a request', Ms[2], `select respond_collaboration($1, false)`, [P1]);
  await expectErr(c, '…and a decline can’t be answered twice', Ms[2], `select respond_collaboration($1, true)`, [P1], /NO_REQUEST/);
  await as(c, A, `select tag_collaborator($1,$2)`, [P2, await nameOf(Ms[3])]);
  await expectOk(c, 'the owner can delete a tagged project', A, `delete from projects where id=$1`, [P2]);
  await expectSu(c, '…and its tags go with it', `select count(*)::int as n from project_collaborators where project_id=$1`, [P2], (r) => r.rows[0].n === 0);

  console.log('account deletion');
  await expectErr(c, 'anon cannot call delete_my_account', 'anon', `select delete_my_account()`, [], /permission denied/);
  await expectOk(c, 'member deletes own account', B, `select delete_my_account()`, []);
  await expectOk(c, 'their draft is gone', ADMIN, `select * from profiles where id=$1`, [B], (r) => r.rowCount === 0);
  await expectOk(c, 'their public card is gone too', 'anon', `select * from published_cards where profile_id=$1`, [B], (r) => r.rowCount === 0);
  await expectOk(c, 'other members are untouched', 'anon', `select * from published_cards where profile_id=$1`, [A], (r) => r.rowCount === 1);
} finally {
  await c.end();
  await db.stop();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
