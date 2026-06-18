-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "owner_id" TEXT;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
