// Guard for admin scripts that write (9.0.8 scrub-deleted-messages, 9.4
// delete-account). Prisma and dotenv fill an unset DATABASE_URL from
// backend/.env, which is production, so the target must be explicit: a local
// DATABASE_URL, or --prod to mean backend/.env. Call it with process.env read
// BEFORE anything imports lib/prisma or runs dotenv.

import { isLocal } from './localDb';

type Env = Record<string, string | undefined>;

export type AdminTarget =
  | { apply: boolean; prod: boolean; env: Env }
  | { error: string };

/** `env` is what to pin into process.env before loading Prisma. */
export function adminScriptTarget(argv: string[], env: Env): AdminTarget {
  const apply = argv.includes('--apply');
  if (argv.includes('--prod')) {
    // dotenv never overrides a variable the shell already set: a preset URL
    // would win over backend/.env while the script used production's mail and
    // storage keys.
    if (env.DATABASE_URL || env.DIRECT_URL) {
      return { error: 'Refusing --prod: DATABASE_URL or DIRECT_URL is already set in this shell and would be used instead of backend/.env. Open a fresh shell, or remove them, and run it again.' };
    }
    return { apply, prod: true, env: {} };
  }

  const url = env.DATABASE_URL ?? '';
  const direct = env.DIRECT_URL || url;
  if (!isLocal(url) || !isLocal(direct)) {
    return {
      error: 'Refusing to run: set DATABASE_URL (and DIRECT_URL, if set) to a local database, '
        + 'or pass --prod to use backend/.env (production).',
    };
  }
  // Blank, not unset: dotenv and Prisma Client never overwrite a set
  // variable, so a local run can't pick up production's storage keys or its
  // SMTP login from backend/.env (it once sent a real email that way).
  return {
    apply, prod: false,
    env: {
      DIRECT_URL: direct,
      SUPABASE_URL: env.SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      SMTP_HOST: env.SMTP_HOST ?? '', SMTP_USER: env.SMTP_USER ?? '', SMTP_PASS: env.SMTP_PASS ?? '',
    },
  };
}

type RunMode = { prod: boolean; apply: boolean };

/** Writing to production asks for the printed project ref to be typed back. */
export const needsProdConfirmation = (t: RunMode): boolean => t.prod && t.apply;

/** `typed` is the answer to that prompt (null when stdin closed). */
export function confirmsProdApply(t: RunMode, ref: string, typed: string | null): boolean {
  if (!needsProdConfirmation(t)) return true;
  return ref !== 'unknown' && typed?.trim() === ref;
}

/** Asks on the terminal when `needsProdConfirmation`; the decision is `confirmsProdApply`. */
export async function askProdConfirmation(t: RunMode, ref: string): Promise<boolean> {
  if (!needsProdConfirmation(t)) return true;
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const closed = new Promise<null>((resolve) => rl.once('close', () => resolve(null)));
  const typed = await Promise.race([rl.question(`This writes to PRODUCTION (${ref}). Type that project ref to go ahead: `), closed]);
  rl.close();
  return confirmsProdApply(t, ref, typed);
}

/** Which database, without printing the URL (it holds the password). */
export function projectRef(url: string | undefined): string {
  try {
    const u = new URL(url ?? '');
    const fromUser = /^postgres\.([a-z0-9]+)$/.exec(u.username); // Supabase pooler
    const fromHost = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(u.hostname); // direct
    return fromUser?.[1] ?? fromHost?.[1] ?? u.hostname;
  } catch {
    return 'unknown';
  }
}
