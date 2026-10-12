# Fly.io setup (API)

The API runs as one always-on machine in `syd`. Two apps: `volleyvision-api` (prod, `backend/fly.prod.toml`) and `volleyvision-api-staging` (`backend/fly.staging.toml`, stops when idle). The Netlify Function stays as the rollback until Phase 9.7.

## Environment variables

"In toml" = non-secret, already in `fly.*.toml`. "Secret" = Karlos sets it on the Fly app; never commit a value.

| Name | Secret? | Where it comes from | Notes |
|---|---|---|---|
| `DATABASE_URL` | **secret** | Supabase, Connect, **session pooler** | Port 5432, user `postgres.<ref>`, **without** `pgbouncer=true`, with `connection_limit=8`. |
| `DIRECT_URL` | **secret** | Same session pooler string | Karlos's network is IPv4 and the direct host is IPv6-only on Free. Only migrations use it. |
| `JWT_SECRET` | **secret** | Generate: `openssl rand -base64 48` | Required; every login 500s without it. Changing it signs everyone out. |
| `JWT_EXPIRES_IN` | no | Optional, defaults to `7d` | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER` | no | Same as the Netlify env | Optional; unset = invitation/reset emails are not sent. |
| `SMTP_PASS` | **secret** | Gmail App Password | |
| `SUPABASE_URL` | no | Supabase project URL | Attachment storage only; unset = clean 503 on those endpoints. |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Supabase, API keys | Server-only. |
| `SUPABASE_CHAT_BUCKET` | no | `team-chat` | |
| `SENTRY_DSN` | no | Sentry project | Write-only ingestion key. |
| `SENTRY_ENVIRONMENT` | no | In toml (staging only) | `staging` keeps Server-Timing and measurement on. |
| `CLIENT_URL` | no | The site that serves the SPA, per app | Prod and staging differ. |
| `CORS_EXTRA_ORIGINS` | no | Comma-separated | Must include `https://localhost,capacitor://localhost` or the apps fail every call. |
| `API_PROXY_SIGNING_SECRET` | **secret** | Generate; the same value goes into the Netlify proxy | Added by R3. |
| `STAGING_PROJECT_REF` | no | Staging Supabase ref | Only `db:seed:staging`; not needed on Fly. |
| `NODE_ENV`, `PORT` | no | In toml | `production`, `8080`. |
| `FLY_APP_NAME` | no | Set by Fly | |
| `NETLIFY`, `AWS_LAMBDA_FUNCTION_NAME`, `AWS_REGION` | no | Set by Netlify/Lambda | Must stay **unset** on Fly: `NETLIFY` stops the server listening. |

## Setting secrets without leaving them in PowerShell history

- Easiest: Fly dashboard, the app, Secrets.
- Or put `NAME=value` lines in a temporary file and run `fly secrets import -a <app> < secrets.txt`, then delete the file.
- A plain `fly secrets set NAME=value` is saved by PSReadLine. If you insist, run `Set-PSReadLineOption -HistorySaveStyle SaveNothing` first.

## Deploy

From `backend/`: `fly deploy -c fly.staging.toml --ha=false`. Prod (`fly.prod.toml`) only on Karlos's go. Migrations are not run on deploy; apply them first with `npx prisma migrate deploy`.

## Logs and ssh

`fly logs -a <app>`, `fly status -a <app>`, `fly ssh console -a <app>`.

## Headers seen on Fly (R3 investigation)

Why: per-IP rate limits (login, register, forgot/reset password, verify email, join codes) need the real client address. Behind Netlify's proxy the right-most `x-forwarded-for` hop is Netlify's edge, shared by every user, and anyone can call `*.fly.dev` directly with any headers they like.

What the code does (R3):

- Netlify signs each proxied request (`signed = "API_PROXY_SIGNING_SECRET"` on the proxy rule) with an `x-nf-sign` header: an HS256 JWS over `{ deploy_context, exp, iss: "netlify", netlify_id, site_url }` ([Netlify docs](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/#signed-proxy-redirects)). The secret is a Netlify site env var (Runtime scope) and the same value is the Fly secret `API_PROXY_SIGNING_SECRET`; staging and prod each get their own value.
- On Fly (`FLY_APP_NAME` set), `middleware/proxySignature.ts` answers `403 Forbidden.` to anything without a valid signature (HS256 only, issuer `netlify`, `exp` required, 60 s clock tolerance), except `GET /health/live`. Secret missing: `503` on everything but `/health/live`, logged once.
- `lib/clientIp.ts`: signed requests key on `x-nf-client-connection-ip` (or one shared `unknown` bucket if it is absent); unsigned Fly requests on the socket address; off Fly (the Netlify Function, local dev) unchanged.
- `x-nf-sign` and `fly-client-ip` are dropped from Sentry events with the other address headers.

To confirm on staging (R6), once staging is on Fly with the signed proxy:

1. `GET https://volleyvision-staging.netlify.app/api/v1/debug/headers` (staging only: `SENTRY_ENVIRONMENT=staging`). It returns header names, the values of `x-nf-client-connection-ip`, `x-forwarded-for`, `fly-client-ip`, `x-real-ip`, `proxyVerified` and the socket address. Expect `proxyVerified: true` and your own public IP in `x-nf-client-connection-ip`.
2. Same URL with `-H "x-nf-client-connection-ip: 1.2.3.4"`: the value must still be your real IP. If it shows `1.2.3.4`, Netlify passes the caller's header through and clientIp() must not trust it (fall back below).
3. Same path on `https://volleyvision-api-staging.fly.dev`: expect `403`.
4. Record the results here, then delete `routes/debug.ts` and its mount.

If no client address arrives through the proxy at all: key the per-IP limits on the verified proxy's hop (`fly-client-ip`) and add per-account limits where an IP arm stands alone (register, reset, verify). Not built unless R6 shows it is needed.

Results: _pending R6._
