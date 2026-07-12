-- CreateTable
CREATE TABLE "player_team_links" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_team_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_team_links_player_id_idx" ON "player_team_links"("player_id");

-- CreateIndex
CREATE INDEX "player_team_links_team_id_idx" ON "player_team_links"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_team_links_player_id_team_id_key" ON "player_team_links"("player_id", "team_id");

-- AddForeignKey
ALTER TABLE "player_team_links" ADD CONSTRAINT "player_team_links_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_team_links" ADD CONSTRAINT "player_team_links_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
