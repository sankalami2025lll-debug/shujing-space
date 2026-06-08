-- CreateEnum
CREATE TYPE "UploadTaskStatus" AS ENUM ('queued', 'running', 'processing', 'published', 'failed', 'canceled', 'interrupted');

-- CreateEnum
CREATE TYPE "UploadTaskStage" AS ENUM ('queued', 'presigning_model', 'uploading_model', 'callbacking_model', 'presigning_cover', 'uploading_cover', 'callbacking_cover', 'creating_model', 'processing', 'published', 'failed', 'canceled', 'interrupted');

-- CreateTable
CREATE TABLE "upload_tasks" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "client_token" VARCHAR(64),
    "title" VARCHAR(120) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "scenes_json" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" "ModelVisibility" NOT NULL,
    "viewer_url" VARCHAR(255),
    "planned_model_name" VARCHAR(255),
    "planned_model_size" BIGINT,
    "planned_model_mime" VARCHAR(80),
    "planned_cover_name" VARCHAR(255),
    "planned_cover_size" BIGINT,
    "planned_cover_mime" VARCHAR(80),
    "status" "UploadTaskStatus" NOT NULL DEFAULT 'queued',
    "stage" "UploadTaskStage" NOT NULL DEFAULT 'queued',
    "current_model_object_key" VARCHAR(255),
    "current_cover_object_key" VARCHAR(255),
    "model_file_id" BIGINT,
    "cover_file_id" BIGINT,
    "model_id" BIGINT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_stage" "UploadTaskStage",
    "last_error_code" VARCHAR(64),
    "last_error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "last_heartbeat_at" TIMESTAMPTZ(6),
    "interrupted_at" TIMESTAMPTZ(6),
    "canceled_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "upload_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_tasks_model_id_key" ON "upload_tasks"("model_id");

-- CreateIndex
CREATE INDEX "upload_tasks_user_id_created_at_idx" ON "upload_tasks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "upload_tasks_user_id_status_updated_at_idx" ON "upload_tasks"("user_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "upload_tasks_status_updated_at_idx" ON "upload_tasks"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "upload_tasks_user_id_client_token_key" ON "upload_tasks"("user_id", "client_token");

-- AddForeignKey
ALTER TABLE "upload_tasks" ADD CONSTRAINT "upload_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_tasks" ADD CONSTRAINT "upload_tasks_model_file_id_fkey" FOREIGN KEY ("model_file_id") REFERENCES "model_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_tasks" ADD CONSTRAINT "upload_tasks_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "model_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_tasks" ADD CONSTRAINT "upload_tasks_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
