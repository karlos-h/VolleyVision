-- AlterTable
ALTER TABLE "teams" ADD COLUMN "player_join_code" TEXT;
ALTER TABLE "teams" ADD COLUMN "staff_join_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "teams_player_join_code_key" ON "teams"("player_join_code");

-- CreateIndex
CREATE UNIQUE INDEX "teams_staff_join_code_key" ON "teams"("staff_join_code");
