-- CreateIndex
CREATE INDEX "book_listing_society_id_status_idx" ON "book_listing"("society_id", "status");

-- CreateIndex
CREATE INDEX "book_listing_owner_id_status_idx" ON "book_listing"("owner_id", "status");

-- CreateIndex
CREATE INDEX "credit_transactions_user_id_hidden_at_idx" ON "credit_transactions"("user_id", "hidden_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
