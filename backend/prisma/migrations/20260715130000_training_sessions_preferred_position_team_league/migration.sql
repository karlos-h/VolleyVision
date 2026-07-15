-- Iteration 3 — training sessions (foundation), preferred position, team→league pointer.

-- Task 5: athlete's preferred position (independent of roster Player.position).
ALTER TABLE "users" ADD COLUMN "preferred_position" "Position";

-- Task 2: a team's current league season (nullable pointer, cleared if the season is deleted).
ALTER TABLE "teams" ADD COLUMN "league_season_id" TEXT;
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_season_id_fkey"
  FOREIGN KEY ("league_season_id") REFERENCES "league_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Task 11: an Event now belongs to EITHER a match OR a training session.
ALTER TABLE "events" ALTER COLUMN "match_id" DROP NOT NULL;
ALTER TABLE "events" ADD COLUMN "training_session_id" TEXT;
CREATE INDEX "events_training_session_id_idx" ON "events"("training_session_id");

CREATE TABLE "training_sessions" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "session_date" TIMESTAMP(3) NOT NULL,
  "duration_minutes" INTEGER,
  "location" TEXT,
  "notes" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_sessions_team_id_idx" ON "training_sessions"("team_id");

ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_training_session_id_fkey"
  FOREIGN KEY ("training_session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
