-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'FEATURE_REQUEST', 'GENERAL');

-- CreateEnum
CREATE TYPE "FeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "severity" "FeedbackSeverity",
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "admin_notes" TEXT,
    "page_context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_attachments" (
    "id" TEXT NOT NULL,
    "feedback_id" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_user_id_idx" ON "feedback"("user_id");

-- CreateIndex
CREATE INDEX "feedback_status_idx" ON "feedback"("status");

-- CreateIndex
CREATE INDEX "feedback_attachments_feedback_id_idx" ON "feedback_attachments"("feedback_id");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_attachments" ADD CONSTRAINT "feedback_attachments_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
