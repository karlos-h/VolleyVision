// Free Supabase projects pause after ~7 days of low activity; a cheap query
// every few hours keeps a quiet instance awake. Only where the machine is always on (prod):
// the staging machine stops when idle, so its timer never fires.
export function startKeepAlive({ ping, intervalMs = 6 * 60 * 60 * 1000, log = console.debug }: {
  ping: () => Promise<unknown>;
  intervalMs?: number;
  log?: (msg: string) => void;
}): () => void {
  const timer = setInterval(() => {
    ping().then(() => log('keep-alive ok'), () => log('keep-alive failed'));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
