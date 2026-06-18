-- AlterTable
ALTER TABLE "events" ADD COLUMN     "rotation_number" INTEGER;

-- CreateIndex
CREATE INDEX "events_match_id_rotation_number_idx" ON "events"("match_id", "rotation_number");
