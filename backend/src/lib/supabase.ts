// Supabase Storage client — Team Chat attachments live in the private
// `team-chat` bucket. Supabase is an OBJECT STORE ONLY here: the app database
// stays local Postgres/Prisma, and MessageAttachment.storagePath is the link
// between the two. The service-role key is server-only (bypasses RLS; the
// private bucket is default-deny to everyone else) — it must never reach the
// frontend or logs.

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Self-load env: index.ts calls dotenv.config() only after its imports have
// evaluated, and standalone scripts import this module directly.
dotenv.config();

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  // Fail fast at startup rather than 500ing on the first upload.
  throw new Error(
    'Supabase Storage is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env (see .env.example).',
  );
}

export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
