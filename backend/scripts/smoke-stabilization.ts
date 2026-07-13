/**
 * End-to-end smoke test for Stabilization Pass 2 (visibility + approval queue).
 * Boots the real Express app in-process, mints real JWTs, and asserts over HTTP.
 * Idempotent: creates its own throwaway users/team and deletes them at the end.
 *
 *   npx ts-node scripts/smoke-stabilization.ts
 */
process.env.PORT = process.env.SMOKE_PORT ?? '3999';
import { prisma } from '../src/lib/prisma';
import { generateToken } from '../src/services/auth.service';

const BASE = `http://localhost:${process.env.PORT}/api/v1`;
let failures = 0;

function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✔' : '✖'} ${name}${cond ? '' : `  — ${detail}`}`);
  if (!cond) failures++;
}

async function req(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* 204 etc */ }
  return { status: res.status, json };
}

async function upsertUser(email: string, first: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, firstName: first, lastName: 'Smoke', passwordHash: 'x', role: 'COACH' },
  });
}

async function main() {
  // ── Seed ──
  const owner = await upsertUser('smoke.owner@vv.test', 'Owner');
  const asst = await upsertUser('smoke.asst@vv.test', 'Asst');
  const stranger = await upsertUser('smoke.stranger@vv.test', 'Stranger');
  const admin = await prisma.user.findUnique({ where: { email: 'karlos.hennings@gmail.com' } });

  const team = await prisma.team.create({
    data: { name: 'Smoke Private', season: '2026', isPublic: false, ownerId: owner.id },
  });
  await prisma.teamMembership.create({ data: { userId: asst.id, teamId: team.id, role: 'ASSISTANT_COACH' } });

  const tok = (u: { id: string; email: string; role: string }) => generateToken({ userId: u.id, email: u.email, role: u.role });
  const ownerT = tok(owner), asstT = tok(asst), strangerT = tok(stranger);
  const adminT = admin ? tok(admin) : null;

  // Boot the real Express app in-process (dynamic import so PORT is already set),
  // then give it a moment to bind.
  await import('../src/index');
  await new Promise((r) => setTimeout(r, 1200));

  // ── (a) Private-team visibility ──
  console.log('\n── Visibility (private team) ──');
  check('anonymous GET private team → 404', (await req('GET', `/teams/${team.id}`)).status === 404);
  check('stranger GET private team → 404', (await req('GET', `/teams/${team.id}`, strangerT)).status === 404);
  check('member (assistant) GET private team → 200', (await req('GET', `/teams/${team.id}`, asstT)).status === 200);
  check('owner GET private team → 200', (await req('GET', `/teams/${team.id}`, ownerT)).status === 200);
  if (adminT) check('admin GET private team → 200', (await req('GET', `/teams/${team.id}`, adminT)).status === 200);
  check('stranger GET private team analytics → 404', (await req('GET', `/analytics/teams/${team.id}`, strangerT)).status === 404);
  // Team list scoping
  const strangerList = await req('GET', '/teams', strangerT);
  check('private team absent from stranger team list',
    Array.isArray(strangerList.json) && !strangerList.json.some((t: any) => t.id === team.id));
  const ownerList = await req('GET', '/teams', ownerT);
  check('private team present in owner team list',
    Array.isArray(ownerList.json) && ownerList.json.some((t: any) => t.id === team.id));

  // ── (b) Approval queue ──
  console.log('\n── Approval queue ──');
  const asstAdd = await req('POST', '/players', asstT, {
    firstName: 'Queued', lastName: 'Player', jerseyNumber: 77, position: 'SETTER', teamId: team.id,
  });
  check('assistant add player → 202 pending_approval', asstAdd.status === 202 && asstAdd.json?.status === 'pending_approval',
    `got ${asstAdd.status} ${JSON.stringify(asstAdd.json)}`);
  const requestId = asstAdd.json?.requestId;

  const rosterAfterQueue = await req('GET', `/players/by-team/${team.id}`, ownerT);
  check('player NOT on roster while pending',
    Array.isArray(rosterAfterQueue.json) && !rosterAfterQueue.json.some((p: any) => p.jerseyNumber === 77));

  const list = await req('GET', `/teams/${team.id}/approval-requests?status=PENDING`, ownerT);
  check('head coach sees pending request',
    Array.isArray(list.json) && list.json.some((r: any) => r.id === requestId));

  const strangerApprove = await req('POST', `/approval-requests/${requestId}/approve`, strangerT);
  check('stranger cannot approve → 403/404', [403, 404].includes(strangerApprove.status), `got ${strangerApprove.status}`);

  const approve = await req('POST', `/approval-requests/${requestId}/approve`, ownerT);
  check('head coach approves → 200', approve.status === 200, `got ${approve.status} ${JSON.stringify(approve.json)}`);

  const rosterAfterApprove = await req('GET', `/players/by-team/${team.id}`, ownerT);
  check('player appears after approval',
    Array.isArray(rosterAfterApprove.json) && rosterAfterApprove.json.some((p: any) => p.jerseyNumber === 77));

  // Immediate path: owner add applies at once
  const ownerAdd = await req('POST', '/players', ownerT, {
    firstName: 'Direct', lastName: 'Player', jerseyNumber: 88, position: 'LIBERO', teamId: team.id,
  });
  check('owner add player → 201 immediate', ownerAdd.status === 201, `got ${ownerAdd.status}`);

  // ── Cleanup ──
  await prisma.team.delete({ where: { id: team.id } }); // cascades players/memberships/approvals
  await prisma.user.deleteMany({ where: { email: { in: ['smoke.owner@vv.test', 'smoke.asst@vv.test', 'smoke.stranger@vv.test'] } } });

  console.log(`\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} SMOKE CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
