CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"user_id" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_uq" ON "notifications" USING btree ("dedupe_key");