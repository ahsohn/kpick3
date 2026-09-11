ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'player' NOT NULL;--> statement-breakpoint
UPDATE "users" SET "role" = 'super_admin' WHERE "is_admin" = true;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_admin";
