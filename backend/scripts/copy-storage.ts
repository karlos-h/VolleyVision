/**
 * Copies Supabase Storage between projects for the region move (9.6.R5):
 * Supabase can't change a project's region in place, and the Free org allows
 * two ACTIVE projects, so files travel through a local folder.
 *
 *   OLD_SUPABASE_URL + OLD_SERVICE_ROLE_KEY   npx ts-node --transpile-only scripts/copy-storage.ts --export --to-dir <folder> [--apply]
 *   NEW_SUPABASE_URL + NEW_SERVICE_ROLE_KEY   npx ts-node --transpile-only scripts/copy-storage.ts --import --from-dir <folder> [--apply]
 *
 * Dry run unless --apply: lists what it would do and touches nothing. Export
 * writes buckets.json, manifest.json and <folder>/<bucket>/<path>; import
 * recreates the buckets, uploads every object at the same path (upsert), then
 * re-lists and checks count + bytes against the manifest. Exit 1 on any FAIL.
 *
 * The folder holds chat attachments and feedback files (players can be minors):
 * it must be outside the repo. Keys are read from the environment and never
 * printed. The service-role key is the only way in: the bucket has no policies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** The Singapore projects: never import into them (same list as scripts/move-db.ps1). */
export const OLD_REFS = ['rkkhrmhorgdqkxflipui', 'lnzircweyhwiemspuaav'];

export type BucketInfo = { name: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null };
export type ManifestObject = { path: string; size: number; contentType?: string };
export type Manifest = Record<string, { count: number; bytes: number; objects: ManifestObject[] }>;

export const joinPath = (prefix: string, name: string) => (prefix ? `${prefix}/${name}` : name);

export function buildManifest(byBucket: Record<string, ManifestObject[]>): Manifest {
  const m: Manifest = {};
  for (const [bucket, objects] of Object.entries(byBucket)) {
    const sorted = [...objects].sort((a, b) => a.path.localeCompare(b.path));
    m[bucket] = { count: sorted.length, bytes: sorted.reduce((n, o) => n + o.size, 0), objects: sorted };
  }
  return m;
}

/** Problems found comparing what was expected with what is actually there. Empty = identical. */
export function diffManifests(want: Manifest, got: Manifest): string[] {
  const problems: string[] = [];
  for (const [bucket, w] of Object.entries(want)) {
    const g = got[bucket];
    if (!g) { problems.push(`${bucket}: bucket missing`); continue; }
    if (g.count !== w.count) problems.push(`${bucket}: ${g.count} objects, expected ${w.count}`);
    if (g.bytes !== w.bytes) problems.push(`${bucket}: ${g.bytes} bytes, expected ${w.bytes}`);
    const have = new Map(g.objects.map((o) => [o.path, o.size]));
    for (const o of w.objects) {
      if (!have.has(o.path)) problems.push(`${bucket}/${o.path}: missing`);
      else if (have.get(o.path) !== o.size) problems.push(`${bucket}/${o.path}: ${have.get(o.path)} bytes, expected ${o.size}`);
    }
  }
  for (const bucket of Object.keys(got)) if (!want[bucket]) problems.push(`${bucket}: not in the manifest`);
  return problems;
}

/** True when `target` is `root` or below it (case-insensitive: Windows). */
export function isInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root).toLowerCase(), path.resolve(target).toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Local file for an object, refusing a path that would climb out of the bucket folder. */
export function localFile(dir: string, bucket: string, objectPath: string): string {
  const root = path.join(dir, bucket);
  const file = path.join(root, ...objectPath.split('/'));
  if (!isInside(root, file) || path.resolve(file) === path.resolve(root)) throw new Error(`unsafe object path in ${bucket}: ${objectPath}`);
  return file;
}

export type Args = { mode: 'export' | 'import'; dir: string; apply: boolean };
export function parseArgs(argv: string[]): Args | string {
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  if (has('--export') === has('--import')) return 'give exactly one of --export or --import.';
  const mode = has('--export') ? 'export' : 'import';
  const dir = val(mode === 'export' ? '--to-dir' : '--from-dir');
  if (!dir || dir.startsWith('--')) return `--${mode} needs ${mode === 'export' ? '--to-dir' : '--from-dir'} <folder>.`;
  return { mode, dir: path.resolve(dir), apply: has('--apply') };
}

// ---- Supabase calls (not unit-tested: no Supabase to talk to) ----

async function listAll(sb: SupabaseClient, bucket: string, prefix = ''): Promise<ManifestObject[]> {
  const out: ManifestObject[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    for (const e of data ?? []) {
      // Folders come back as entries with no id/metadata.
      if (!e.id) out.push(...(await listAll(sb, bucket, joinPath(prefix, e.name))));
      else out.push({ path: joinPath(prefix, e.name), size: Number(e.metadata?.size ?? 0), contentType: e.metadata?.mimetype });
    }
    if (!data || data.length < 100) break;
  }
  return out;
}

async function listBuckets(sb: SupabaseClient): Promise<BucketInfo[]> {
  const { data, error } = await sb.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  return (data ?? []).map((b) => ({ name: b.name, public: b.public, file_size_limit: b.file_size_limit ?? null, allowed_mime_types: b.allowed_mime_types ?? null }));
}

function client(urlVar: string, keyVar: string): SupabaseClient {
  const url = process.env[urlVar];
  const key = process.env[keyVar];
  if (!url || !key) { console.error(`REFUSED: ${urlVar} and ${keyVar} must both be set.`); process.exit(1); }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function printTable(rows: { check: string; result: 'PASS' | 'FAIL' | 'DRY'; note: string }[]) {
  const w = Math.max(...rows.map((r) => r.check.length));
  for (const r of rows) console.log(`${r.check.padEnd(w)}  ${r.result}  ${r.note}`);
}

async function exportAll(dir: string, apply: boolean) {
  const sb = client('OLD_SUPABASE_URL', 'OLD_SERVICE_ROLE_KEY');
  const buckets = await listBuckets(sb);
  const byBucket: Record<string, ManifestObject[]> = {};
  for (const b of buckets) byBucket[b.name] = await listAll(sb, b.name);
  const manifest = buildManifest(byBucket);
  const rows: Parameters<typeof printTable>[0] = [];
  if (!apply) {
    for (const b of buckets) rows.push({ check: `bucket ${b.name}`, result: 'DRY', note: `${manifest[b.name].count} objects, ${manifest[b.name].bytes} bytes would be downloaded` });
    printTable(rows);
    console.log(`\nDry run: nothing written. Add --apply to download into ${dir}.`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'buckets.json'), JSON.stringify(buckets, null, 2));
  for (const b of buckets) {
    let bad = 0;
    for (const o of manifest[b.name].objects) {
      const { data, error } = await sb.storage.from(b.name).download(o.path);
      if (error || !data) { bad++; console.error(`download ${b.name}/${o.path} failed`); continue; }
      const file = localFile(dir, b.name, o.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await data.arrayBuffer()));
      if (fs.statSync(file).size !== o.size) bad++;
    }
    rows.push({ check: `bucket ${b.name}`, result: bad ? 'FAIL' : 'PASS', note: `${manifest[b.name].count} objects, ${manifest[b.name].bytes} bytes${bad ? `, ${bad} bad` : ''}` });
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  printTable(rows);
  if (rows.some((r) => r.result === 'FAIL')) { console.log('\nEXPORT FAILED.'); process.exit(1); }
  console.log(`\nExport saved to ${dir}. It holds user files: keep it private, delete it after the 7-day fallback.`);
}

async function importAll(dir: string, apply: boolean) {
  const url = process.env.NEW_SUPABASE_URL ?? '';
  const hit = OLD_REFS.find((r) => url.includes(r));
  if (hit) { console.error(`REFUSED: NEW_SUPABASE_URL names the old project ${hit}: never import into it.`); process.exit(1); }
  const sb = client('NEW_SUPABASE_URL', 'NEW_SERVICE_ROLE_KEY');
  const buckets: BucketInfo[] = JSON.parse(fs.readFileSync(path.join(dir, 'buckets.json'), 'utf8'));
  const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const existing = new Set((await listBuckets(sb)).map((b) => b.name));
  const rows: Parameters<typeof printTable>[0] = [];
  for (const b of buckets) {
    const m = manifest[b.name] ?? { count: 0, bytes: 0, objects: [] };
    const opts = { public: b.public, fileSizeLimit: b.file_size_limit ?? undefined, allowedMimeTypes: b.allowed_mime_types ?? undefined };
    if (!apply) {
      rows.push({ check: `bucket ${b.name}`, result: 'DRY', note: `would ${existing.has(b.name) ? 'update' : 'create'} it and upload ${m.count} objects, ${m.bytes} bytes` });
      continue;
    }
    const { error } = existing.has(b.name) ? await sb.storage.updateBucket(b.name, opts) : await sb.storage.createBucket(b.name, opts);
    if (error) { rows.push({ check: `bucket ${b.name}`, result: 'FAIL', note: `bucket settings: ${error.message}` }); continue; }
    for (const o of m.objects) {
      const body = fs.readFileSync(localFile(dir, b.name, o.path));
      const up = await sb.storage.from(b.name).upload(o.path, body, { upsert: true, contentType: o.contentType });
      if (up.error) console.error(`upload ${b.name}/${o.path} failed: ${up.error.message}`);
    }
    const got = buildManifest({ [b.name]: await listAll(sb, b.name) });
    const problems = diffManifests({ [b.name]: m }, got);
    rows.push({ check: `bucket ${b.name}`, result: problems.length ? 'FAIL' : 'PASS', note: problems.length ? problems.slice(0, 5).join('; ') : `${m.count} objects, ${m.bytes} bytes match the manifest` });
  }
  printTable(rows);
  if (!apply) { console.log('\nDry run: nothing changed. Add --apply to create buckets and upload.'); return; }
  if (rows.some((r) => r.result === 'FAIL')) { console.log('\nIMPORT FAILED OR NOT VERIFIED.'); process.exit(1); }
  console.log('\nStorage import verified.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === 'string') { console.error(`REFUSED: ${args}`); process.exit(1); }
  // The export holds user files: never inside the repo (backend/scripts/.. = backend, .. = repo root).
  if (isInside(path.resolve(__dirname, '..', '..'), args.dir)) {
    console.error(`REFUSED: ${args.dir} is inside the repo: it would hold user files. Pick a folder outside it.`);
    process.exit(1);
  }
  await (args.mode === 'export' ? exportAll(args.dir, args.apply) : importAll(args.dir, args.apply));
}

if (require.main === module) {
  main().catch((e) => { console.error('FAILED:', e instanceof Error ? e.message : 'unknown error'); process.exit(1); });
}
