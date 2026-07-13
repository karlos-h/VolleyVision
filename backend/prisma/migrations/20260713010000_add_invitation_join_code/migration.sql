-- AlterTable: add nullable, unique human-enterable join code for the email flow.
-- Nullable so pre-existing invitations remain valid (they use `token`).
ALTER TABLE "invitations" ADD COLUMN "join_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invitations_join_code_key" ON "invitations"("join_code");
