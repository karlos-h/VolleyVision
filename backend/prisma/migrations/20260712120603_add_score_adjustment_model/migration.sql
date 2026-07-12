-- CreateTable
CREATE TABLE "score_adjustments" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "home_delta" INTEGER NOT NULL,
    "away_delta" INTEGER NOT NULL,
    "set_number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "score_adjustments_match_id_idx" ON "score_adjustments"("match_id");

-- AddForeignKey
ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
