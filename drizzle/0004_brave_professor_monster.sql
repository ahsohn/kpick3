UPDATE "users" SET "email_reminders" = NOT "email_opt_out", "email_recaps" = NOT "email_opt_out";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email_opt_out";
