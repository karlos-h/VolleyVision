-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'STATISTICIAN', 'PLAYER', 'VIEWER');

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_memberships_team_id_idx" ON "team_memberships"("team_id");

-- CreateIndex
CREATE INDEX "team_memberships_user_id_idx" ON "team_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_user_id_team_id_key" ON "team_memberships"("user_id", "team_id");

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
