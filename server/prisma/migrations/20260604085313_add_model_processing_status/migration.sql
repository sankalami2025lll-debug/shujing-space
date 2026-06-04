-- CreateEnum
CREATE TYPE "ModelProcessingStatus" AS ENUM ('uploaded', 'processing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "models" ADD COLUMN     "processed_at" TIMESTAMPTZ(6),
ADD COLUMN     "processing_error" TEXT,
ADD COLUMN     "processing_status" "ModelProcessingStatus" NOT NULL DEFAULT 'ready';

-- CreateIndex
CREATE INDEX "models_processing_status_created_at_idx" ON "models"("processing_status", "created_at");
