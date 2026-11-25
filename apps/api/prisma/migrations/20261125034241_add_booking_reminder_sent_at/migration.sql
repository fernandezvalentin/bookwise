-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "reminder_sent_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "bookings_status_reminder_sent_at_starts_at_idx" ON "bookings"("status", "reminder_sent_at", "starts_at");
