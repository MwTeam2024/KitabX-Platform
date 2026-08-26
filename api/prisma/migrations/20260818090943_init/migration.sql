-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'RESERVED', 'COMPLETED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ListingPhotoType" AS ENUM ('COVER', 'ACTUAL_CONDITION', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('BOOK_LISTED', 'BOOK_GIVEN', 'REQUEST_RESERVED', 'REQUEST_CANCELLED', 'REQUEST_EXPIRED', 'EXCHANGE_COMPLETED', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVERSED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COMPLETED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'SYSTEM', 'QUICK_REPLY');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('FAKE_DUPLICATE_LISTING', 'INCORRECT_CONDITION', 'INAPPROPRIATE_CONTENT', 'HARASSMENT', 'NO_RESPONSE_NO_SHOW', 'CREDIT_PROBLEM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportRequestType" AS ENUM ('SUPPORT', 'TECHNICAL_BUG', 'ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profile_image_url" TEXT,
    "bio" TEXT,
    "member_id" TEXT NOT NULL,
    "city_id" TEXT,
    "area_id" TEXT,
    "society_id" TEXT,
    "block_id" TEXT,
    "flat_unit" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "accepted_terms_at" TIMESTAMP(3),
    "deletion_requested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fcm_token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "browser" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "verification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "request_enabled" BOOLEAN NOT NULL DEFAULT true,
    "message_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pickup_enabled" BOOLEAN NOT NULL DEFAULT true,
    "wishlist_enabled" BOOLEAN NOT NULL DEFAULT true,
    "report_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "societies" (
    "id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "location" geography(Point, 4326),

    CONSTRAINT "societies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "society_blocks" (
    "id" TEXT NOT NULL,
    "society_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "society_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "society_pickup_points" (
    "id" TEXT NOT NULL,
    "society_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "society_pickup_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "isbn13" TEXT,
    "isbn10" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "author" TEXT NOT NULL,
    "genre" TEXT,
    "language_code" TEXT,
    "publisher" TEXT,
    "publication_year" INTEGER,
    "edition" TEXT,
    "cover_image_url" TEXT,
    "page_count" INTEGER,
    "google_books_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_listing" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "society_id" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "condition_description" TEXT,
    "pickup_instructions" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "book_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_listing_photos" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "image_type" "ListingPhotoType" NOT NULL DEFAULT 'OTHER',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_listing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "available_balance" INTEGER NOT NULL DEFAULT 0,
    "pending_balance" INTEGER NOT NULL DEFAULT 0,
    "reserved_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "CreditTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "reference_type" TEXT,
    "reference_id" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_requests" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_schedules" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "proposed_by" TEXT NOT NULL,
    "pickup_date" TEXT NOT NULL,
    "time_slot" TEXT NOT NULL,
    "pickup_point_id" TEXT,
    "custom_location" TEXT,
    "instructions" TEXT,
    "status" "PickupStatus" NOT NULL DEFAULT 'PROPOSED',
    "confirmed_by_requester_at" TIMESTAMP(3),
    "confirmed_by_owner_at" TIMESTAMP(3),
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchanges" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'ACTIVE',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_otps" (
    "id" TEXT NOT NULL,
    "exchange_id" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT,
    "message_type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reads" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "device_id" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "exchange_id" TEXT NOT NULL,
    "rater_id" TEXT NOT NULL,
    "rated_user_id" TEXT NOT NULL,
    "condition_accuracy" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "reliability" INTEGER NOT NULL,
    "review" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reported_user_id" TEXT,
    "listing_id" TEXT,
    "exchange_id" TEXT,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_notes" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "SupportRequestType" NOT NULL DEFAULT 'SUPPORT',
    "subject" TEXT,
    "description" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_admin_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_member_id_key" ON "users"("member_id");

-- CreateIndex
CREATE INDEX "users_society_id_idx" ON "users"("society_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_user_id_fcm_token_key" ON "user_devices"("user_id", "fcm_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_user_id_key" ON "user_notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_verifications_user_id_idx" ON "user_verifications"("user_id");

-- CreateIndex
CREATE INDEX "areas_city_id_idx" ON "areas"("city_id");

-- CreateIndex
CREATE INDEX "societies_area_id_idx" ON "societies"("area_id");

-- CreateIndex
CREATE INDEX "society_blocks_society_id_idx" ON "society_blocks"("society_id");

-- CreateIndex
CREATE INDEX "society_pickup_points_society_id_idx" ON "society_pickup_points"("society_id");

-- CreateIndex
CREATE UNIQUE INDEX "books_isbn13_key" ON "books"("isbn13");

-- CreateIndex
CREATE UNIQUE INDEX "books_isbn10_key" ON "books"("isbn10");

-- CreateIndex
CREATE INDEX "books_title_idx" ON "books"("title");

-- CreateIndex
CREATE INDEX "book_listing_owner_id_idx" ON "book_listing"("owner_id");

-- CreateIndex
CREATE INDEX "book_listing_book_id_idx" ON "book_listing"("book_id");

-- CreateIndex
CREATE INDEX "book_listing_status_idx" ON "book_listing"("status");

-- CreateIndex
CREATE INDEX "book_listing_society_id_idx" ON "book_listing"("society_id");

-- CreateIndex
CREATE INDEX "book_listing_photos_listing_id_idx" ON "book_listing_photos"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_user_id_book_id_key" ON "wishlists"("user_id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_accounts_user_id_key" ON "credit_accounts"("user_id");

-- CreateIndex
CREATE INDEX "credit_transactions_user_id_idx" ON "credit_transactions"("user_id");

-- CreateIndex
CREATE INDEX "credit_transactions_created_at_idx" ON "credit_transactions"("created_at");

-- CreateIndex
CREATE INDEX "book_requests_listing_id_idx" ON "book_requests"("listing_id");

-- CreateIndex
CREATE INDEX "book_requests_requester_id_idx" ON "book_requests"("requester_id");

-- CreateIndex
CREATE INDEX "book_requests_status_idx" ON "book_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_schedules_request_id_key" ON "pickup_schedules"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchanges_request_id_key" ON "exchanges"("request_id");

-- CreateIndex
CREATE INDEX "exchanges_owner_id_idx" ON "exchanges"("owner_id");

-- CreateIndex
CREATE INDEX "exchanges_receiver_id_idx" ON "exchanges"("receiver_id");

-- CreateIndex
CREATE UNIQUE INDEX "handover_otps_exchange_id_key" ON "handover_otps"("exchange_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_request_id_key" ON "conversations"("request_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_reads_message_id_user_id_key" ON "message_reads"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_exchange_id_rater_id_key" ON "ratings"("exchange_id", "rater_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_reported_user_id_idx" ON "reports"("reported_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_user_id_key" ON "user_blocks"("blocker_id", "blocked_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "society_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verifications" ADD CONSTRAINT "user_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "societies" ADD CONSTRAINT "societies_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "society_blocks" ADD CONSTRAINT "society_blocks_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "society_pickup_points" ADD CONSTRAINT "society_pickup_points_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_listing" ADD CONSTRAINT "book_listing_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_listing" ADD CONSTRAINT "book_listing_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_listing" ADD CONSTRAINT "book_listing_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_listing_photos" ADD CONSTRAINT "book_listing_photos_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "book_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_requests" ADD CONSTRAINT "book_requests_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "book_listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_requests" ADD CONSTRAINT "book_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_schedules" ADD CONSTRAINT "pickup_schedules_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "book_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_schedules" ADD CONSTRAINT "pickup_schedules_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_schedules" ADD CONSTRAINT "pickup_schedules_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "society_pickup_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "book_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "book_listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_otps" ADD CONSTRAINT "handover_otps_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "book_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rated_user_id_fkey" FOREIGN KEY ("rated_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "book_listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
