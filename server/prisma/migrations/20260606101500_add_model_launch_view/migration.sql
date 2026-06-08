-- AlterTable
ALTER TABLE "models"
ADD COLUMN "launch_view_json" JSONB,
ADD COLUMN "launch_view_updated_at" TIMESTAMPTZ(6),
ADD COLUMN "launch_view_updated_by" BIGINT;
