// Fly sends SIGTERM and kills the machine 15 s later (kill_timeout), so finish
// in-flight requests, release Postgres sessions (the session pooler has a small
// cap) and flush Sentry, then exit. The timer is the backstop for a keep-alive
// socket that never lets server.close() call back.
type Opts = {
  server: { close(cb: () => void): unknown };
  disconnect: () => Promise<unknown>;
  flush: () => Promise<unknown>;
  exit: (code: number) => void;
  log: (msg: string) => void;
  hardExitMs?: number;
  proc?: { on(sig: string, fn: () => void): unknown };
};

export function installShutdown({ server, disconnect, flush, exit, log, hardExitMs = 10_000, proc = process }: Opts): void {
  let shuttingDown = false;
  const onSignal = () => {
    if (shuttingDown) return exit(1);
    shuttingDown = true;
    log('shutting down');
    setTimeout(() => exit(1), hardExitMs).unref();
    server.close(() => {
      void (async () => {
        try { await disconnect(); await flush(); } catch { /* exiting anyway */ }
        exit(0);
      })();
    });
  };
  proc.on('SIGTERM', onSignal);
  proc.on('SIGINT', onSignal);
}
