-- CreateEnum
CREATE TYPE "AnnotationStatus" AS ENUM ('active', 'hidden');

-- CreateEnum
CREATE TYPE "AnnotationMediaType" AS ENUM ('image', 'panorama', 'video');

-- CreateTable
CREATE TABLE "model_annotations" (
    "id" BIGSERIAL NOT NULL,
    "model_id" BIGINT NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "anchor_position" JSONB NOT NULL,
    "anchor_normal" JSONB,
    "camera_snapshot" JSONB NOT NULL,
    "display_offset" JSONB,
    "status" "AnnotationStatus" NOT NULL DEFAULT 'active',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "model_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_annotation_media" (
    "id" BIGSERIAL NOT NULL,
    "annotation_id" BIGINT NOT NULL,
    "media_type" "AnnotationMediaType" NOT NULL,
    "url" VARCHAR(255) NOT NULL,
    "object_key" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(80),
    "size" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_annotation_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_annotations_model_id_status_sort_order_idx" ON "model_annotations"("model_id", "status", "sort_order");

-- CreateIndex
CREATE INDEX "model_annotation_media_annotation_id_sort_order_idx" ON "model_annotation_media"("annotation_id", "sort_order");

-- AddForeignKey
ALTER TABLE "model_annotations" ADD CONSTRAINT "model_annotations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_annotation_media" ADD CONSTRAINT "model_annotation_media_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "model_annotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
