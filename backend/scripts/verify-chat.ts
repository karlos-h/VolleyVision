// Team Chat slice 2 — end-to-end verification against a running dev server.
// Registers three throwaway users (coach / player / viewer), grants them roles
// on the seeded Canterbury Falcons team, exercises every chat endpoint and
// permission edge, then removes everything it created. Safe to re-run.
//
// Run: npx ts-node scripts/verify-chat.ts   (server must be up on PORT/3001)

import assert from 'node:assert/strict';
import { PrismaClient, TeamRole } from '@prisma/client';

const API = `http://localhost:${process.env.PORT || 3001}/api/v1`;
const TEAM_ID = 'seed-team-1';
const PASSWORD = 'chat-verify-pass-1';

const prisma = new PrismaClient();

interface TestUser {
  email: string;
  token: string;
  userId: string;
}

async function req(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function ensureUser(email: string, firstName: string, lastName: string): Promise<TestUser> {
  let r = await req('POST', '/auth/register', undefined, { email, password: PASSWORD, firstName, lastName });
  if (r.status === 409) r = await req('POST', '/auth/login', undefined, { email, password: PASSWORD });
  assert.ok(r.status === 201 || r.status === 200, `auth for ${email} failed: ${r.status} ${JSON.stringify(r.json)}`);
  return { email, token: r.json.token, userId: r.json.user.id };
}

async function grantRole(userId: string, role: TeamRole) {
  await prisma.teamMembership.upsert({
    where: { userId_teamId: { userId, teamId: TEAM_ID } },
    update: { role },
    create: { userId, teamId: TEAM_ID, role },
  });
}

async function main() {
  const health = await fetch(`http://localhost:${process.env.PORT || 3001}/health`).catch(() => null);
  assert.ok(health?.ok, 'Dev server is not running — start it first (npm run dev).');

  const coach = await ensureUser('chat-verify-coach@volleyvision.test', 'Verify', 'Coach');
  const player = await ensureUser('chat-verify-player@volleyvision.test', 'Verify', 'Player');
  const viewer = await ensureUser('chat-verify-viewer@volleyvision.test', 'Verify', 'Viewer');
  const users = [coach, player, viewer];

  try {
    await grantRole(coach.userId, TeamRole.HEAD_COACH);
    await grantRole(player.userId, TeamRole.PLAYER);
    await grantRole(viewer.userId, TeamRole.VIEWER);

    // ── Channel get-or-create, member read access ────────────────────────────
    const chCoach = await req('GET', `/teams/${TEAM_ID}/channel`, coach.token);
    assert.equal(chCoach.status, 200, 'coach can fetch channel');
    const channelId: string = chCoach.json.id;
    assert.equal(chCoach.json.type, 'TEAM');

    const chPlayer = await req('GET', `/teams/${TEAM_ID}/channel`, player.token);
    assert.equal(chPlayer.status, 200, 'player can fetch channel');
    assert.equal(chPlayer.json.id, channelId, 'same channel for every member');

    assert.equal((await req('GET', `/teams/${TEAM_ID}/channel`)).status, 401, 'anonymous is rejected');

    // ── Posting ──────────────────────────────────────────────────────────────
    const coachMsg = await req('POST', `/channels/${channelId}/messages`, coach.token, { body: 'Verify: coach message' });
    assert.equal(coachMsg.status, 201, `coach can post: ${JSON.stringify(coachMsg.json)}`);
    assert.equal(coachMsg.json.sender.firstName, 'Verify');

    const playerMsg = await req('POST', `/channels/${channelId}/messages`, player.token, { body: '  Verify: player message  ' });
    assert.equal(playerMsg.status, 201, 'player can post');
    assert.equal(playerMsg.json.body, 'Verify: player message', 'body is trimmed');

    const viewerPost = await req('POST', `/channels/${channelId}/messages`, viewer.token, { body: 'nope' });
    assert.equal(viewerPost.status, 403, 'VIEWER cannot post');

    assert.equal((await req('POST', `/channels/${channelId}/messages`, player.token, { body: '   ' })).status, 400, 'whitespace-only rejected');
    assert.equal((await req('POST', `/channels/${channelId}/messages`, player.token, { body: 'x'.repeat(4001) })).status, 400, 'over-length rejected');
    assert.equal((await req('POST', `/channels/unknown-channel/messages`, player.token, { body: 'hi' })).status, 404, 'unknown channel 404s');

    // ── Listing ──────────────────────────────────────────────────────────────
    const listViewer = await req('GET', `/channels/${channelId}/messages?limit=50`, viewer.token);
    assert.equal(listViewer.status, 200, 'VIEWER can read');
    const bodies = listViewer.json.map((m: any) => m.body);
    assert.ok(bodies.includes('Verify: coach message') && bodies.includes('Verify: player message'), 'both messages visible');

    // ── Edit ─────────────────────────────────────────────────────────────────
    const edit = await req('PATCH', `/messages/${playerMsg.json.id}`, player.token, { body: 'Verify: player message (edited)' });
    assert.equal(edit.status, 200, 'author can edit');
    assert.ok(edit.json.editedAt, 'editedAt set');
    assert.equal((await req('PATCH', `/messages/${coachMsg.json.id}`, player.token, { body: 'hijack' })).status, 403, 'non-author cannot edit');

    // ── Delete: author vs moderator ──────────────────────────────────────────
    assert.equal((await req('DELETE', `/messages/${coachMsg.json.id}`, player.token)).status, 403, 'player cannot delete coach message');

    const selfDelete = await req('DELETE', `/messages/${playerMsg.json.id}`, player.token);
    assert.equal(selfDelete.status, 200, 'author can delete own');
    assert.equal(selfDelete.json.body, null, 'delete returns tombstone');

    const modDelete = await req('DELETE', `/messages/${coachMsg.json.id}`, coach.token);
    assert.equal(modDelete.status, 200, 'author/moderator delete works');

    const playerMsg2 = await req('POST', `/channels/${channelId}/messages`, player.token, { body: 'Verify: to be moderated' });
    const modDelete2 = await req('DELETE', `/messages/${playerMsg2.json.id}`, coach.token);
    assert.equal(modDelete2.status, 200, 'coach can moderate-delete a player message');

    assert.equal((await req('PATCH', `/messages/${playerMsg2.json.id}`, player.token, { body: 'too late' })).status, 409, 'edit after delete is 409');
    assert.equal((await req('DELETE', `/messages/${playerMsg2.json.id}`, player.token)).status, 200, 'repeat delete is idempotent');

    // ── Tombstones in the list ───────────────────────────────────────────────
    const listAfter = await req('GET', `/channels/${channelId}/messages?limit=50`, player.token);
    const deleted = listAfter.json.find((m: any) => m.id === playerMsg2.json.id);
    assert.ok(deleted, 'deleted message still present in the page');
    assert.equal(deleted.body, null, 'tombstone body is null');
    assert.deepEqual(deleted.attachments, [], 'tombstone attachments empty');

    // ── Pagination ───────────────────────────────────────────────────────────
    const posted: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const r = await req('POST', `/channels/${channelId}/messages`, player.token, { body: `Verify: page ${i}` });
      assert.equal(r.status, 201);
      posted.push(r.json.id);
    }

    const latest = await req('GET', `/channels/${channelId}/messages?limit=5`, player.token);
    assert.equal(latest.json.length, 5, 'limit respected');
    assert.deepEqual(latest.json.map((m: any) => m.id), posted.slice(3), 'latest page = last 5, ascending');

    const older = await req('GET', `/channels/${channelId}/messages?limit=3&before=${posted[3]}`, player.token);
    assert.deepEqual(older.json.map((m: any) => m.id), posted.slice(0, 3), 'before= pages older messages');

    const delta = await req('GET', `/channels/${channelId}/messages?after=${posted[5]}`, player.token);
    assert.deepEqual(delta.json.map((m: any) => m.id), posted.slice(6), 'after= returns only newer (poll delta)');

    console.log('\n✅ Slice 2 verification passed — all endpoint + permission checks green.');
  } finally {
    // ── Cleanup: everything this script created ──────────────────────────────
    const ids = users.map((u) => u.userId);
    await prisma.message.deleteMany({ where: { senderId: { in: ids } } });
    await prisma.teamMembership.deleteMany({ where: { userId: { in: ids }, teamId: TEAM_ID } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log('🧹 Cleaned up verification users, memberships, and messages.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
