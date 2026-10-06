// What Prisma's connection pool will look like, from the URL alone (9.5.8).
// Prisma 5 can't report its pool size without the `metrics` preview (a G1
// change), so this reads the one knob that matters from DATABASE_URL and
// never returns the URL itself: it holds the password.
export function describePool(url: string | undefined): string {
  if (!url) return 'DATABASE_URL unset';
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return 'DATABASE_URL unparseable';
  }
  const limit = params.get('connection_limit');
  const pooled = params.get('pgbouncer') === 'true' ? ', pgbouncer=true' : '';
  if (limit && /^\d+$/.test(limit)) return `connection_limit=${limit}${pooled}`;
  // Prisma's default: physical CPUs × 2 + 1, decided inside the engine.
  return `connection_limit=Prisma default (2×CPUs+1)${pooled}`;
}
