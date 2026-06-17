-- CreateEnum
CREATE TYPE "Position" AS ENUM ('SETTER', 'OUTSIDE_HITTER', 'OPPOSITE', 'MIDDLE_BLOCKER', 'LIBERO', 'DEFENSIVE_SPECIALIST');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('KILL', 'ATTACK_ERROR', 'ATTACK_ATTEMPT', 'ACE', 'SERVICE_ERROR', 'SERVE_IN', 'PASS_3', 'PASS_2', 'PASS_1', 'PASS_0', 'SOLO_BLOCK', 'BLOCK_ASSIST', 'BLOCK_ERROR', 'DIG', 'DIG_ERROR', 'ASSIST', 'SETTING_ERROR');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "division" TEXT,
    "season" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "jersey_number" INTEGER NOT NULL,
    "position" "Position" NOT NULL,
    "team_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "match_date" TIMESTAMP(3) NOT NULL,
    "opponent" TEXT NOT NULL,
    "competition" TEXT,
    "venue" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "set_scores" JSONB,
    "team_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "set_number" INTEGER NOT NULL,
    "rally_number" INTEGER,
    "court_zone" INTEGER,
    "notes" TEXT,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_team_id_jersey_number_key" ON "players"("team_id", "jersey_number");

-- CreateIndex
CREATE INDEX "events_match_id_idx" ON "events"("match_id");

-- CreateIndex
CREATE INDEX "events_player_id_idx" ON "events"("player_id");

-- CreateIndex
CREATE INDEX "events_match_id_set_number_idx" ON "events"("match_id", "set_number");

-- CreateIndex
CREATE INDEX "events_player_id_event_type_idx" ON "events"("player_id", "event_type");

-- CreateIndex
CREATE INDEX "events_match_id_court_zone_idx" ON "events"("match_id", "court_zone");

-- CreateIndex
CREATE INDEX "events_recorded_at_idx" ON "events"("recorded_at");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
