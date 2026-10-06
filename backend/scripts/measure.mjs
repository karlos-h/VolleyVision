#!/usr/bin/env node
// Phase 9.5.1 baseline: `node backend/scripts/measure.mjs <baseUrl> [--runs N] [--md]`.
// Signs in once (login is limited to 10/15min per email), then times each endpoint N times
// sequentially. Run 1 is "first" (cold-ish on a serverless deploy). Reads the Server-Timing
// header when the backend sends one. Env: SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_TEAM_ID, SMOKE_MATCH_ID.
// Never prints tokens, emails or bodies. Locally use http://127.0.0.1:3001 (Node's fetch tries ::1 for localhost).
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) || '').replace(/\/+$/, '');
const md = args.includes('--md');
const ri = args.indexOf('--runs');
const runs = ri >= 0 ? Math.max(1, parseInt(args[ri + 1], 10) || 5) : 5;
if (!base) { console.error('Usage: node backend/scripts/measure.mjs <baseUrl> [--runs N] [--md]'); process.exit(2); }

const { SMOKE_EMAIL: email, SMOKE_PASSWORD: password, SMOKE_TEAM_ID: team, SMOKE_MATCH_ID: match } = process.env;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD'); process.exit(1); }

let token;
try {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`login returned ${res.status}`);
  token = (await res.json()).token;
  if (!token) throw new Error('login returned no token');
} catch (e) { console.error(`Sign-in failed: ${e.message}`); process.exit(1); }

// Same naive local "YYYY-MM-DDTHH:mm" the app sends (frontend/src/lib/matchTime.ts).
const d = new Date(), p = (n) => String(n).padStart(2, '0');
const localNow = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
const targets = [
  ['GET /health', '/health', false],
  ['GET /auth/me', '/api/v1/auth/me', true],
  ['GET /coach/dashboard', `/api/v1/coach/dashboard?localNow=${localNow}`, true],
  ...(team ? [
    ['GET /analytics/teams/:id', `/api/v1/analytics/teams/${team}`, true],
    ['GET /teams/:id/my-role', `/api/v1/teams/${team}/my-role`, true],
  ] : []),
  ...(match ? [
    ['GET /analytics/matches/:id', `/api/v1/analytics/matches/${match}`, true],
    ['GET /events/by-match/:id', `/api/v1/events/by-match/${match}`, true],
  ] : []),
];
if (!team) console.log('SKIPPED team rows: SMOKE_TEAM_ID not set');
if (!match) console.log('SKIPPED match rows: SMOKE_MATCH_ID not set');

// Server-Timing: `db;dur=12.3;desc="ops=4", app;dur=30, cold;desc="true", fn;desc="iad1"`
function parseTiming(h) {
  const out = {};
  for (const part of (h || '').split(',')) {
    const [name, ...params] = part.trim().split(';');
    if (!name) continue;
    const o = {};
    for (const q of params) {
      const m = q.trim().match(/^(\w+)=(?:"([^"]*)"|(.*))$/);
      if (m) o[m[1]] = m[2] ?? m[3];
    }
    out[name] = o;
  }
  return out;
}
const num = (v) => (v === undefined || isNaN(+v) ? null : +v);
const median = (a) => { const s = a.filter((x) => x !== null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; }; // lower median
const f = (v) => (v === null || v === undefined ? '-' : Number.isInteger(v) ? String(v) : v.toFixed(1));

const results = [];
let bad = [];
for (const [label, path, auth] of targets) {
  const rows = [];
  for (let i = 1; i <= runs; i++) {
    const t0 = performance.now();
    const res = await fetch(base + path, { headers: auth ? { authorization: `Bearer ${token}` } : {} });
    await res.arrayBuffer();
    const ms = performance.now() - t0;
    const st = parseTiming(res.headers.get('server-timing'));
    const ops = (st.db?.desc || '').match(/ops=(\d+)/);
    rows.push({ run: i, status: res.status, ms, db: num(st.db?.dur), app: num(st.app?.dur), ops: ops ? +ops[1] : null, cold: st.cold?.desc ?? null, region: st.fn?.desc ?? null });
    if (res.status >= 400) bad.push(`${label} -> ${res.status}`);
  }
  results.push({ label, rows });
  if (!md) {
    console.log(`\n${label}\nrun    status  wall ms  db ms  app ms  ops  cold  region`);
    for (const r of rows) console.log(`${r.run === 1 ? 'first' : String(r.run).padEnd(5)}  ${String(r.status).padEnd(6)}  ${f(r.ms).padStart(7)}  ${f(r.db).padStart(5)}  ${f(r.app).padStart(6)}  ${f(r.ops).padStart(3)}  ${(r.cold ?? '-').padEnd(4)}  ${r.region ?? '-'}`);
  }
}

const sum = results.map(({ label, rows }) => {
  const warm = rows.length > 1 ? rows.slice(1) : rows;
  const colds = [...new Set(rows.map((r) => r.cold).filter(Boolean))];
  return [label, [...new Set(rows.map((r) => r.status))].join('/'), f(Math.min(...rows.map((r) => r.ms))), f(median(rows.map((r) => r.ms))),
    f(median(rows.map((r) => r.db))), f(median(warm.map((r) => r.ops))), colds.join(',') || '-', rows.find((r) => r.region)?.region ?? '-'];
});
const head = ['endpoint', 'status', 'min ms', 'median ms', 'median db ms', 'ops', 'cold', 'region'];
if (md) {
  console.log(`| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|`);
  for (const r of sum) console.log(`| ${r.join(' | ')} |`);
} else {
  console.log(`\nSummary (${runs} runs)\n${head.join('\t')}`);
  for (const r of sum) console.log(r.join('\t'));
}
if (bad.length) { console.error(`\nFAILED: ${[...new Set(bad)].join('; ')}`); process.exit(1); }
