-- 9.6.0.2 (sign out ends the session on the server). Additive only.
--   * revoked_tokens: the jti of each JWT signed out of before it expired,
--     kept until expires_at (the token's own exp). user_id is nullable for
--     rows not tied to an account; an account's rows go with it.

-- CreateTable
CREATE TABLE "revoked_tokens" (
    "jti" TEXT NOT NULL,
    "user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "revoked_tokens_expires_at_idx" ON "revoked_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "revoked_tokens" ADD CONSTRAINT "revoked_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A new table enables RLS and loses Supabase's default anon/authenticated
-- grants in its own migration (20260927221052 only covered the tables that
-- existed then). The guard lets this run on plain Postgres (CI).
ALTER TABLE "revoked_tokens" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "revoked_tokens" FROM anon, authenticated;
  END IF;
END $$;
