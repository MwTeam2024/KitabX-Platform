-- Email OTP as an alternate login method (§13) — optional, unique, nullable
-- (no backfill needed since it's nullable and Postgres allows multiple NULLs
-- under a unique constraint).
ALTER TABLE "users" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
