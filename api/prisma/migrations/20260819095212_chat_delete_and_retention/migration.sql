-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_notification_preferences" ADD COLUMN     "chat_retention_months" INTEGER;
