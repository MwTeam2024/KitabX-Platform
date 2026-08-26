-- Admin login switches from email+password to phone+OTP (§21).
-- Add phone as nullable first so the existing bootstrap admin row can be
-- backfilled before the NOT NULL + unique constraints are enforced.
ALTER TABLE "admin_users" ADD COLUMN "phone" TEXT;

UPDATE "admin_users" SET "phone" = '+919999900099' WHERE "phone" IS NULL;

ALTER TABLE "admin_users" ALTER COLUMN "phone" SET NOT NULL;
CREATE UNIQUE INDEX "admin_users_phone_key" ON "admin_users"("phone");

-- email is no longer used for login, just an optional contact field
ALTER TABLE "admin_users" ALTER COLUMN "email" DROP NOT NULL;

-- password-based auth is gone entirely
ALTER TABLE "admin_users" DROP COLUMN "password_hash";
