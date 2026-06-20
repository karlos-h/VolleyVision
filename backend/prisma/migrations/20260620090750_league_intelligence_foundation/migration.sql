-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "division" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_seasons" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_teams" (
    "id" TEXT NOT NULL,
    "league_season_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_matches" (
    "id" TEXT NOT NULL,
    "league_season_id" TEXT NOT NULL,
    "home_league_team_id" TEXT NOT NULL,
    "away_league_team_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "home_match_id" TEXT,
    "away_match_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leagues_created_by_user_id_idx" ON "leagues"("created_by_user_id");

-- CreateIndex
CREATE INDEX "league_seasons_league_id_idx" ON "league_seasons"("league_id");

-- CreateIndex
CREATE INDEX "league_teams_team_id_idx" ON "league_teams"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "league_teams_league_season_id_team_id_key" ON "league_teams"("league_season_id", "team_id");

-- CreateIndex
CREATE INDEX "league_matches_league_season_id_idx" ON "league_matches"("league_season_id");

-- CreateIndex
CREATE INDEX "league_matches_home_league_team_id_idx" ON "league_matches"("home_league_team_id");

-- CreateIndex
CREATE INDEX "league_matches_away_league_team_id_idx" ON "league_matches"("away_league_team_id");

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_seasons" ADD CONSTRAINT "league_seasons_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_teams" ADD CONSTRAINT "league_teams_league_season_id_fkey" FOREIGN KEY ("league_season_id") REFERENCES "league_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_teams" ADD CONSTRAINT "league_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_matches" ADD CONSTRAINT "league_matches_league_season_id_fkey" FOREIGN KEY ("league_season_id") REFERENCES "league_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_matches" ADD CONSTRAINT "league_matches_home_league_team_id_fkey" FOREIGN KEY ("home_league_team_id") REFERENCES "league_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_matches" ADD CONSTRAINT "league_matches_away_league_team_id_fkey" FOREIGN KEY ("away_league_team_id") REFERENCES "league_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_matches" ADD CONSTRAINT "league_matches_home_match_id_fkey" FOREIGN KEY ("home_match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_matches" ADD CONSTRAINT "league_matches_away_match_id_fkey" FOREIGN KEY ("away_match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
