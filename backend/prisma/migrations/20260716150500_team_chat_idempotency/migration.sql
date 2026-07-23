-- AlterTable
ALTER TABLE "messages" ADD COLUMN "client_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "messages_channel_id_client_key_key" ON "messages"("channel_id", "client_key");
