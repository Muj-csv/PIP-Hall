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

  console.log('account deletion');
  await expectOk(c, 'member deletes own account', B, `select delete_my_account()`, []);
  await expectOk(c, 'their draft is gone', ADMIN, `select * from profiles where id=$1`, [B], (r) => r.rowCount === 0);
} finally {
  await c.end();
  await db.stop();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
