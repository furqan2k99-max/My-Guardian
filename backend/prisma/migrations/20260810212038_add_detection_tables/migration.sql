-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('call', 'sms', 'email');

-- CreateEnum
CREATE TYPE "ElderAction" AS ENUM ('dismissed', 'blocked', 'no_action');

-- CreateEnum
CREATE TYPE "ReputationIdentifierType" AS ENUM ('number', 'url');

-- CreateTable
CREATE TABLE "flagged_events" (
    "id" TEXT NOT NULL,
    "elder_user_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "sender_hash" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION,
    "risk_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guardian_notified_at" TIMESTAMP(3),
    "elder_action" "ElderAction" NOT NULL DEFAULT 'no_action',

    CONSTRAINT "flagged_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_cache" (
    "id" TEXT NOT NULL,
    "identifier_hash" TEXT NOT NULL,
    "identifier_type" "ReputationIdentifierType" NOT NULL,
    "score" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "cached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttl" INTEGER NOT NULL,

    CONSTRAINT "reputation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flagged_events_elder_user_id_idx" ON "flagged_events"("elder_user_id");

-- CreateIndex
CREATE INDEX "flagged_events_guardian_notified_at_idx" ON "flagged_events"("guardian_notified_at");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_cache_identifier_hash_key" ON "reputation_cache"("identifier_hash");

-- CreateIndex
CREATE INDEX "reputation_cache_identifier_type_idx" ON "reputation_cache"("identifier_type");

-- AddForeignKey
ALTER TABLE "flagged_events" ADD CONSTRAINT "flagged_events_elder_user_id_fkey" FOREIGN KEY ("elder_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
