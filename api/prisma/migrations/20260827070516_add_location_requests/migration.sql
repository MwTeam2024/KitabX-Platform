-- CreateEnum
CREATE TYPE "LocationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "location_requests" (
    "id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "city_name" TEXT NOT NULL,
    "society_name" TEXT NOT NULL,
    "status" "LocationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_society_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_requests_status_idx" ON "location_requests"("status");

-- AddForeignKey
ALTER TABLE "location_requests" ADD CONSTRAINT "location_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_requests" ADD CONSTRAINT "location_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_requests" ADD CONSTRAINT "location_requests_created_society_id_fkey" FOREIGN KEY ("created_society_id") REFERENCES "societies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
