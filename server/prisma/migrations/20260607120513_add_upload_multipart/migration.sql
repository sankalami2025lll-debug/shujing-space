-- CreateEnum
CREATE TYPE "UploadMultipartStatus" AS ENUM ('initiated', 'uploading', 'paused', 'failed', 'completed', 'aborted');

-- CreateTable
CREATE TABLE "upload_multipart_sessions" (
    "id" BIGSERIAL NOT NULL,
    "upload_task_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "object_key" VARCHAR(255) NOT NULL,
    "oss_upload_id" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime" VARCHAR(80) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "part_size" BIGINT NOT NULL,
    "total_parts" INTEGER NOT NULL,
    "fingerprint_algo" VARCHAR(40),
    "fingerprint" VARCHAR(255),
    "file_last_modified" BIGINT,
    "status" "UploadMultipartStatus" NOT NULL DEFAULT 'initiated',
    "uploaded_bytes" BIGINT NOT NULL DEFAULT 0,
    "completed_parts_count" INTEGER NOT NULL DEFAULT 0,
    "model_file_id" BIGINT,
    "last_error_code" VARCHAR(64),
    "last_error_message" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "initiated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "aborted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "upload_multipart_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_multipart_parts" (
    "id" BIGSERIAL NOT NULL,
    "session_id" BIGINT NOT NULL,
    "part_number" INTEGER NOT NULL,
    "byte_start" BIGINT NOT NULL,
    "byte_end" BIGINT NOT NULL,
    "part_size" BIGINT NOT NULL,
    "etag" VARCHAR(255),
    "uploaded_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(64),
    "last_error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "upload_multipart_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_multipart_sessions_oss_upload_id_key" ON "upload_multipart_sessions"("oss_upload_id");

-- CreateIndex
CREATE INDEX "upload_multipart_sessions_upload_task_id_kind_created_at_idx" ON "upload_multipart_sessions"("upload_task_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "upload_multipart_sessions_user_id_status_updated_at_idx" ON "upload_multipart_sessions"("user_id", "status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "upload_multipart_sessions_current_task_kind_key" ON "upload_multipart_sessions"("upload_task_id", "kind") WHERE "is_current" = true;

-- CreateIndex
CREATE INDEX "upload_multipart_parts_session_id_part_number_idx" ON "upload_multipart_parts"("session_id", "part_number");

-- CreateIndex
CREATE UNIQUE INDEX "upload_multipart_parts_session_id_part_number_key" ON "upload_multipart_parts"("session_id", "part_number");

-- AddForeignKey
ALTER TABLE "upload_multipart_sessions" ADD CONSTRAINT "upload_multipart_sessions_upload_task_id_fkey" FOREIGN KEY ("upload_task_id") REFERENCES "upload_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_multipart_sessions" ADD CONSTRAINT "upload_multipart_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_multipart_sessions" ADD CONSTRAINT "upload_multipart_sessions_model_file_id_fkey" FOREIGN KEY ("model_file_id") REFERENCES "model_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_multipart_parts" ADD CONSTRAINT "upload_multipart_parts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "upload_multipart_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
