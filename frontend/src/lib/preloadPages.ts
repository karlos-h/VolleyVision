// Fetches the chunks of the pages a signed-in user most likely opens next, once
// the browser is idle, so navigating there doesn't wait on a chunk download.
// Same module paths as main.tsx's lazy() imports, so Vite reuses those chunks.
let started = false;

export function preloadLikelyPages(): void {
  if (started) return;
  started = true;
  const load = () => {
    // A failed preload costs nothing: lazy() fetches the chunk again on navigation.
    void import('../pages/DashboardPage').catch(() => {});
    void import('../pages/TeamDetailPage').catch(() => {});
    void import('../pages/MatchDashboardPage').catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load);
  else setTimeout(load, 1500);
}
