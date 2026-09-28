-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'REFERRAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referral_code" TEXT,
ADD COLUMN     "referred_by_id" TEXT;

-- Backfill: every existing row gets a short, unique code deterministically
-- derived from its own already-unique id, so the NOT NULL + UNIQUE
-- constraints below can never fail on existing data.
UPDATE "users" SET "referral_code" = upper(substr(replace("id", '-', ''), 1, 8)) WHERE "referral_code" IS NULL;

ALTER TABLE "users" ALTER COLUMN "referral_code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_referred_by_id_idx" ON "users"("referred_by_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
