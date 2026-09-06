ALTER TABLE "users" ADD COLUMN "email_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_recaps" boolean DEFAULT true NOT NULL;