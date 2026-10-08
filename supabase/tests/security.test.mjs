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
  await expectOk(c, 'anyone can read the catalogue', 'anon', `select key from mart_items where kind = 'frame' order by sort`, [], (r) => r.rows.map((x) => x.key).join() === 'meadow,dusk,pearl,gold');
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

  console.log('passport (D-098)');
  const exhibitA = linked[1]; // A's exhibit on show (see the Museum section)
  const pipsOf = async (id) => (await c.query(`select coalesce(sum(amount),0)::int as n from pip_ledger where member_id=$1`, [id])).rows[0].n;
  const achOf = async (id) => (await c.query(`select count(*)::int as n from member_achievements where member_id=$1`, [id])).rows[0].n;
  await expectErr(c, 'anon cannot read a passport', 'anon', `select my_passport()`, [], /permission denied/);
  await expectErr(c, 'anon cannot stamp an exhibit', 'anon', `select stamp_exhibit($1)`, [exhibitA], /permission denied/);
  await expectErr(c, 'anon cannot import a passport', 'anon', `select import_passport('[]','[]')`, [], /permission denied/);
  await expectOk(c, 'a member reads their passport', B, `select my_passport() as p`, [], (r) => r.rows[0].p.eligible === true && Array.isArray(r.rows[0].p.people) && Array.isArray(r.rows[0].p.exhibits));
  await expectOk(c, 'visiting an exhibit stamps it once', B, `select stamp_exhibit($1) as s`, [exhibitA], (r) => r.rows[0].s === true);
  await expectOk(c, '…and not twice', B, `select stamp_exhibit($1) as s`, [exhibitA], (r) => r.rows[0].s === false);
  await expectOk(c, '…and shows in the passport', B, `select my_passport() as p`, [], (r) => r.rows[0].p.exhibits.some((x) => x.id === exhibitA && x.imported === false));
  await expectOk(c, 'your own exhibit is no stamp', A, `select stamp_exhibit($1) as s`, [exhibitA], (r) => r.rows[0].s === false);
  await expectOk(c, 'a project not on show is no stamp', B, `select stamp_exhibit($1) as s`, [linked[0]], (r) => r.rows[0].s === false);
  await expectOk(c, 'a member without an approved card stamps nothing', C, `select stamp_exhibit($1) as s`, [exhibitA], (r) => r.rows[0].s === false);
  await expectErr(c, '…and cannot import', C, `select import_passport('[]','[]')`, [], /NOT_ELIGIBLE/);
  await expectErr(c, 'members cannot write stamps directly', B, `insert into passport_visits (member_id, project_id) values ($1, $2)`, [B, A], /permission denied/);
  await expectErr(c, '…nor discoveries', B, `insert into discoveries (member_id, card_id) values ($1, $2)`, [B, Ms[5]], /permission denied/);
  await expectErr(c, 'an import must be two lists', B, `select import_passport('{}','[]')`, [], /BAD_IMPORT/);
  await expectErr(c, '…of at most 1000 stamps', B, `select import_passport((select jsonb_agg(jsonb_build_object('id', gen_random_uuid())) from generate_series(1,1001)),'[]')`, [], /BAD_IMPORT/);

  // Graduation: an import is history only.
  const pipsB = await pipsOf(B);
  const achB = await achOf(B);
  const everyone = (await c.query(`select coalesce(jsonb_agg(jsonb_build_object('id', profile_id, 'at', '2099-01-01T00:00:00Z')), '[]') as j from published_cards`)).rows[0].j;
  const garbage = [{ id: 'not-a-uuid' }, { id: '00000000-0000-4000-8000-00000000dead' }, { id: B }, 'x', { id: Ms[6], at: 'yesterday; drop table x' }];
  await expectOk(c, 'a member imports their device passport', B, `select import_passport($1::jsonb, $2::jsonb) as r`, [JSON.stringify([...everyone, ...garbage]), JSON.stringify([{ id: exhibitA }])],
    (r) => r.rows[0].r.people > 0 && r.rows[0].r.exhibits === 0); // the exhibit was already stamped
  await expectSu(c, '…skipping themselves, unknown and malformed ids', `select count(*)::int as n from discoveries where member_id=$1 and card_id in ($1, '00000000-0000-4000-8000-00000000dead')`, [B], (r) => r.rows[0].n === 0);
  await expectSu(c, '…with no date in the future', `select count(*)::int as n from discoveries where member_id=$1 and created_at > now()`, [B], (r) => r.rows[0].n === 0);
  await expectOk(c, '…and marked as imported', B, `select my_passport() as p`, [], (r) => r.rows[0].p.people.some((x) => x.imported === true));
  await expectSu(c, 'an import pays no PIPs', `select coalesce(sum(amount),0)::int as n from pip_ledger where member_id=$1`, [B], (r) => r.rows[0].n === pipsB);
  await expectSu(c, '…and unlocks no achievements', `select count(*)::int as n from member_achievements where member_id=$1`, [B], (r) => r.rows[0].n === achB);
  const imported = (await c.query(`select card_id from discoveries where member_id=$1 and source='imported' limit 1`, [B])).rows[0].card_id;
  await expectOk(c, 'opening an imported person later pays no discovery', B, `select discover_card($1) as r`, [imported], (r) => r.rows[0].r.amount === 0 && r.rows[0].r.new === false);
  await expectOk(c, 'importing again adds nothing', B, `select import_passport($1::jsonb, '[]') as r`, [JSON.stringify(everyone)], (r) => r.rows[0].r.people === 0);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000500_passport.sql'), 'utf8'));
  await expectOk(c, 'the passport migration is safe to run twice', B, `select my_passport() as p`, [], (r) => r.rows[0].p.people.length > 0 && r.rows[0].p.exhibits.length === 1);

  console.log('hall events and missions (D-099)');
  const events = async (sql, params) => (await c.query(`select event_type, actor_id, target_id, visibility, metadata from hall_events where ${sql}`, params)).rows;
  await expectSu(c, 'approvals are recorded as public events', `select count(*)::int as n from hall_events where event_type='CARD_APPROVED' and actor_id=$1 and visibility='public'`, [Ms[1]], (r) => r.rows[0].n >= 1);
  await expectSu(c, 'unlocked achievements are recorded', `select count(*)::int as n from hall_events where event_type='ACHIEVEMENT_UNLOCKED' and actor_id=$1 and target_id='explorer'`, [A], (r) => r.rows[0].n === 1);
  await expectSu(c, 'exhibits put in the Museum are recorded', `select count(*)::int as n from hall_events where event_type='EXHIBIT_ADDED' and target_id=$1`, [linked[1]], (r) => r.rows[0].n >= 1);
  await expectSu(c, 'an accepted collaboration is private, with its owner', `select visibility, metadata->>'owner' as owner from hall_events where event_type='COLLAB_ACCEPTED' and actor_id=$1 limit 1`, [B], (r) => r.rows[0].visibility === 'private' && r.rows[0].owner === A);
  const featuredBefore = (await events(`event_type='MEMBER_FEATURED' and actor_id=$1`, [Ms[2]])).length;
  await as(c, ADMIN, `select set_featured($1, true)`, [Ms[2]]);
  await expectSu(c, 'featuring a member is recorded once…', `select count(*)::int as n from hall_events where event_type='MEMBER_FEATURED' and actor_id=$1`, [Ms[2]], (r) => r.rows[0].n === featuredBefore + 1);
  await expectSu(c, '…and is not mistaken for an approval', `select count(*)::int as n from hall_events where event_type='CARD_APPROVED' and actor_id=$1`, [Ms[2]], (r) => r.rows[0].n === 1);
  await as(c, ADMIN, `select set_featured($1, false)`, [Ms[2]]);
  await expectErr(c, 'anon cannot read events', 'anon', `select * from hall_events`, [], /permission denied/);
  await expectOk(c, 'a member reads only the events about them', B, `select actor_id, recipient_id from hall_events`, [], (r) => r.rows.every((x) => x.actor_id === B || x.recipient_id === B));
  await expectOk(c, '…and the private events about their projects', A, `select count(*)::int as n from hall_events where event_type='COLLAB_ACCEPTED'`, [], (r) => r.rows[0].n >= 1);
  await expectErr(c, 'members cannot write events', A, `insert into hall_events (actor_id, event_type) values ($1, 'CARD_APPROVED')`, [A], /permission denied/);
  await expectErr(c, 'members cannot call the event logger', A, `select log_event($1, 'CARD_APPROVED', null, null, '{}', 'public')`, [A], /permission denied/);

  // Missions: Ms[1] meets three members today, one of them a Python person from Engineering.
  const M = Ms[1];
  await c.query(`update published_cards set card = jsonb_set(jsonb_set(card, '{skills}', '["Python","SQL"]'), '{department}', '"Engineering"') where profile_id=$1`, [Ms[3]]);
  await expectErr(c, 'anon cannot do missions', 'anon', `select complete_mission('daily','people',null,3)`, [], /permission denied/);
  await expectErr(c, 'a member without an approved card cannot claim a mission', C, `select complete_mission('daily','people',null,3)`, [], /NOT_ELIGIBLE/);
  await expectErr(c, 'a mission below its minimum size is refused', M, `select complete_mission('daily','people',null,1)`, [], /BAD_MISSION/);
  await expectErr(c, 'an unknown mission kind is refused', M, `select complete_mission('daily','anything','x',1)`, [], /BAD_MISSION/);
  await expectErr(c, 'a skill mission needs a skill', M, `select complete_mission('daily','skill',null,1)`, [], /BAD_MISSION/);
  await expectErr(c, 'a mission that isn’t done yet pays nothing', M, `select complete_mission('daily','skill','Python',1)`, [], /NOT_DONE/);
  for (const m of [Ms[3], Ms[4], Ms[5]]) await as(c, M, `select discover_card($1)`, [m]);
  const pipsM = await pipsOf(M);
  await expectOk(c, 'finding a Python person completes the skill mission (+10)', M, `select complete_mission('daily','skill','python',1) as r`, [], (r) => r.rows[0].r.amount === 10);
  await expectErr(c, '…once', M, `select complete_mission('daily','skill','PYTHON',1)`, [], /ALREADY_DONE/);
  await expectOk(c, 'meeting someone from Engineering completes the department mission', M, `select complete_mission('daily','department','Engineering',1) as r`, [], (r) => r.rows[0].r.amount === 10);
  await expectOk(c, 'meeting three people completes the people mission', M, `select complete_mission('daily','people',null,3) as r`, [], (r) => r.rows[0].r.amount === 10);
  await expectErr(c, 'a fourth daily mission pays nothing', M, `select complete_mission('daily','tech','TypeScript',1)`, [], /MISSION_LIMIT/);
  await expectSu(c, 'three daily missions paid exactly 30 PIPs', `select coalesce(sum(amount),0)::int as n from pip_ledger where member_id=$1`, [M], (r) => r.rows[0].n === pipsM + 30);
  await expectErr(c, 'the weekly mission checks this week’s activity', M, `select complete_mission('weekly','people',null,8)`, [], /NOT_DONE/);
  for (const m of [Ms[2], Ms[6], Ms[7], Ms[8], A]) await as(c, M, `select discover_card($1)`, [m]);
  await expectOk(c, 'meeting eight people this week completes the weekly mission (+40)', M, `select complete_mission('weekly','people',null,8) as r`, [], (r) => r.rows[0].r.amount === 40);
  await expectErr(c, '…and only one weekly mission pays', M, `select complete_mission('weekly','exhibits',null,5)`, [], /MISSION_LIMIT|NOT_DONE/);
  await expectOk(c, 'my_missions lists today’s and this week’s completions', M, `select my_missions() as m`, [], (r) => r.rows[0].m.eligible && r.rows[0].m.done.length === 4 && /^\d{4}-\d{2}-\d{2}$/.test(r.rows[0].m.day) && /^\d{4}-W\d{2}$/.test(r.rows[0].m.week));
  await expectSu(c, 'each completion is a private event', `select count(*)::int as n from hall_events where event_type='MISSION_COMPLETED' and actor_id=$1 and visibility='private'`, [M], (r) => r.rows[0].n === 4);
  await expectErr(c, 'members cannot write completions directly', M, `insert into mission_completions (member_id, key, scope, period, kind, n) values ($1,'x','daily','d','people',3)`, [M], /permission denied/);
  await expectErr(c, 'imported stamps never complete a mission (B only has imported stamps)', B, `select complete_mission('daily','people',null,3)`, [], /NOT_DONE/);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000600_missions_events.sql'), 'utf8'));
  await expectOk(c, 'the missions migration is safe to run twice', M, `select my_missions() as m`, [], (r) => r.rows[0].m.done.length === 4);
  // Later migrations redefine some of its functions, so they are applied again after it, in order.
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000700_notifications.sql'), 'utf8'));
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000800_identity.sql'), 'utf8'));

  console.log('notifications and recent in the hall (D-100)');
  const bell = async (uid) => (await as(c, uid, `select my_notifications() as n`)).rows[0].n;
  await expectSu(c, 'a tag is a private request addressed to the tagged member', `select actor_id, visibility from hall_events where event_type='COLLAB_REQUESTED' and recipient_id=$1 and target_id=$2`, [B, P1], (r) => r.rowCount === 1 && r.rows[0].actor_id === A && r.rows[0].visibility === 'private');
  await expectSu(c, 'an event without a named recipient is addressed to its actor', `select count(*)::int as n from hall_events where event_type='CARD_APPROVED' and recipient_id is distinct from actor_id`, [], (r) => r.rows[0].n === 0);
  await expectOk(c, 'the tagged member reads the request and who sent it', B, `select actor_id from hall_events where event_type='COLLAB_REQUESTED'`, [], (r) => r.rowCount === 1 && r.rows[0].actor_id === A);
  await expectOk(c, '…and it is in their bell, with the project and the owner', B, `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'COLLAB_REQUESTED' && x.target_id === P1 && x.by_username === nameA && x.title));
  await expectOk(c, 'the owner hears that a tag was accepted', A, `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'COLLAB_ACCEPTED' && x.by_username === nameB));
  await expectOk(c, 'a withdrawn request leaves the bell', Ms[1], `select my_notifications() as n`, [], (r) => !r.rows[0].n.items.some((x) => x.type === 'COLLAB_REQUESTED'));
  await expectOk(c, '…and so does a request on a deleted project', Ms[3], `select my_notifications() as n`, [], (r) => !r.rows[0].n.items.some((x) => x.target_id === P2) && r.rows[0].n.items.some((x) => x.target_id === P1));
  await expectOk(c, 'a member hears about their approval and achievements', Ms[1], `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'CARD_APPROVED') && r.rows[0].n.items.every((x) => x.by_username === null || x.by_username === undefined || x.type.startsWith('COLLAB')));
  await expectOk(c, 'Missions, own projects and own exhibits are not news', Ms[1], `select my_notifications() as n`, [], (r) => !r.rows[0].n.items.some((x) => ['MISSION_COMPLETED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED'].includes(x.type)));
  const bellA = new Set((await bell(A)).items.map((x) => x.id));
  await expectOk(c, 'no member sees another member’s notifications', B, `select my_notifications() as n`, [], (r) => r.rows[0].n.items.every((x) => !bellA.has(x.id)));
  await expectOk(c, 'the bell is capped', A, `select my_notifications(1000) as n`, [], (r) => r.rows[0].n.items.length <= 50);
  await expectErr(c, 'visitors have no bell', 'anon', `select my_notifications()`, [], /permission denied/);

  // A collaborator accepts and the owner's next approval credits them in public.
  await as(c, Ms[4], `select respond_collaboration($1, true)`, [P1]);
  await reapprove();
  const nameM4 = await nameOf(Ms[4]);
  await expectSu(c, 'an approval that credits a collaborator is a public event addressed to them', `select visibility, metadata->>'with' as w from hall_events where event_type='COLLAB_PUBLISHED' and actor_id=$1 and recipient_id=$2`, [A, Ms[4]], (r) => r.rowCount === 1 && r.rows[0].visibility === 'public' && r.rows[0].w === nameM4);
  await reapprove();
  await expectSu(c, '…once, not at every approval', `select count(*)::int as n from hall_events where event_type='COLLAB_PUBLISHED' and recipient_id=$1`, [Ms[4]], (r) => r.rows[0].n === 1);
  await expectOk(c, 'the collaborator hears their name is on the project', Ms[4], `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'COLLAB_PUBLISHED' && x.target_id === P1 && x.by_username === nameA));

  // "Needs changes" goes only to the member, with the admin's note.
  await as(c, C, `update profiles set full_name='Cee' where id=$1`, [C]);
  await as(c, C, `select submit_for_review()`);
  await as(c, ADMIN, `select reject_profile($1, 'Add a photo, please')`, [C]);
  await expectSu(c, 'a rejection is a private event', `select visibility from hall_events where event_type='CARD_REJECTED' and actor_id=$1`, [C], (r) => r.rowCount === 1 && r.rows[0].visibility === 'private');
  await expectOk(c, 'a member whose card needs changes hears why', C, `select my_notifications() as n`, [], (r) => r.rows[0].n.items[0]?.type === 'CARD_REJECTED' && r.rows[0].n.items[0].note === 'Add a photo, please');
  await expectOk(c, 'other members cannot read it', A, `select count(*)::int as n from hall_events where event_type='CARD_REJECTED'`, [], (r) => r.rows[0].n === 0);

  // The read marker.
  await expectOk(c, 'a new member has seen nothing yet', C, `select my_notifications() as n`, [], (r) => r.rows[0].n.seen_at === null);
  await expectOk(c, 'marking the bell as seen', C, `select mark_notifications_seen() as t`, [], (r) => r.rows[0].t !== null);
  await expectOk(c, '…is remembered', C, `select my_notifications() as n`, [], (r) => r.rows[0].n.seen_at !== null);
  await expectOk(c, '…and can be moved on', C, `select mark_notifications_seen() as t`, [], (r) => r.rows[0].t !== null);
  await expectErr(c, 'visitors cannot mark anything', 'anon', `select mark_notifications_seen()`, [], /permission denied/);
  await expectErr(c, 'members cannot write the marker directly', C, `insert into notification_reads (member_id) values ($1)`, [C], /permission denied/);
  await expectErr(c, '…nor read others’', A, `select * from notification_reads`, [], /permission denied/);

  // Recent in the hall: public, true, and no counts.
  const feed = async (n = 20) => (await as(c, 'anon', `select recent_hall_events($1) as f`, [n])).rows[0].f;
  const PUBLIC_TYPES = ['CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_PUBLISHED', 'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED'];
  const recent = await feed();
  await expectOk(c, 'visitors read Recent in the hall', 'anon', `select recent_hall_events() as f`, [], (r) => Array.isArray(r.rows[0].f) && r.rows[0].f.length > 0 && r.rows[0].f.length <= 8);
  await expectOk(c, '…capped at 20', 'anon', `select recent_hall_events(1000) as f`, [], (r) => r.rows[0].f.length <= 20);
  await expectSu(c, 'only public kinds of event appear', `select 1`, [], () => recent.every((x) => PUBLIC_TYPES.includes(x.type)));
  await expectSu(c, '…with names and titles, never counts or ids of people', `select 1`, [], () => recent.every((x) => Object.keys(x).sort().join() === 'at,full_name,id,project_id,title,type,username,with_name,with_username'));
  const unpub = (await c.query(`select username from profiles where id=$1`, [Ms[0]])).rows[0].username;
  await expectSu(c, 'members who left the hall drop out of it', `select 1`, [], () => recent.every((x) => x.username !== unpub && x.with_username !== unpub));
  await expectSu(c, 'a member joins the hall once (re-approvals are not joins)', `select 1`, [], () => {
    const joins = recent.filter((x) => x.type === 'CARD_APPROVED').map((x) => x.username);
    return new Set(joins).size === joins.length && !joins.includes(nameA);
  });
  await expectSu(c, 'the new credit is there, with both names', `select 1`, [], () => recent.some((x) => x.type === 'COLLAB_PUBLISHED' && x.username === nameA && x.with_username === nameM4 && x.project_id === P1));
  await expectSu(c, 'a credit that was withdrawn is not', `select 1`, [], () => !recent.some((x) => x.type === 'COLLAB_PUBLISHED' && x.with_username === nameB));
  const nameM2 = await nameOf(Ms[2]);
  await expectSu(c, 'a member no longer featured is not shown as featured', `select 1`, [], () => !recent.some((x) => x.type === 'MEMBER_FEATURED' && x.username === nameM2));
  // C fixes their card and joins with one project, then adds a second one later.
  await as(c, C, `insert into projects (profile_id, title) values ($1, 'First Light')`, [C]);
  await as(c, C, `select submit_for_review()`);
  await as(c, ADMIN, `select approve_profile($1)`, [C]);
  await as(c, C, `insert into projects (profile_id, title) values ($1, 'Second Wind')`, [C]);
  await as(c, C, `select submit_for_review()`);
  await as(c, ADMIN, `select approve_profile($1)`, [C]);
  const nameC = await nameOf(C);
  await expectOk(c, 'a first approval is one line: the member joined', 'anon', `select recent_hall_events(20) as f`, [], (r) => r.rows[0].f.filter((x) => x.username === nameC && x.type === 'CARD_APPROVED').length === 1 && !r.rows[0].f.some((x) => x.title === 'First Light'));
  await expectOk(c, '…and a project added later gets its own line', 'anon', `select recent_hall_events(20) as f`, [], (r) => r.rows[0].f.some((x) => x.username === nameC && x.type === 'PROJECT_PUBLISHED' && x.title === 'Second Wind'));
  const second = (await c.query(`select id from projects where profile_id=$1 and title='Second Wind'`, [C])).rows[0].id;
  await as(c, C, `delete from projects where id=$1`, [second]);
  await as(c, C, `select submit_for_review()`);
  await as(c, ADMIN, `select approve_profile($1)`, [C]);
  await expectOk(c, 'a project taken off the card leaves the strip', 'anon', `select recent_hall_events(20) as f`, [], (r) => !r.rows[0].f.some((x) => x.title === 'Second Wind'));
  await expectErr(c, 'visitors still cannot read the raw events', 'anon', `select * from hall_events`, [], /permission denied/);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000700_notifications.sql'), 'utf8'));
  await expectOk(c, 'the notifications migration is safe to run twice', Ms[4], `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'COLLAB_PUBLISHED'));

  console.log('titles, plates and mission rerolls (D-101)');
  const titlesOf = async (uid) => (await as(c, uid, `select my_titles() as t`)).rows[0].t;
  const earnedOf = (t) => t.titles.filter((x) => x.earned).map((x) => x.key);
  const hallTitle = async (id) => (await as(c, 'anon', `select hall_titles() as h`)).rows[0].h.find((x) => x.profile_id === id);
  await expectErr(c, 'visitors have no titles of their own', 'anon', `select my_titles()`, [], /permission denied/);
  await expectOk(c, 'the first member is a Card Holder, a Pioneer and (credited with M4) a Connector', A, `select my_titles() as t`, [], (r) => {
    const e = earnedOf(r.rows[0].t);
    return r.rows[0].t.eligible && ['card_holder', 'pioneer', 'connector'].every((k) => e.includes(k)) && !e.includes('curator');
  });
  await expectOk(c, 'a credited collaborator is a Connector too', Ms[4], `select my_titles() as t`, [], (r) => earnedOf(r.rows[0].t).includes('connector'));
  const late = (await c.query(`select profile_id from published_cards where member_no > 10 order by member_no limit 1`)).rows[0].profile_id;
  await expectOk(c, 'later members are not Pioneers', late, `select my_titles() as t`, [], (r) => !earnedOf(r.rows[0].t).includes('pioneer'));
  await expectOk(c, 'a member out of the hall has no titles', Ms[0], `select my_titles() as t`, [], (r) => !r.rows[0].t.eligible && earnedOf(r.rows[0].t).length === 0);
  await expectErr(c, '…and cannot wear one', Ms[0], `select equip_title('card_holder')`, [], /NOT_ELIGIBLE/);
  await expectErr(c, 'a title not earned yet cannot be worn', M, `select equip_title('explorer')`, [], /NOT_EARNED/);
  await expectErr(c, '…nor one that doesn’t exist', M, `select equip_title('legend')`, [], /NOT_EARNED/);
  for (const m of [Ms[9], C]) await as(c, M, `select discover_card($1)`, [m]);
  await expectOk(c, 'meeting 10 members makes an Explorer', M, `select my_titles() as t`, [], (r) => earnedOf(r.rows[0].t).includes('explorer'));
  await expectOk(c, 'an earned title can be worn', M, `select equip_title('explorer')`, []);
  await expectOk(c, '…and the hall sees it on the badge', 'anon', `select hall_titles() as h`, [], (r) => r.rows[0].h.find((x) => x.profile_id === M)?.title === 'explorer');
  const before10 = earnedOf(await titlesOf(M));
  await expectSu(c, 'Pathfinder needs 10 Missions', `select 1`, [], () => !before10.includes('pathfinder'));
  await c.query(`insert into mission_completions (member_id, key, scope, period, kind, n) select $1, 'old:' || g, 'daily', '2026-01-0' || g, 'people', 3 from generate_series(1, 6) g`, [M]);
  await expectOk(c, '…and ten make a Pathfinder', M, `select my_titles() as t`, [], (r) => earnedOf(r.rows[0].t).includes('pathfinder'));
  await expectOk(c, 'hall_titles lists every member in the hall, and only them', 'anon', `select hall_titles() as h, (select count(*)::int from published_cards) as n`, [],
    (r) => r.rows[0].h.length === r.rows[0].n && !r.rows[0].h.some((x) => x.profile_id === Ms[0]) && r.rows[0].h.every((x) => x.earned.includes('card_holder')));
  // A title goes when its proof goes: M4 leaves the team project and the owner's card is approved again.
  await as(c, Ms[4], `select equip_title('connector')`);
  await as(c, Ms[4], `select leave_collaboration($1)`, [P1]);
  await reapprove();
  await expectOk(c, 'a title whose proof is gone is no longer earned', Ms[4], `select my_titles() as t`, [], (r) => !earnedOf(r.rows[0].t).includes('connector') && r.rows[0].t.title === null);
  const m4 = await hallTitle(Ms[4]);
  await expectSu(c, '…and leaves the badge', `select 1`, [], () => m4.title === null);
  await expectErr(c, 'members cannot write their appearance directly', M, `update card_appearance set title='pioneer' where member_id=$1`, [M], /permission denied/);

  // Title plates: a PIP MART kind of their own.
  await expectOk(c, 'plates are on sale in the PIP MART', A, `select my_mart() as m`, [], (r) => r.rows[0].m.items.filter((i) => i.kind === 'plate').length === 3);
  await expectErr(c, 'a plate not owned cannot be worn', A, `select equip_plate('plate-brass')`, [], /NOT_OWNED/);
  await c.query(`select grant_pips($1, 500, 'achievement', 'test:plates')`, [A]);
  const pipsA = await pipsOf(A);
  await expectOk(c, 'buying a plate spends its price', A, `select buy_item('plate-brass') as b`, [], (r) => r.rows[0].b.balance === pipsA - 150);
  await expectErr(c, 'a plate is not a frame', A, `select equip_frame('plate-brass')`, [], /NOT_OWNED/);
  await expectErr(c, 'a frame is not a plate', A, `select equip_plate('meadow')`, [], /NOT_OWNED/);
  await expectOk(c, 'the owner wears the plate with a title', A, `select equip_plate('plate-brass'), equip_title('pioneer')`, []);
  await expectOk(c, 'the hall sees the title on its plate', 'anon', `select hall_titles() as h`, [], (r) => {
    const a = r.rows[0].h.find((x) => x.profile_id === A);
    return a.title === 'pioneer' && a.plate_style?.plate === 'gold' && a.plate_style?.ink === 'ink';
  });
  await expectOk(c, 'my_mart says what is worn', A, `select my_mart() as m`, [], (r) => r.rows[0].m.equipped.plate === 'plate-brass' && r.rows[0].m.equipped.title === 'pioneer');
  await expectOk(c, 'taking the plate off', A, `select equip_plate(null)`, []);
  const plain = await hallTitle(A);
  await expectSu(c, '…shows the plain plate', `select 1`, [], () => plain.plate_style === null);
  await expectErr(c, 'an admin border cannot take over a plate', ADMIN, `select admin_save_frame('plate-brass','Mine','',10,true,'{"frame":"gold","hi":"coin-hi","shade":"coin-shade","trim":"ink","gap":3,"motion":"none","doodle":"none"}')`, [], /BUILT_IN/);
  await expectOk(c, 'the borders list in Admin has no plates', ADMIN, `select admin_mart_items() as m`, [], (r) => !r.rows[0].m.some((i) => i.key.startsWith('plate-')));

  // Mission rerolls: once a day, 15 PIPs, never more Missions paid.
  const pipsM2 = await pipsOf(M);
  await expectOk(c, 'no reroll yet today', M, `select my_missions() as m`, [], (r) => r.rows[0].m.rerolls === 0);
  await expectOk(c, 'a reroll costs 15 PIPs', M, `select reroll_missions() as r`, [], (r) => r.rows[0].r.rerolls === 1 && r.rows[0].r.balance === pipsM2 - 15);
  await expectErr(c, '…once a day', M, `select reroll_missions()`, [], /REROLL_LIMIT/);
  await expectOk(c, 'my_missions counts it, for the new pick', M, `select my_missions() as m`, [], (r) => r.rows[0].m.rerolls === 1);
  await expectSu(c, 'the reroll is in the ledger as spending', `select amount, reason from pip_ledger where member_id=$1 and ref like 'reroll:%'`, [M], (r) => r.rowCount === 1 && r.rows[0].amount === -15 && r.rows[0].reason === 'purchase');
  await expectErr(c, 'a reroll still pays no fourth daily Mission', M, `select complete_mission('daily','tech','TypeScript',1)`, [], /MISSION_LIMIT/);
  await expectErr(c, 'members out of the hall cannot reroll', Ms[0], `select reroll_missions()`, [], /NOT_ELIGIBLE/);
  await expectErr(c, 'visitors cannot reroll', 'anon', `select reroll_missions()`, [], /permission denied/);
  await expectErr(c, 'members cannot read or write rerolls directly', M, `select * from mission_rerolls`, [], /permission denied/);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000800_identity.sql'), 'utf8'));
  await expectOk(c, 'the identity migration is safe to run twice', A, `select my_titles() as t, my_mart() as m`, [], (r) => r.rows[0].t.title === 'pioneer' && r.rows[0].m.items.filter((i) => i.kind === 'plate').length === 3);

  console.log('museum wings (D-102)');
  const wings = async (uid = 'anon') => (await as(c, uid, `select museum_wings() as w`)).rows[0].w;
  await expectOk(c, 'anyone can walk the wings: featured, collab, officers (D-123), then the tag wings', 'anon', `select museum_wings() as w`, [],
    (r) => r.rows[0].w.map((w) => w.key).join() === 'featured,collab,officers,web,games,data' && r.rows[0].w.every((w) => w.note === ''));
  await expectErr(c, 'the wings table is not read directly', 'anon', `select * from museum_wings`, [], /permission denied/);
  await expectErr(c, '…nor written by members', A, `update museum_wings set note='mine'`, [], /permission denied/);
  await expectErr(c, 'members cannot curate', A, `select admin_save_wing('web','Web Wing','Mine',array['JavaScript'],10,true)`, [], /NOT_ADMIN/);
  await expectErr(c, 'visitors cannot curate', 'anon', `select admin_save_wing('web','Web Wing','x',array['x'],10,true)`, [], /permission denied/);
  await expectErr(c, 'members cannot list closed wings', A, `select admin_wings()`, [], /NOT_ADMIN/);
  await expectOk(c, 'an admin writes a curator note', ADMIN, `select admin_save_wing('web','Web Wing','Things you can open in a browser.',array['JavaScript','TypeScript'],10,true)`, []);
  await expectOk(c, '…and visitors read it', 'anon', `select museum_wings() as w`, [], (r) => r.rows[0].w.find((w) => w.key === 'web').note === 'Things you can open in a browser.');
  await expectOk(c, 'an admin opens a new wing; tags are tidied (trimmed, no repeats)', ADMIN, `select admin_save_wing('mobile','Mobile Wing','',array[' Kotlin ','kotlin','Swift',''],20,true)`, []);
  await expectSu(c, '…as a tag wing', `select kind, tags from museum_wings where key='mobile'`, [], (r) => r.rows[0].kind === 'tags' && r.rows[0].tags.join() === 'Kotlin,Swift');
  await expectErr(c, 'a tag wing needs a tag', ADMIN, `select admin_save_wing('empty','Empty Wing','',array[]::text[],20,true)`, [], /BAD_TAGS/);
  await expectErr(c, '…and at most 12', ADMIN, `select admin_save_wing('big','Big Wing','',(select array_agg('t' || g) from generate_series(1,13) g),20,true)`, [], /BAD_TAGS/);
  await expectErr(c, 'a bad key is refused', ADMIN, `select admin_save_wing('Bad Key!','Wing','',array['x'],20,true)`, [], /BAD_KEY/);
  await expectErr(c, 'a name must fit the sign', ADMIN, `select admin_save_wing('x1','X','',array['x'],20,true)`, [], /BAD_NAME/);
  await expectErr(c, 'a note is short', ADMIN, `select admin_save_wing('web','Web Wing',repeat('n',281),array['x'],10,true)`, [], /BAD_NOTE/);
  await expectOk(c, 'the featured wing keeps its rule when renamed', ADMIN, `select admin_save_wing('featured','Hall of Fame','Picked by the curators.',array['ignored'],0,true)`, []);
  await expectSu(c, '…no tags, still featured', `select kind, tags, name from museum_wings where key='featured'`, [], (r) => r.rows[0].kind === 'featured' && r.rows[0].tags.length === 0 && r.rows[0].name === 'Hall of Fame');
  await expectErr(c, 'the built-in wings cannot be removed', ADMIN, `select admin_delete_wing('collab')`, [], /BUILT_IN/);
  await expectOk(c, '…but can be closed', ADMIN, `select admin_save_wing('collab','Collab Wing','',null,1,false)`, []);
  await expectOk(c, 'a closed wing is gone for visitors', 'anon', `select museum_wings() as w`, [], (r) => !r.rows[0].w.some((w) => w.key === 'collab'));
  await expectOk(c, '…and still listed for admins', ADMIN, `select admin_wings() as w`, [], (r) => r.rows[0].w.some((w) => w.key === 'collab' && w.active === false));
  await expectOk(c, 'a tag wing can be removed', ADMIN, `select admin_delete_wing('mobile')`, []);
  await expectErr(c, '…once', ADMIN, `select admin_delete_wing('mobile')`, [], /NO_SUCH_WING/);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000900_museum_wings.sql'), 'utf8'));
  const after = await wings();
  await expectSu(c, 'the wings migration is safe to run twice, and keeps the curators’ words', `select 1`, [], () =>
    after.find((w) => w.key === 'web')?.note === 'Things you can open in a browser.' && after.find((w) => w.key === 'featured')?.name === 'Hall of Fame' && !after.some((w) => w.key === 'collab'));

  console.log('seasons and events (D-103)');
  // The identity migration was re-run above; the events migration comes after it again.
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006001000_seasons.sql'), 'utf8'));
  const today = `(now() at time zone 'Asia/Manila')::date`;
  const save = (key, from, to, kind, param, n, reward, frame) =>
    `select admin_save_season('${key}', 'Build Week', 'Ship something small.', ${today} + ${from}, ${today} + ${to}, ${kind}, ${param}, ${n}, ${reward}, ${frame})`;
  await expectOk(c, 'no event is scheduled until a curator schedules one', 'anon', `select current_season() as s`, [], (r) => r.rows[0].s.live === null && r.rows[0].s.next === null);
  await expectErr(c, 'members cannot schedule events', A, save('build-week', 5, 11, `'people'`, 'null', 3, 30, `'pearl'`), [], /NOT_ADMIN/);
  await expectErr(c, 'visitors cannot either', 'anon', save('build-week', 5, 11, 'null', 'null', 'null', 'null', 'null'), [], /permission denied/);
  await expectOk(c, 'an admin schedules Build Week with a Mission and a limited frame', ADMIN, save('build-week', 5, 11, `'people'`, 'null', 3, 30, `'pearl'`), []);
  await expectOk(c, 'visitors see it coming', 'anon', `select current_season() as s`, [], (r) =>
    r.rows[0].s.live === null && r.rows[0].s.next?.key === 'build-week' && r.rows[0].s.next.mission.reward === 30 && r.rows[0].s.next.frame.key === 'pearl' && r.rows[0].s.next.counts === null);
  await expectOk(c, 'the limited frame is off the shelf before the event', M, `select my_mart() as m`, [], (r) => !r.rows[0].m.items.some((i) => i.key === 'pearl'));
  await expectErr(c, '…and can’t be bought', M, `select buy_item('pearl')`, [], /NOT_IN_SEASON/);
  await expectErr(c, 'events never overlap', ADMIN, save('other', 7, 9, 'null', 'null', 'null', 'null', 'null'), [], /OVERLAP/);
  await expectErr(c, 'an event ends after it starts', ADMIN, save('backwards', 40, 39, 'null', 'null', 'null', 'null', 'null'), [], /BAD_DATES/);
  await expectErr(c, '…and lasts at most a month', ADMIN, save('long', 40, 80, 'null', 'null', 'null', 'null', 'null'), [], /BAD_DATES/);
  await expectErr(c, 'an event Mission must be one the hall knows', ADMIN, save('m1', 40, 41, `'people'`, 'null', 1, 30, 'null'), [], /BAD_MISSION/);
  await expectErr(c, '…a skill Mission names a skill', ADMIN, save('m2', 40, 41, `'skill'`, 'null', 1, 30, 'null'), [], /BAD_MISSION/);
  await expectErr(c, '…and pays 5 to 200 PIPs', ADMIN, save('m3', 40, 41, `'people'`, 'null', 3, 500, 'null'), [], /BAD_REWARD/);
  await expectErr(c, 'the limited item must be a frame', ADMIN, save('m4', 40, 41, 'null', 'null', 'null', 'null', `'plate-brass'`), [], /NO_SUCH_FRAME/);
  await expectOk(c, 'an event that hasn’t started can be removed', ADMIN, `${save('later', 40, 41, 'null', 'null', 'null', 'null', 'null')}; select admin_delete_season('later')`, []);
  await expectErr(c, 'the events table is not read directly', 'anon', `select * from hall_seasons`, [], /permission denied/);

  // Build Week starts (yesterday, on the hall's calendar).
  await as(c, ADMIN, save('build-week', -1, 5, `'people'`, 'null', 3, 30, `'pearl'`));
  const live = (await as(c, 'anon', `select current_season() as s`)).rows[0].s.live;
  const truth = (await c.query(`select
      count(*) filter (where event_type='PROJECT_PUBLISHED')::int as projects,
      count(*) filter (where event_type='EXHIBIT_ADDED')::int as exhibits,
      count(*) filter (where event_type='COLLAB_PUBLISHED')::int as teamups,
      count(*) filter (where event_type='CARD_APPROVED' and not exists (select 1 from hall_events f where f.actor_id=e.actor_id and f.event_type='CARD_APPROVED' and f.id<e.id))::int as joined
    from hall_events e where visibility='public' and created_at >= (${today} - 1)::timestamp at time zone 'Asia/Manila'`)).rows[0];
  await expectSu(c, 'a live event counts only real public events in its dates', `select 1`, [], () =>
    live?.key === 'build-week' && ['joined', 'projects', 'exhibits', 'teamups'].every((k) => live.counts[k] === truth[k]) && truth.joined > 0);
  await expectOk(c, 'a member hasn’t done the event Mission yet', M, `select my_season() as s`, [], (r) => r.rows[0].s.eligible && r.rows[0].s.done === false);
  await expectErr(c, 'a member out of the hall can’t claim it', Ms[0], `select complete_season_mission()`, [], /NOT_ELIGIBLE/);
  await expectErr(c, 'a member who hasn’t met three people since it began can’t', Ms[9], `select complete_season_mission()`, [], /NOT_DONE/);
  const pipsBW = await pipsOf(M);
  await expectOk(c, 'a member who has claims it (+30)', M, `select complete_season_mission() as r`, [], (r) => r.rows[0].r.amount === 30 && r.rows[0].r.balance === pipsBW + 30);
  await expectErr(c, '…once', M, `select complete_season_mission()`, [], /ALREADY_DONE/);
  await expectOk(c, '…and it shows as done', M, `select my_season() as s`, [], (r) => r.rows[0].s.done === true);
  await expectSu(c, 'it is recorded like any Mission, with its own key', `select scope, period from mission_completions where member_id=$1 and key='season:build-week'`, [M], (r) => r.rowCount === 1 && r.rows[0].scope === 'season' && r.rows[0].period === 'build-week');
  await expectOk(c, 'it doesn’t count against today’s Missions', M, `select my_missions() as m`, [], (r) => !r.rows[0].m.done.includes('season:build-week'));
  await c.query(`select grant_pips($1, 1000, 'achievement', 'test:limited')`, [M]);
  await expectOk(c, 'during the event the limited frame is on the shelf, with its last day', M, `select my_mart() as m, (${today} + 5)::text as last`, [], (r) => {
    const pearl = r.rows[0].m.items.find((i) => i.key === 'pearl');
    return pearl && pearl.limited_until === r.rows[0].last;
  });
  await expectOk(c, '…and can be bought', M, `select buy_item('pearl') as b`, [], (r) => typeof r.rows[0].b.balance === 'number');
  await expectErr(c, 'an event that has started can’t be removed', ADMIN, `select admin_delete_season('build-week')`, [], /ALREADY_STARTED/);
  await expectOk(c, 'admins see each event’s state', ADMIN, `select admin_seasons() as s`, [], (r) => r.rows[0].s.find((x) => x.key === 'build-week')?.state === 'live');
  // The event ends: the frame leaves the shelf, owners keep it.
  await as(c, ADMIN, save('build-week', -8, -2, `'people'`, 'null', 3, 30, `'pearl'`));
  await expectOk(c, 'after the event, owners keep the frame', M, `select my_mart() as m`, [], (r) => r.rows[0].m.items.some((i) => i.key === 'pearl' && i.owned && i.limited_until === null));
  await expectOk(c, '…and nobody else can buy it', Ms[9], `select my_mart() as m`, [], (r) => !r.rows[0].m.items.some((i) => i.key === 'pearl'));
  await expectErr(c, 'an event Mission can’t be claimed after the event', Ms[2], `select complete_season_mission()`, [], /NO_EVENT_MISSION/);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006001000_seasons.sql'), 'utf8'));
  await expectOk(c, 'the events migration is safe to run twice', ADMIN, `select admin_seasons() as s`, [], (r) => r.rows[0].s.some((x) => x.key === 'build-week' && x.state === 'over'));

  console.log('hackathons: tracks, submissions and winners (D-115 to D-117)');
  // The events migration was re-run above; this one comes after it again.
  await c.query(readFileSync(join(here, '..', 'migrations', '20261007000000_hackathons.sql'), 'utf8'));
  const day = (d, h = 0) => `((${today} + ${d})::timestamp + interval '${h} hours') at time zone 'Asia/Manila'`;
  const hack = (key, from, to, ev, tracks, close, results) =>
    `select admin_save_season('${key}', 'Spring Hackathon', 'Build something in a weekend.', ${today} + ${from}, ${today} + ${to}, null, null, null, null, null, ${ev}, ${tracks}, ${close}, ${results})`;
  const TRACKS = `array['Health','Education']`;
  await expectErr(c, 'the old way of saving an event is gone', ADMIN, `select admin_save_season('x', 'X event', '', ${today} + 60, ${today} + 61, null, null, null, null, null)`, [], /does not exist/);
  await expectErr(c, 'members cannot schedule a hackathon', A, hack('spring-hack', 40, 42, `'hackathon'`, TRACKS, day(41), day(42)), [], /NOT_ADMIN/);
  await expectErr(c, 'an event is a plain event, a hackathon or a building event', ADMIN, hack('h1', 40, 42, `'party'`, 'null', 'null', 'null'), [], /BAD_EVENT_KIND/);
  await expectErr(c, 'a hackathon needs a submissions deadline and a results time', ADMIN, hack('h1', 40, 42, `'hackathon'`, 'null', 'null', 'null'), [], /BAD_SCHEDULE/);
  await expectErr(c, '…submissions close after it starts', ADMIN, hack('h1', 40, 42, `'hackathon'`, 'null', day(40), day(42)), [], /BAD_SCHEDULE/);
  await expectErr(c, '…results come after submissions close', ADMIN, hack('h1', 40, 42, `'hackathon'`, 'null', day(41, 12), day(41)), [], /BAD_SCHEDULE/);
  await expectErr(c, '…and both fall within its dates', ADMIN, hack('h1', 40, 42, `'hackathon'`, 'null', day(41), day(44)), [], /BAD_SCHEDULE/);
  await expectErr(c, 'at most 6 tracks', ADMIN, hack('h1', 40, 42, `'hackathon'`, `array['Aa','Bb','Cc','Dd','Ee','Ff','Gg']`, day(41), day(42)), [], /BAD_TRACKS/);
  await expectErr(c, '…no two alike', ADMIN, hack('h1', 40, 42, `'hackathon'`, `array['Health','health']`, day(41), day(42)), [], /BAD_TRACKS/);
  await expectErr(c, '…each 2 to 30 characters', ADMIN, hack('h1', 40, 42, `'build'`, `array['H']`, day(41), day(42)), [], /BAD_TRACKS/);
  await expectOk(c, 'an admin schedules a hackathon with two tracks', ADMIN, hack('spring-hack', 20, 22, `'hackathon'`, `array[' Health ','Education','']`, day(21), day(22)), []);
  await expectOk(c, 'visitors see it coming, with its tracks and schedule', 'anon', `select current_season() as s`, [], (r) => {
    const n = r.rows[0].s.next;
    return n?.key === 'spring-hack' && n.kind === 'hackathon' && n.phase === 'upcoming' && JSON.stringify(n.tracks) === '["Health","Education"]' && n.submissions_close && n.results_at && n.announced_at === null;
  });
  await expectOk(c, 'a plain event keeps no schedule', ADMIN, `select admin_seasons() as s`, [], (r) => {
    const b = r.rows[0].s.find((x) => x.key === 'build-week');
    return b.kind === 'event' && b.phase === 'over' && b.submissions_close === null && b.tracks.length === 0;
  });
  const P1live = (await c.query(`select live_project_ids($1) as ids`, [A])).rows[0].ids;
  const otherA = P1live.find((id) => id !== P1);
  await expectErr(c, 'nothing can be submitted before it starts', A, `select submit_to_event('spring-hack', $1, 'Health')`, [P1], /SUBMISSIONS_CLOSED/);
  // It starts (yesterday, the day after Build Week ended); submissions close in an hour.
  await expectOk(c, 'it is moved to now: submissions close in an hour, results in two', ADMIN, hack('spring-hack', -1, 3, `'hackathon'`, TRACKS, `now() + interval '1 hour'`, `now() + interval '2 hours'`), []);
  await expectOk(c, 'the live event says submissions are open, with none yet', 'anon', `select current_season() as s`, [], (r) => r.rows[0].s.live?.key === 'spring-hack' && r.rows[0].s.live.phase === 'open' && r.rows[0].s.live.counts.submissions === 0);
  // Another maker: Ms[5] gets a project approved.
  await as(c, Ms[5], `update profiles set full_name='Em Five' where id=$1`, [Ms[5]]);
  const Q = (await as(c, Ms[5], `insert into projects (profile_id, title) values ($1, 'Kite') returning id`, [Ms[5]])).rows[0].id;
  await as(c, Ms[5], `select submit_for_review()`);
  await as(c, ADMIN, `select approve_profile($1)`, [Ms[5]]);
  await expectErr(c, 'visitors cannot submit', 'anon', `select submit_to_event('spring-hack', $1, 'Health')`, [P1], /permission denied/);
  const N = '00000000-0000-0000-0000-00000000000e';
  await c.query(`insert into auth.users (id, email) values ($1, 'n@x.test')`, [N]);
  await expectErr(c, 'a member out of the hall cannot submit', N, `select submit_to_event('spring-hack', $1, 'Health')`, [P1], /NOT_ELIGIBLE/);
  await expectErr(c, 'a member cannot submit someone else’s project', A, `select submit_to_event('spring-hack', $1, 'Health')`, [Q], /NOT_LIVE/);
  const draftQ = (await as(c, Ms[5], `insert into projects (profile_id, title) values ($1, 'Kite 2') returning id`, [Ms[5]])).rows[0].id;
  await expectErr(c, '…nor a project that isn’t on their approved card', Ms[5], `select submit_to_event('spring-hack', $1, 'Health')`, [draftQ], /NOT_LIVE/);
  await expectErr(c, 'an event with tracks needs one', A, `select submit_to_event('spring-hack', $1, null)`, [P1], /BAD_TRACK/);
  await expectErr(c, '…one of its own', A, `select submit_to_event('spring-hack', $1, 'Gaming')`, [P1], /BAD_TRACK/);
  await expectErr(c, 'a plain event takes no submissions', A, `select submit_to_event('build-week', $1, null)`, [P1], /NO_SUCH_EVENT/);
  await expectOk(c, 'a member submits a project on their card to a track', A, `select submit_to_event('spring-hack', $1, 'Health') as s`, [P1], (r) => r.rows[0].s.track === 'Health');
  await expectSu(c, '…which the hall hears about', `select visibility, metadata->>'season' as k from hall_events where event_type='EVENT_SUBMITTED' and actor_id=$1 and target_id=$2`, [A, P1], (r) => r.rowCount === 1 && r.rows[0].visibility === 'public' && r.rows[0].k === 'spring-hack');
  await expectOk(c, 'they can move it to another track', A, `select submit_to_event('spring-hack', $1, 'Education') as s`, [P1], (r) => r.rows[0].s.track === 'Education');
  await expectSu(c, '…without a second announcement', `select count(*)::int as n from hall_events where event_type='EVENT_SUBMITTED' and actor_id=$1`, [A], (r) => r.rows[0].n === 1);
  await expectErr(c, 'one project per member per event', A, `select submit_to_event('spring-hack', $1, 'Health')`, [otherA], /ONE_PER_EVENT/);
  await expectOk(c, 'the member sees what they submitted', A, `select my_season() as s`, [], (r) => r.rows[0].s.submission?.project_id === P1 && r.rows[0].s.submission.track === 'Education');
  await expectOk(c, 'another member submits theirs', Ms[5], `select submit_to_event('spring-hack', $1, 'Health')`, [Q]);
  await expectOk(c, 'the event room shows both, as on the cards, with no results yet', 'anon', `select museum_events() as e`, [], (r) => {
    const e = r.rows[0].e.find((x) => x.key === 'spring-hack');
    return e && e.entries.length === 2 && e.entries.some((x) => x.project_id === P1 && x.track === 'Education' && x.project.title) && e.entries.some((x) => x.project_id === Q && x.username) && e.awards.length === 0;
  });
  await expectOk(c, 'plain events have no room', 'anon', `select museum_events() as e`, [], (r) => !r.rows[0].e.some((x) => x.key === 'build-week'));
  await expectOk(c, 'Recent in the hall says who submitted to what', 'anon', `select recent_hall_events(20) as r`, [], (r) => r.rows[0].r.some((x) => x.type === 'EVENT_SUBMITTED' && x.project_id === P1 && x.event === 'Spring Hackathon' && x.event_key === 'spring-hack'));
  await expectErr(c, 'submissions are not read directly', 'anon', `select * from event_submissions`, [], /permission denied/);
  await expectErr(c, '…not even by members', A, `select * from event_submissions`, [], /permission denied/);
  await expectErr(c, 'members cannot write submissions directly', A, `insert into event_submissions (season_key, project_id, member_id) values ('spring-hack', $1, $2)`, [otherA, A], /permission denied/);
  await expectOk(c, 'a member can withdraw while submissions are open', A, `select withdraw_from_event('spring-hack')`, []);
  await expectOk(c, '…and the strip forgets it', 'anon', `select recent_hall_events(20) as r`, [], (r) => !r.rows[0].r.some((x) => x.type === 'EVENT_SUBMITTED' && x.project_id === P1));
  await expectErr(c, '…once', A, `select withdraw_from_event('spring-hack')`, [], /NOT_SUBMITTED/);
  await as(c, A, `select submit_to_event('spring-hack', $1, 'Education')`, [P1]);
  await expectErr(c, 'no awards while submissions are open', ADMIN, `select admin_save_award('spring-hack', $1, 1, null, null, 'Great')`, [P1], /STILL_OPEN/);
  await expectErr(c, '…and no announcement', ADMIN, `select admin_announce_results('spring-hack')`, [], /STILL_OPEN/);

  // Submissions close (a minute ago): judging.
  await as(c, ADMIN, hack('spring-hack', -1, 3, `'hackathon'`, TRACKS, `now() - interval '1 minute'`, `now() + interval '1 hour'`));
  await expectOk(c, 'after the deadline the event is being judged', 'anon', `select current_season() as s`, [], (r) => r.rows[0].s.live.phase === 'judging' && r.rows[0].s.live.counts.submissions === 2);
  await expectErr(c, 'nothing can be submitted after the deadline', A, `select submit_to_event('spring-hack', $1, 'Health')`, [P1], /SUBMISSIONS_CLOSED/);
  await expectErr(c, '…or withdrawn', Ms[5], `select withdraw_from_event('spring-hack')`, [], /SUBMISSIONS_CLOSED/);
  await expectErr(c, 'members cannot record awards', A, `select admin_save_award('spring-hack', $1, 1, null, null, '')`, [P1], /NOT_ADMIN/);
  await expectErr(c, 'an award is a place or a name, not both', ADMIN, `select admin_save_award('spring-hack', $1, 1, 'Best UI', null, '')`, [P1], /BAD_AWARD/);
  await expectErr(c, '…places are 1st to 3rd', ADMIN, `select admin_save_award('spring-hack', $1, 4, null, null, '')`, [P1], /BAD_AWARD/);
  await expectErr(c, 'only submitted projects can win', ADMIN, `select admin_save_award('spring-hack', $1, 1, null, null, '')`, [otherA], /NOT_SUBMITTED/);
  await expectErr(c, 'a track award goes to a project in that track', ADMIN, `select admin_save_award('spring-hack', $1, null, 'Best UI', 'Health', '')`, [P1], /BAD_TRACK/);
  await expectErr(c, 'the judges’ note is at most 200 characters', ADMIN, `select admin_save_award('spring-hack', $1, 1, null, null, repeat('x', 201))`, [P1], /BAD_NOTE/);
  let firstId;
  await expectOk(c, 'an admin records 1st place with the judges’ note', ADMIN, `select admin_save_award('spring-hack', $1, 1, null, null, 'A clear idea, beautifully shipped.') as id`, [P1], (r) => (firstId = r.rows[0].id) > 0);
  await expectOk(c, '…2nd place', ADMIN, `select admin_save_award('spring-hack', $1, 2, null, null, '')`, [Q]);
  await expectOk(c, '…and a named award in a track', ADMIN, `select admin_save_award('spring-hack', $1, null, ' Best UI ', 'Health', 'Lovely to use.')`, [Q]);
  await expectErr(c, 'each place has one winner', ADMIN, `select admin_save_award('spring-hack', $1, 1, null, null, '')`, [Q], /AWARD_TAKEN/);
  await expectErr(c, '…each named award too (any case)', ADMIN, `select admin_save_award('spring-hack', $1, null, 'best ui', 'Health', '')`, [Q], /AWARD_TAKEN/);
  await expectErr(c, 'a project takes one place', ADMIN, `select admin_save_award('spring-hack', $1, 3, null, null, '')`, [P1], /AWARD_TAKEN/);
  const pick = (await as(c, ADMIN, `select admin_save_award('spring-hack', $1, null, 'People''s Pick', null, '') as id`, [P1])).rows[0].id;
  await expectOk(c, 'an award can be taken back before the announcement', ADMIN, `select admin_delete_award($1)`, [pick]);
  await expectErr(c, 'awards are not read directly', 'anon', `select * from event_awards`, [], /permission denied/);
  await expectOk(c, 'admins see the entries and every award', ADMIN, `select admin_event_results('spring-hack') as r`, [], (r) =>
    r.rows[0].r.entries.length === 2 && r.rows[0].r.awards.length === 3 && r.rows[0].r.announced_at === null && r.rows[0].r.entries.every((e) => e.on_card && e.title));
  await expectErr(c, '…members don’t', A, `select admin_event_results('spring-hack')`, [], /NOT_ADMIN/);
  await expectOk(c, 'nothing is public before the announcement', 'anon', `select museum_events() as e, hall_awards() as w`, [], (r) =>
    r.rows[0].e.find((x) => x.key === 'spring-hack').awards.length === 0 && r.rows[0].w.length === 0);
  await expectOk(c, '…and nobody is a Champion yet', A, `select my_titles() as t`, [], (r) => r.rows[0].t.titles.some((t) => t.key === 'champion' && !t.earned));
  await expectErr(c, 'submissions can’t reopen once judging has begun', ADMIN, hack('spring-hack', -1, 3, `'hackathon'`, TRACKS, `now() + interval '1 hour'`, `now() + interval '2 hours'`), [], /IN_USE/);
  await expectErr(c, 'a track that has entries can’t be removed', ADMIN, hack('spring-hack', -1, 3, `'hackathon'`, `array['Health']`, `now() - interval '1 minute'`, `now() + interval '1 hour'`), [], /IN_USE/);
  await expectErr(c, 'members cannot announce', A, `select admin_announce_results('spring-hack')`, [], /NOT_ADMIN/);

  const makersOf = async (pid, owner) => {
    const card = (await c.query(`select card from published_cards where profile_id=$1`, [owner])).rows[0].card;
    const names = (card.projects.find((p) => p.id === pid)?.collaborators ?? []).map((m) => m.username);
    const ids = (await c.query(`select profile_id from published_cards where username = any($1)`, [names])).rows.map((r) => r.profile_id);
    return [owner, ...ids];
  };
  // A teammate on the winning project: tagged, accepted, and on the approved card.
  await as(c, A, `select tag_collaborator($1, (select username from published_cards where profile_id=$2))`, [P1, Ms[6]]);
  await as(c, Ms[6], `select respond_collaboration($1, true)`, [P1]);
  await reapprove();
  const p1Makers = await makersOf(P1, A);
  await expectOk(c, 'the admin announces the results: every credited maker hears what they won', ADMIN, `select admin_announce_results('spring-hack') as r`, [], (r) => r.rows[0].r.makers === p1Makers.length + 2);
  await expectErr(c, '…once', ADMIN, `select admin_announce_results('spring-hack')`, [], /ALREADY_ANNOUNCED/);
  await expectErr(c, 'the winners are fixed after the announcement', ADMIN, `select admin_save_award('spring-hack', $1, 3, null, null, '')`, [Q], /ALREADY_ANNOUNCED/);
  await expectErr(c, '…none can be taken back', ADMIN, `select admin_delete_award($1)`, [firstId], /ALREADY_ANNOUNCED/);
  await expectOk(c, '…but a judges’ note can be corrected', ADMIN, `select admin_award_note($1, 'A clear idea, shipped beautifully.')`, [firstId]);
  await expectErr(c, 'members cannot edit notes', A, `select admin_award_note($1, 'Mine!')`, [firstId], /NOT_ADMIN/);
  await expectSu(c, 'the hall hears the results once', `select count(*)::int as n, bool_and(actor_id is null and visibility='public') as ok from hall_events where event_type='RESULTS_ANNOUNCED' and target_id='spring-hack'`, [], (r) => r.rows[0].n === 1 && r.rows[0].ok);
  await expectOk(c, 'visitors see the results in the event room', 'anon', `select museum_events() as e`, [], (r) => {
    const e = r.rows[0].e.find((x) => x.key === 'spring-hack');
    return e.phase === 'results' && e.awards.length === 3 && e.awards.some((a) => a.place === 1 && a.project_id === P1 && a.note === 'A clear idea, shipped beautifully.') && e.awards.some((a) => a.name === 'Best UI' && a.track === 'Health');
  });
  await expectOk(c, '…and the banner can say the results are in', 'anon', `select current_season() as s`, [], (r) => r.rows[0].s.results?.key === 'spring-hack' && r.rows[0].s.results.announced_at);
  await expectOk(c, 'Recent in the hall announces the results', 'anon', `select recent_hall_events(20) as r`, [], (r) => r.rows[0].r.some((x) => x.type === 'RESULTS_ANNOUNCED' && x.event === 'Spring Hackathon' && x.event_key === 'spring-hack'));
  await expectOk(c, 'every maker of a winning project wears its ribbon, the credited teammate too', 'anon', `select hall_awards() as w`, [], (r) => {
    const of = (id) => r.rows[0].w.find((x) => x.profile_id === id)?.awards ?? [];
    return p1Makers.length > 1 && p1Makers.every((id) => of(id).some((a) => a.place === 1 && a.event === 'Spring Hackathon' && a.project_id === P1))
      && of(Ms[5]).length === 2 && of(Ms[9]).length === 0;
  });
  await expectOk(c, 'the bell tells a winner what they won', A, `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'AWARD_WON' && x.place === 1 && x.event === 'Spring Hackathon' && x.target_id === P1 && x.title));
  await expectOk(c, '…and a track award with its name and track', Ms[5], `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'AWARD_WON' && x.award === 'Best UI' && x.track === 'Health'));
  await expectOk(c, 'a teammate hears it too', p1Makers[1], `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'AWARD_WON' && x.target_id === P1));
  await expectOk(c, 'winners earn the Champion title', A, `select my_titles() as t`, [], (r) => r.rows[0].t.titles.some((t) => t.key === 'champion' && t.earned));
  await expectOk(c, '…and can wear it', A, `select equip_title('champion')`, []);
  await expectOk(c, 'others don’t', Ms[9], `select my_titles() as t`, [], (r) => r.rows[0].t.titles.some((t) => t.key === 'champion' && !t.earned));
  await expectErr(c, '…and can’t wear it', Ms[9], `select equip_title('champion')`, [], /NOT_EARNED/);
  await expectOk(c, 'the hall shows it on the badge', 'anon', `select hall_titles() as t`, [], (r) => r.rows[0].t.find((x) => x.profile_id === A)?.title === 'champion');
  await expectOk(c, 'opening an exhibit in an event room stamps the Passport', Ms[9], `select stamp_exhibit($1) as s`, [Q], (r) => r.rows[0].s === true);
  await expectOk(c, '…but not your own', Ms[5], `select stamp_exhibit($1) as s`, [Q], (r) => r.rows[0].s === false);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261007000000_hackathons.sql'), 'utf8'));
  await expectOk(c, 'the hackathons migration is safe to run twice, and keeps the results', 'anon', `select museum_events() as e`, [], (r) => {
    const e = r.rows[0].e.find((x) => x.key === 'spring-hack');
    return e.phase === 'results' && e.entries.length === 2 && e.awards.length === 3;
  });
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000700_notifications.sql'), 'utf8'));
  await expectSu(c, 'running the notifications migration again keeps the new event types', `select pg_get_constraintdef(oid) as d from pg_constraint where conname='hall_events_event_type_check'`, [], (r) => /AWARD_WON/.test(r.rows[0].d));
  await c.query(readFileSync(join(here, '..', 'migrations', '20261007000000_hackathons.sql'), 'utf8'));
  // A winning project deleted by its maker takes its entry and award with it (rule 4).
  await as(c, Ms[5], `delete from projects where id=$1`, [Q]);
  await expectOk(c, 'a deleted project leaves the event room, and its ribbons go with it', 'anon', `select museum_events() as e, hall_awards() as w`, [], (r) =>
    r.rows[0].e.find((x) => x.key === 'spring-hack').entries.length === 1 && !r.rows[0].w.some((x) => x.profile_id === Ms[5]));

  console.log('the archive (D-118, D-122)');
  await c.query(readFileSync(join(here, '..', 'migrations', '20261008000000_archive.sql'), 'utf8'));
  const saveArc = (uid, id, data) => as(c, uid, `select admin_save_archive($1, $2::jsonb) as id`, [id, JSON.stringify(data)]);
  const arcSql = `select admin_save_archive($1, $2::jsonb) as id`;
  const kite = {
    title: 'Kite', description: 'A kite that tweets the wind.', year: 2024, event_name: 'Spring Hackathon', track: 'Health',
    award_place: 1, award_note: 'Brilliant and simple.', team_name: 'Team Kite', tech: ['Python', ' Arduino ', 'Python'],
    project_url: 'https://kite.example.org', video_url: 'https://video.example.org/kite', names_ok: false, published: false,
    makers: [{ name: 'Rosa Diaz' }, { name: 'Sam Lee' }, {}],
  };
  const arcErr = (name, data, pattern, uid = ADMIN, id = null) => expectErr(c, name, uid, arcSql, [id, JSON.stringify(data)], pattern);
  await arcErr('members cannot add to the archive', kite, /NOT_ADMIN/, A);
  await arcErr('visitors cannot either', kite, /permission denied/, 'anon');
  await arcErr('an archive exhibit has a title', { ...kite, title: ' ' }, /BAD_TITLE/);
  await arcErr('…and a real year', { ...kite, year: 1890 }, /BAD_YEAR/);
  await arcErr('…written as a year', { ...kite, year: 'soon' }, /BAD_YEAR/);
  await arcErr('an award is a place or a name, not both', { ...kite, award_name: 'Best UI' }, /BAD_AWARD/);
  await arcErr('an award needs the event it was won at', { ...kite, event_name: null }, /BAD_AWARD/);
  await arcErr('a track award needs a track', { ...kite, track: null, award_in_track: true }, /BAD_AWARD/);
  await arcErr('links are https', { ...kite, project_url: 'http://kite.example.org' }, /BAD_LINK/);
  await arcErr('at most 8 tools', { ...kite, tech: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }, /BAD_TECH/);
  await arcErr('at most 12 makers', { ...kite, makers: Array.from({ length: 13 }, () => ({})) }, /BAD_MAKERS/);
  await arcErr('a linked maker must be in the hall', { ...kite, makers: [{ member_id: N }] }, /NOT_IN_HALL/);
  await arcErr('…and on it once', { ...kite, makers: [{ member_id: Ms[7] }, { member_id: Ms[7] }] }, /BAD_MAKERS/);
  await arcErr('a picture must be one this admin uploaded', { ...kite, cover_path: `${A}/11111111-2222-3333-4444-555555555555.webp` }, /BAD_PICTURE/);
  await arcErr('a recorded event must exist', { ...kite, season_key: 'nope' }, /NO_SUCH_EVENT/);
  await as(c, ADMIN, `select admin_save_season('later-week', 'Later Week', '', ${today} + 50, ${today} + 51, null, null, null, null, null, 'event', null, null, null)`);
  await arcErr('…and be over, so nothing about it leaks early', { ...kite, season_key: 'later-week' }, /EVENT_NOT_OVER/);
  let K;
  await expectOk(c, 'an admin saves a past project as a draft, with an uploaded picture', ADMIN, arcSql, [null, JSON.stringify({ ...kite, cover_path: `${ADMIN}/11111111-2222-3333-4444-555555555555.webp` })], (r) => (K = r.rows[0].id));
  await expectOk(c, 'drafts are not on show', 'anon', `select museum_archive() as a`, [], (r) => !r.rows[0].a.some((x) => x.id === K));
  await expectSu(c, '…and nobody hears about them', `select count(*)::int as n from hall_events where target_type='archive' and target_id=$1`, [K], (r) => r.rows[0].n === 0);
  await expectErr(c, 'the archive tables are not read directly', 'anon', `select * from archive_exhibits`, [], /permission denied/);
  await expectErr(c, '…not even by members', A, `select * from archive_makers`, [], /permission denied/);
  await expectErr(c, '…claims neither', A, `select * from archive_claims`, [], /permission denied/);
  await expectOk(c, 'published: on show with its event, award and team, but no typed names without consent', ADMIN, arcSql, [K, JSON.stringify({ ...kite, cover_path: `${ADMIN}/11111111-2222-3333-4444-555555555555.webp`, published: true })]);
  await expectOk(c, '…visitors see it', 'anon', `select museum_archive() as a`, [], (r) => {
    const k = r.rows[0].a.find((x) => x.id === K);
    return k && k.event === 'Spring Hackathon 2024' && k.award.place === 1 && k.award.track === null && k.award.note === 'Brilliant and simple.'
      && k.team_name === 'Team Kite' && k.makers.length === 0 && Number(k.team_size) === 3 && JSON.stringify(k.tech) === '["Python","Arduino"]' && k.video_url;
  });
  await expectSu(c, '…and the hall hears it once', `select count(*)::int as n from hall_events where event_type='ARCHIVE_ADDED' and target_id=$1 and visibility='public'`, [K], (r) => r.rows[0].n === 1);
  await saveArc(ADMIN, K, { ...kite, published: true, names_ok: true });
  await expectOk(c, 'with the makers’ consent their typed names show (not the unnamed slot)', 'anon', `select museum_archive() as a`, [], (r) => {
    const k = r.rows[0].a.find((x) => x.id === K);
    return JSON.stringify(k.makers.map((m) => m.full_name)) === '["Rosa Diaz","Sam Lee"]' && Number(k.team_size) === 3;
  });
  await expectSu(c, 'saving again doesn’t announce it again', `select count(*)::int as n from hall_events where event_type='ARCHIVE_ADDED' and target_id=$1`, [K], (r) => r.rows[0].n === 1);

  // An admin links a member of the hall to a maker slot.
  const name7 = await nameOf(Ms[7]);
  await saveArc(ADMIN, K, { ...kite, published: true, names_ok: true, makers: [{ member_id: Ms[7], name: 'Rosa Diaz' }, { name: 'Sam Lee' }, {}] });
  await expectOk(c, 'a linked member shows by their card, linked to their badge', 'anon', `select museum_archive() as a`, [], (r) => {
    const k = r.rows[0].a.find((x) => x.id === K);
    return k.makers[0].username === name7 && k.makers[0].member_no > 0 && k.makers[1].full_name === 'Sam Lee';
  });
  await expectOk(c, '…hears it in their bell', Ms[7], `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'ARCHIVE_CREDITED' && x.target_id === K && x.title === 'Kite'));
  await expectOk(c, '…wears its ribbon', 'anon', `select hall_awards() as w`, [], (r) => (r.rows[0].w.find((x) => x.profile_id === Ms[7])?.awards ?? []).some((a) => a.archive && a.place === 1 && a.event === 'Spring Hackathon 2024' && a.project_id === K && a.title === 'Kite'));
  await expectOk(c, '…and is a Champion', Ms[7], `select my_titles() as t`, [], (r) => r.rows[0].t.titles.some((t) => t.key === 'champion' && t.earned));
  await saveArc(ADMIN, K, { ...kite, published: true, names_ok: true, makers: [{ member_id: Ms[7], name: 'Rosa Diaz' }, { name: 'Sam Lee' }, {}] });
  await expectSu(c, '…once, however often it is saved', `select count(*)::int as n from hall_events where event_type='ARCHIVE_CREDITED' and actor_id=$1 and target_id=$2`, [Ms[7], K], (r) => r.rows[0].n === 1);
  await expectOk(c, 'Recent in the hall says it joined the Archive, and who is credited', 'anon', `select recent_hall_events(20) as r`, [], (r) =>
    r.rows[0].r.some((x) => x.type === 'ARCHIVE_ADDED' && x.project_id === K && x.title === 'Kite' && x.event === 'Spring Hackathon 2024')
    && r.rows[0].r.some((x) => x.type === 'ARCHIVE_CREDITED' && x.project_id === K && x.username === name7));

  // Claims: "Is this yours?"
  await expectErr(c, 'visitors cannot claim', 'anon', `select claim_archive($1, '')`, [K], /permission denied/);
  await expectErr(c, 'a member out of the hall cannot claim', N, `select claim_archive($1, '')`, [K], /NOT_ELIGIBLE/);
  await expectErr(c, 'a credited maker has nothing to claim', Ms[7], `select claim_archive($1, '')`, [K], /ALREADY_CREDITED/);
  await expectOk(c, 'a member claims it with a note for the admins', Ms[8], `select claim_archive($1, 'I built the sensor board.')`, [K]);
  await expectErr(c, '…once while it waits', Ms[8], `select claim_archive($1, '')`, [K], /ALREADY_CLAIMED/);
  await expectOk(c, '…and sees it waiting', Ms[8], `select my_archive() as m`, [], (r) => r.rows[0].m.eligible && r.rows[0].m.claims.some((x) => x.exhibit_id === K && x.status === 'pending'));
  await expectErr(c, 'members cannot answer claims', A, `select admin_answer_claim(1, true, null, '')`, [], /NOT_ADMIN/);
  let claimId, samSlot;
  const name8 = await nameOf(Ms[8]);
  await expectOk(c, 'admins see the claim with who and why, and the maker slots', ADMIN, `select admin_archive() as a`, [], (r) => {
    const k = r.rows[0].a.find((x) => x.id === K);
    claimId = k?.claims[0]?.id;
    samSlot = k?.makers.find((m) => m.name === 'Sam Lee')?.id;
    return k.claims.length === 1 && k.claims[0].note === 'I built the sensor board.' && k.claims[0].username === name8 && samSlot && claimId;
  });
  await expectErr(c, '…members don’t', A, `select admin_archive()`, [], /NOT_ADMIN/);
  await expectOk(c, 'an admin declines it with a note', ADMIN, `select admin_answer_claim($1, false, null, 'We couldn’t find you in the team list.')`, [claimId]);
  await expectOk(c, '…which the member hears, privately', Ms[8], `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'ARCHIVE_CLAIM_DECLINED' && x.note === 'We couldn’t find you in the team list.' && x.title === 'Kite'));
  await expectSu(c, '…as a private event', `select visibility from hall_events where event_type='ARCHIVE_CLAIM_DECLINED' and actor_id=$1`, [Ms[8]], (r) => r.rows.every((x) => x.visibility === 'private') && r.rowCount === 1);
  await expectErr(c, 'an answered claim can’t be answered again', ADMIN, `select admin_answer_claim($1, true, null, '')`, [claimId], /NO_SUCH_CLAIM/);
  await expectOk(c, 'a declined claim can be made again', Ms[8], `select claim_archive($1, 'Here is my old team photo.')`, [K]);
  claimId = (await as(c, ADMIN, `select admin_archive() as a`)).rows[0].a.find((x) => x.id === K).claims[0].id;
  await expectErr(c, 'a claim links to an unlinked slot of that exhibit', ADMIN, `select admin_answer_claim($1, true, 999999, '')`, [claimId], /BAD_MAKER/);
  await expectOk(c, 'an admin confirms it, linking the member to the slot they were', ADMIN, `select admin_answer_claim($1, true, $2, '')`, [claimId, samSlot]);
  await expectOk(c, '…the exhibit now shows them', 'anon', `select museum_archive() as a`, [], (r) => {
    const k = r.rows[0].a.find((x) => x.id === K);
    return k.makers.filter((m) => m.username).length === 2 && !k.makers.some((m) => m.full_name === 'Sam Lee') && Number(k.team_size) === 3;
  });
  await expectOk(c, '…the claim is settled', Ms[8], `select my_archive() as m`, [], (r) => r.rows[0].m.claims.some((x) => x.exhibit_id === K && x.status === 'confirmed') && r.rows[0].m.credited.includes(K));
  await expectOk(c, '…they hear they’re credited', Ms[8], `select my_notifications() as n`, [], (r) => r.rows[0].n.items.some((x) => x.type === 'ARCHIVE_CREDITED' && x.target_id === K));
  await expectOk(c, 'two members on one archive exhibit are Connectors', Ms[8], `select my_titles() as t`, [], (r) => r.rows[0].t.titles.some((t) => t.key === 'connector' && t.earned));
  // Curator counts archive credits with Museum exhibits.
  for (const title of ['Lamp', 'Orbit']) await saveArc(ADMIN, null, { title, year: 2023, published: true, makers: [{ member_id: Ms[8] }] });
  await expectOk(c, 'three archive credits make a Curator', Ms[8], `select my_titles() as t`, [], (r) => r.rows[0].t.titles.some((t) => t.key === 'curator' && t.earned));
  await expectOk(c, 'an exhibit from no event shows its year alone', 'anon', `select museum_archive() as a`, [], (r) => {
    const l = r.rows[0].a.find((x) => x.title === 'Lamp');
    return l && l.event === null && l.year === 2023 && l.award === null;
  });
  const W = (await saveArc(ADMIN, null, { title: 'Weather Wall', year: 2026, season_key: 'build-week', published: true, makers: [] })).rows[0].id;
  await expectOk(c, 'an exhibit from a recorded event carries the event and its key', 'anon', `select museum_archive() as a`, [], (r) => {
    const w = r.rows[0].a.find((x) => x.id === W);
    return w.event_key === 'build-week' && w.event === 'Build Week 2026';
  });

  // Passport stamps.
  await expectOk(c, 'opening an archive exhibit stamps the Passport', Ms[9], `select stamp_exhibit($1) as s`, [K], (r) => r.rows[0].s === true);
  await expectOk(c, '…not for its own makers', Ms[8], `select stamp_exhibit($1) as s`, [K], (r) => r.rows[0].s === false);

  // A member takes their name off.
  await expectOk(c, 'a member can take their name off an archive exhibit', Ms[7], `select leave_archive($1)`, [K]);
  await expectErr(c, '…once', Ms[7], `select leave_archive($1)`, [K], /NOT_CREDITED/);
  await expectOk(c, '…their slot stays, under the typed name the makers agreed to', 'anon', `select museum_archive() as a, hall_awards() as w, recent_hall_events(20) as r`, [], (r) => {
    const k = r.rows[0].a.find((x) => x.id === K);
    return Number(k.team_size) === 3 && k.makers.some((m) => m.full_name === 'Rosa Diaz' && !m.username)
      && !(r.rows[0].w.find((x) => x.profile_id === Ms[7])?.awards ?? []).some((a) => a.project_id === K)
      && !r.rows[0].r.some((x) => x.type === 'ARCHIVE_CREDITED' && x.username === name7);
  });
  await expectOk(c, '…and the title goes with the proof', Ms[7], `select my_titles() as t`, [], (r) => r.rows[0].t.titles.some((t) => t.key === 'champion' && !t.earned));

  // Taking it off show hides it everywhere; deleting removes it.
  await saveArc(ADMIN, K, { ...kite, published: false, names_ok: true, makers: [{ member_id: Ms[8] }] });
  await expectOk(c, 'an unpublished exhibit is off show, its ribbons and news too', 'anon', `select museum_archive() as a, hall_awards() as w, recent_hall_events(20) as r`, [], (r) =>
    !r.rows[0].a.some((x) => x.id === K) && !(r.rows[0].w.find((x) => x.profile_id === Ms[8])?.awards ?? []).some((a) => a.project_id === K)
    && !r.rows[0].r.some((x) => x.project_id === K));
  await expectErr(c, '…and can’t be claimed', Ms[9], `select claim_archive($1, '')`, [K], /NO_SUCH_EXHIBIT/);
  await expectOk(c, '…nor stamped', Ms[9], `select stamp_exhibit($1) as s`, [W], (r) => r.rows[0].s === true);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261008000000_archive.sql'), 'utf8'));
  await expectOk(c, 'the archive migration is safe to run twice', ADMIN, `select admin_archive() as a`, [], (r) => r.rows[0].a.length === 4 && r.rows[0].a.some((x) => x.id === K && x.published === false));
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000700_notifications.sql'), 'utf8'));
  await c.query(readFileSync(join(here, '..', 'migrations', '20261007000000_hackathons.sql'), 'utf8'));
  await expectSu(c, 'running older migrations again keeps the archive’s event types', `select pg_get_constraintdef(oid) as d from pg_constraint where conname='hall_events_event_type_check'`, [], (r) => /ARCHIVE_CLAIM_DECLINED/.test(r.rows[0].d));
  await c.query(readFileSync(join(here, '..', 'migrations', '20261008000000_archive.sql'), 'utf8'));
  await expectOk(c, 'an admin deletes an archive exhibit', ADMIN, `select admin_delete_archive($1)`, [K]);
  await expectErr(c, '…once', ADMIN, `select admin_delete_archive($1)`, [K], /NO_SUCH_EXHIBIT/);
  await expectSu(c, '…its makers and claims go with it', `select (select count(*) from archive_makers where exhibit_id=$1)::int + (select count(*) from archive_claims where exhibit_id=$1)::int as n`, [K], (r) => r.rows[0].n === 0);

  console.log('the officers’ space (D-123)');
  await c.query(readFileSync(join(here, '..', 'migrations', '20261008000100_officers.sql'), 'utf8'));
  await as(c, ADMIN, `select admin_save_affiliation('officers-2026', 'Officers 2026–27', false)`);
  await as(c, ADMIN, `select admin_save_affiliation('officers-2025', 'Officers 2025–26', false)`);
  await as(c, ADMIN, `select admin_save_affiliation('robotics', 'Robotics Club', false)`);
  await expectErr(c, 'members cannot make an officers’ team', A, `select admin_set_officers('officers-2026', true, null)`, [], /NOT_ADMIN/);
  await expectErr(c, 'visitors cannot either', 'anon', `select admin_set_officers('officers-2026', true, null)`, [], /permission denied/);
  await expectErr(c, 'the team must be an affiliation', ADMIN, `select admin_set_officers('nope', true, null)`, [], /NO_SUCH_AFFILIATION/);
  await expectOk(c, 'an admin makes an affiliation an officers’ team for a term', ADMIN, `select admin_set_officers('officers-2026', true, ${today} + 200)`, []);
  await expectErr(c, 'only an officers’ team has positions', ADMIN, `select admin_set_officer($1, 'robotics', 'Captain', 1)`, [A], /NOT_OFFICERS/);
  await expectErr(c, 'members cannot name officers', A, `select admin_set_officer($1, 'officers-2026', 'President', 1)`, [A], /NOT_ADMIN/);
  await expectErr(c, 'a position is 2 to 40 characters', ADMIN, `select admin_set_officer($1, 'officers-2026', 'P', 1)`, [A], /BAD_POSITION/);
  await expectErr(c, 'a seat is 1 to 100', ADMIN, `select admin_set_officer($1, 'officers-2026', 'President', 0)`, [A], /BAD_SEAT/);
  await expectErr(c, 'an officer has a card in the hall', ADMIN, `select admin_set_officer($1, 'officers-2026', 'President', 1)`, [N], /NOT_IN_HALL/);
  await expectOk(c, 'an admin names a President…', ADMIN, `select admin_set_officer($1, 'officers-2026', ' President ', 1)`, [A]);
  await expectOk(c, '…and a Vice President', ADMIN, `select admin_set_officer($1, 'officers-2026', 'Vice President', 2)`, [Ms[1]]);
  await expectOk(c, 'visitors see the current officers in their seats, with their team', 'anon', `select hall_officers() as o`, [], (r) => {
    const o = r.rows[0].o;
    return o.length === 2 && o[0].profile_id === A && o[0].position === 'President' && o[0].team === 'Officers 2026–27' && o[0].current === true && o[1].position === 'Vice President';
  });
  await expectOk(c, '…and as affiliation chips with positions', 'anon', `select position, seat from member_affiliations where member_id=$1 and key='officers-2026'`, [Ms[1]], (r) => r.rows[0].position === 'Vice President' && r.rows[0].seat === 2);
  await expectErr(c, 'members cannot write positions directly', A, `update member_affiliations set position='Supreme Leader' where member_id=$1`, [A], /permission denied/);
  await expectOk(c, 'a position can be changed', ADMIN, `select admin_set_officer($1, 'officers-2026', 'Treasurer', 3)`, [Ms[1]]);
  await expectOk(c, '…and the order follows the seats', 'anon', `select hall_officers() as o`, [], (r) => r.rows[0].o[1].position === 'Treasurer' && r.rows[0].o[1].seat === 3);
  // Last year's team: its term is over.
  await as(c, ADMIN, `select admin_set_officers('officers-2025', true, ${today} - 30)`);
  await as(c, ADMIN, `select admin_set_officer($1, 'officers-2025', 'President', 1)`, [Ms[2]]);
  await expectOk(c, 'past officers stay on record after the current ones', 'anon', `select hall_officers() as o`, [], (r) => {
    const o = r.rows[0].o;
    return o.length === 3 && o[2].profile_id === Ms[2] && o[2].current === false && o[2].team === 'Officers 2025–26' && o.slice(0, 2).every((x) => x.current);
  });
  await expectOk(c, 'the Officers’ Wing is built in', 'anon', `select museum_wings() as w`, [], (r) => r.rows[0].w.some((w) => w.key === 'officers' && w.kind === 'officers' && w.name === 'Officers’ Wing'.replace('’', "'")));
  await expectErr(c, '…it can be closed, not removed', ADMIN, `select admin_delete_wing('officers')`, [], /BUILT_IN/);
  await expectOk(c, '…and renamed, keeping its rule', ADMIN, `select admin_save_wing('officers', 'Officers Room', 'Meet the team.', array['x'], 2, true)`, []);
  await expectSu(c, '…with no tags', `select kind, tags, name from museum_wings where key='officers'`, [], (r) => r.rows[0].kind === 'officers' && r.rows[0].tags.length === 0 && r.rows[0].name === 'Officers Room');
  await expectOk(c, 'taking someone off the team removes them', ADMIN, `select set_member_affiliation($1, 'officers-2026', false)`, [Ms[1]]);
  await expectOk(c, '…from the officers', 'anon', `select hall_officers() as o`, [], (r) => !r.rows[0].o.some((x) => x.profile_id === Ms[1]));
  await expectOk(c, 'a team that is no longer an officers’ team has no officers', ADMIN, `select admin_set_officers('officers-2025', false, null)`, []);
  await expectOk(c, '…in public', 'anon', `select hall_officers() as o`, [], (r) => r.rows[0].o.length === 1 && r.rows[0].o[0].profile_id === A);
  await c.query(readFileSync(join(here, '..', 'migrations', '20261008000100_officers.sql'), 'utf8'));
  await c.query(readFileSync(join(here, '..', 'migrations', '20261006000900_museum_wings.sql'), 'utf8'));
  await expectOk(c, 'the officers migration is safe to run twice (and the wings one after it), keeping the officers and the wing', 'anon', `select hall_officers() as o, museum_wings() as w`, [], (r) =>
    r.rows[0].o[0]?.position === 'President' && r.rows[0].w.some((w) => w.key === 'officers' && w.name === 'Officers Room'));

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
