-- AlterTable
ALTER TABLE "users" ADD COLUMN "password_reset_token_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "password_reset_expires_at" TIMESTAMP(3);

-- CreateIndex
-- Reset lookups are by token hash, so index it. Non-unique: the column is null
-- for every user without a pending reset, and a hash collision would be a
-- cryptographic failure rather than something to enforce at the DB level.
CREATE INDEX "users_password_reset_token_hash_idx" ON "users"("password_reset_token_hash");
