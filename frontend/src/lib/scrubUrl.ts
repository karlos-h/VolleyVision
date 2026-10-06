// Copy of backend/src/lib/scrubUrl.ts, which is tested there: its drift check
// fails if everything from CREDENTIAL_SEGMENTS down differs. Pure on purpose
// (no Sentry import) so main.tsx can hand these straight to Sentry.init.

const CREDENTIAL_SEGMENTS: Array<[RegExp, string]> = [
  [/\/invitations\/lookup\/[^/]+/g, '/invitations/lookup/:code'],
  [/\/invitations\/[^/]+\/(accept|decline)(?=\/|$)/g, '/invitations/:token/$1'],
];

export function scrubUrl(url: string): string {
  let out = url.split('?')[0].split('#')[0];
  for (const [pattern, replacement] of CREDENTIAL_SEGMENTS) out = out.replace(pattern, replacement);
  return out;
}

// Only the fields touched are described, so this needs no Sentry type.
type Data = Record<string, unknown>;
type ScrubbableEvent = {
  request?: { url?: string; query_string?: unknown };
  breadcrumbs?: Array<{ data?: Data }>;
};
type ScrubbableTransaction = ScrubbableEvent & {
  transaction?: string;
  spans?: Array<{ description?: string; data?: Data }>;
  contexts?: { trace?: { data?: Data } };
};

export function scrubUrls<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    delete event.request.query_string;
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
  }
  // fetch/xhr breadcrumbs carry `url`; navigation breadcrumbs carry `from` and
  // `to`. Scrubbing only `url` let a team join code from
  // /redeem-invitation?code=... (or a reset/verify token) ride along on any
  // later error in the same browser session.
  for (const crumb of event.breadcrumbs ?? []) {
    const data = crumb.data;
    if (!data) continue;
    for (const key of ['url', 'from', 'to']) {
      const value = data[key];
      if (typeof value === 'string') data[key] = scrubUrl(value);
    }
  }
  return event;
}

// Span attributes that hold a URL (folded by path shape) or just its query or
// fragment (deleted: they can hold tokens under any key name).
function scrubSpanData(data: Data | undefined) {
  if (!data) return;
  for (const key of ['url', 'http.url', 'url.full']) {
    if (typeof data[key] === 'string') data[key] = scrubUrl(data[key] as string);
  }
  delete data['http.query'];
  delete data['http.fragment'];
}

// Tracing makes fetch spans: their description ("POST /api/v1/invitations/<token>/accept")
// and URL attributes carry the same credentials the request and breadcrumbs do,
// and scrubUrls never looks at them.
export function scrubTransaction<T extends ScrubbableTransaction>(event: T): T {
  scrubUrls(event);
  if (typeof event.transaction === 'string') event.transaction = scrubUrl(event.transaction);
  for (const span of event.spans ?? []) {
    if (typeof span.description === 'string') span.description = scrubUrl(span.description);
    scrubSpanData(span.data);
  }
  scrubSpanData(event.contexts?.trace?.data);
  return event;
}
