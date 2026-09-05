-- CreateEnum
CREATE TYPE "GuardianAction" AS ENUM ('reviewed', 'dismissed');

-- AlterTable
ALTER TABLE "flagged_events" ADD COLUMN     "guardian_action" "GuardianAction",
ADD COLUMN     "guardian_reviewed_at" TIMESTAMP(3);
