-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('elder', 'guardian');

-- CreateEnum
CREATE TYPE "FamilyLinkStatus" AS ENUM ('pending', 'active');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone_number_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_links" (
    "id" TEXT NOT NULL,
    "elder_user_id" TEXT NOT NULL,
    "guardian_user_id" TEXT NOT NULL,
    "status" "FamilyLinkStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_phone_number_hash_idx" ON "users"("phone_number_hash");

-- CreateIndex
CREATE INDEX "family_links_elder_user_id_idx" ON "family_links"("elder_user_id");

-- CreateIndex
CREATE INDEX "family_links_guardian_user_id_idx" ON "family_links"("guardian_user_id");

-- CreateIndex
CREATE INDEX "family_links_status_idx" ON "family_links"("status");

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_elder_user_id_fkey" FOREIGN KEY ("elder_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_guardian_user_id_fkey" FOREIGN KEY ("guardian_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;