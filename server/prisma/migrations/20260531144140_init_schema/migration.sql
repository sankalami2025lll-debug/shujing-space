-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "ViewerType" AS ENUM ('iframe', 'sketchfab', 'native', 'none');

-- CreateEnum
CREATE TYPE "ModelVisibility" AS ENUM ('public', 'private', 'review');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('draft', 'pending', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('model', 'cover', 'video');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('submitted', 'contacted', 'evaluating', 'quoted', 'closed');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost');

-- CreateEnum
CREATE TYPE "VerificationScene" AS ENUM ('register', 'login', 'reset');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(120),
    "password_hash" VARCHAR(255),
    "nickname" VARCHAR(60) NOT NULL,
    "company" VARCHAR(120),
    "role_type" VARCHAR(40),
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "avatar_url" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "category_id" BIGINT,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "scenes" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "cover_url" VARCHAR(255) NOT NULL DEFAULT '',
    "model_url" VARCHAR(255),
    "viewer_type" "ViewerType" NOT NULL DEFAULT 'none',
    "allow_iframe" BOOLEAN NOT NULL DEFAULT true,
    "file_format" VARCHAR(20),
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "favorites_count" INTEGER NOT NULL DEFAULT 0,
    "visibility" "ModelVisibility" NOT NULL DEFAULT 'public',
    "status" "ModelStatus" NOT NULL DEFAULT 'draft',
    "reject_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_files" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "r2_key" VARCHAR(255) NOT NULL,
    "url" VARCHAR(255) NOT NULL,
    "size" BIGINT NOT NULL,
    "mime" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "model_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "model_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_applications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "contact_name" VARCHAR(60) NOT NULL,
    "contact_way" VARCHAR(120) NOT NULL,
    "company" VARCHAR(120) NOT NULL,
    "robot_type" VARCHAR(40) NOT NULL,
    "train_tasks" JSONB NOT NULL DEFAULT '[]',
    "scene_desc" TEXT NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'submitted',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_leads" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "contact_way" VARCHAR(120) NOT NULL,
    "company" VARCHAR(120),
    "email" VARCHAR(120),
    "scene" VARCHAR(40),
    "data_types" JSONB NOT NULL DEFAULT '[]',
    "stage" VARCHAR(40),
    "budget" VARCHAR(40),
    "message" TEXT NOT NULL DEFAULT '',
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" BIGSERIAL NOT NULL,
    "target" VARCHAR(120) NOT NULL,
    "scene" "VerificationScene" NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_configs" (
    "key" VARCHAR(60) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_configs_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "models_type_status_idx" ON "models"("type", "status");

-- CreateIndex
CREATE INDEX "models_status_created_at_idx" ON "models"("status", "created_at");

-- CreateIndex
CREATE INDEX "models_user_id_idx" ON "models"("user_id");

-- CreateIndex
CREATE INDEX "model_files_user_id_idx" ON "model_files"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_model_id_key" ON "favorites"("user_id", "model_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_user_id_model_id_key" ON "likes"("user_id", "model_id");

-- CreateIndex
CREATE INDEX "training_applications_status_created_at_idx" ON "training_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "contact_leads_status_created_at_idx" ON "contact_leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "verification_codes_target_scene_idx" ON "verification_codes"("target", "scene");

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_files" ADD CONSTRAINT "model_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_applications" ADD CONSTRAINT "training_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
