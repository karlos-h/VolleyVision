-- AlterTable
ALTER TABLE "events" ADD COLUMN     "is_opponent_event" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opponent_jersey_number" INTEGER,
ALTER COLUMN "player_id" DROP NOT NULL;
