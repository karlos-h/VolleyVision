-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_user_id" TEXT NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_timestamps" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "timestamp_seconds" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "event_id" TEXT,

    CONSTRAINT "video_timestamps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "videos_match_id_idx" ON "videos"("match_id");

-- CreateIndex
CREATE INDEX "video_timestamps_video_id_idx" ON "video_timestamps"("video_id");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_timestamps" ADD CONSTRAINT "video_timestamps_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_timestamps" ADD CONSTRAINT "video_timestamps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
