/**
 * After the region move (9.6.R5), points stored Supabase URLs at the NEW project.
 *
 * The only column holding a full https://<ref>.supabase.co/... URL is
 * users.profile_image (User.profileImage). MessageAttachment.storagePath and
 * FeedbackAttachment.storagePath hold object paths, not URLs (signed URLs are
 * minted on read), so they need nothing. A generic scan over every text/varchar
 * column in public double-checks that and lists any other hit; those are
 * reported, never rewritten.
 *
 *   DATABASE_URL=<NEW project>  npx ts-node --transpile-only scripts/rewrite-storage-urls.ts
 *   DATABASE_URL=<NEW project>  npx ts-node --transpile-only scripts/rewrite-storage-urls.ts --apply --old-ref <ref> --new-ref <ref>
 *
 * Dry run unless --apply: counts plus up to 5 example user ids (never emails).
 * Refuses a DATABASE_URL that names either old project. Never prints the URL.
 */
import { OLD_REFS } from './copy-storage';

const REF = /^[a-z0-9]{20}$/;

/** Swaps the project ref inside a Supabase URL; any other text is left alone. */
export function rewriteUrl(value: string, oldRef: string, newRef: string): string {
  return value.split(`${oldRef}.supabase.co`).join(`${newRef}.supabase.co`);
}

/** Why these arguments/URL must not run, or null. `url` is only inspected, never echoed. */
export function guardError(url: string, args: { apply: boolean; oldRef?: string; newRef?: string }): string | null {
  if (!url) return 'DATABASE_URL is not set.';
  const hit = OLD_REFS.find((r) => url.includes(r));
  if (hit) return `DATABASE_URL names the old project ${hit}: run this against the NEW project.`;
  if (!args.apply) return null;
  if (!args.oldRef || !args.newRef) return '--apply needs --old-ref <ref> and --new-ref <ref>.';
  if (!REF.test(args.oldRef) || !REF.test(args.newRef)) return 'a project ref is 20 lowercase letters/digits.';
  if (!OLD_REFS.includes(args.oldRef)) return `--old-ref must be one of the old Singapore projects (${OLD_REFS.join(', ')}).`;
  if (OLD_REFS.includes(args.newRef)) return '--new-ref is an old Singapore project.';
  if (!/@(127\.0\.0\.1|localhost|\[::1\]):/.test(url) && !url.includes(args.newRef)) return "DATABASE_URL doesn't contain --new-ref: wrong project?";
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  const args = { apply: argv.includes('--apply'), oldRef: val('--old-ref'), newRef: val('--new-ref') };
  const url = process.env.DATABASE_URL ?? '';
  const err = guardError(url, args);
  if (err) { console.error(`REFUSED: ${err}`); process.exit(1); }

  // Explicit datasource: Prisma would otherwise fall back to backend/.env (prod) for anything unset.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const refs = args.apply ? [args.oldRef!] : OLD_REFS;
    const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `SELECT c.table_name, c.column_name FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
       WHERE c.table_schema = 'public' AND c.data_type IN ('text', 'character varying') ORDER BY 1, 2`);
    const scan = async () => {
      const hits: { table: string; column: string; n: number }[] = [];
      for (const c of cols) {
        const patterns = refs.map((r) => `%${r}.supabase.co%`);
        const [row] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM public."${c.table_name}" WHERE "${c.column_name}" LIKE ANY ($1::text[])`, patterns);
        if (Number(row.n) > 0) hits.push({ table: c.table_name, column: c.column_name, n: Number(row.n) });
      }
      return hits;
    };

    const before = await scan();
    console.log(`Scanned ${cols.length} text columns for ${refs.map((r) => `${r}.supabase.co`).join(' / ')}.`);
    for (const h of before) console.log(`  ${h.table}.${h.column}: ${h.n} rows${h.table === 'users' && h.column === 'profile_image' ? '' : '   <- unexpected: not rewritten by this script'}`);
    if (!before.length) console.log('  no hits.');
    const examples = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM public.users WHERE profile_image LIKE ANY ($1::text[]) LIMIT 5`, refs.map((r) => `%${r}.supabase.co%`));
    if (examples.length) console.log(`  example user ids: ${examples.map((e) => e.id).join(', ')}`);

    if (!args.apply) { console.log('\nDry run: nothing changed. Add --apply --old-ref <ref> --new-ref <ref> to rewrite users.profile_image.'); return; }

    const n = await prisma.$executeRawUnsafe(
      `UPDATE public.users SET profile_image = replace(profile_image, $1, $2) WHERE profile_image LIKE $3`,
      `${args.oldRef}.supabase.co`, `${args.newRef}.supabase.co`, `%${args.oldRef}.supabase.co%`);
    console.log(`\nusers.profile_image: ${n} rows rewritten.`);
    const after = await scan();
    console.log(after.length ? `FAIL: ${after.map((h) => `${h.table}.${h.column}=${h.n}`).join(', ')} still name the old project.` : 'PASS: no column names the old project any more.');
    if (after.length) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('FAILED:', e instanceof Error ? e.message.split('\n').pop() : 'unknown error'); process.exit(1); });
}
