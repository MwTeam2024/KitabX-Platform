-- AlterTable
ALTER TABLE "book_requests" ADD COLUMN     "cancellation_reason" TEXT;

-- AlterTable
ALTER TABLE "society_pickup_points" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "location" geography(Point, 4326),
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- Spatial index for radius queries (ST_DWithin) against societies.location.
CREATE INDEX "societies_location_gist_idx" ON "societies" USING GIST ("location");

-- Spatial index for pickup points once they carry their own coordinates.
CREATE INDEX "society_pickup_points_location_gist_idx" ON "society_pickup_points" USING GIST ("location");

-- One active request per (listing, requester) enforced at the DB level, not
-- just in application code — a partial unique index since a member is
-- allowed to request the same listing again after a prior request there
-- was declined/cancelled/expired.
CREATE UNIQUE INDEX "book_requests_active_unique"
  ON "book_requests" ("listing_id", "requester_id")
  WHERE "status" IN ('REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED');
