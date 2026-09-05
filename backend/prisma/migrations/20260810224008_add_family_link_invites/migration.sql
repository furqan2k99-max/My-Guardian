-- CreateTable
CREATE TABLE "family_link_invites" (
    "code" TEXT NOT NULL,
    "guardian_user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_link_invites_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "family_link_invites_guardian_user_id_idx" ON "family_link_invites"("guardian_user_id");

-- CreateIndex
CREATE INDEX "family_link_invites_expires_at_idx" ON "family_link_invites"("expires_at");

-- AddForeignKey
ALTER TABLE "family_link_invites" ADD CONSTRAINT "family_link_invites_guardian_user_id_fkey" FOREIGN KEY ("guardian_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
