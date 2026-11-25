-- Integrity rules enforced by Postgres itself, as a second line of defense
-- behind the API validation. Prisma's schema language can't express CHECKs,
-- so they live in this hand-written migration.

ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "services"
  ADD CONSTRAINT "services_duration_range" CHECK ("duration_min" BETWEEN 5 AND 480),
  ADD CONSTRAINT "services_buffer_range" CHECK ("buffer_min" BETWEEN 0 AND 240),
  ADD CONSTRAINT "services_price_non_negative" CHECK ("price_cents" >= 0);

ALTER TABLE "working_hours"
  ADD CONSTRAINT "working_hours_weekday_range" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "working_hours_minutes_range" CHECK ("start_minute" >= 0 AND "end_minute" <= 1440),
  ADD CONSTRAINT "working_hours_end_after_start" CHECK ("end_minute" > "start_minute");

ALTER TABLE "time_off"
  ADD CONSTRAINT "time_off_end_after_start" CHECK ("ends_at" > "starts_at");
