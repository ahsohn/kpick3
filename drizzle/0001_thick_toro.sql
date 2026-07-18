CREATE TABLE "survivor_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"season" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survivor_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"side" text NOT NULL,
	"team_abbr" text NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "survivor_entries" ADD CONSTRAINT "survivor_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survivor_picks" ADD CONSTRAINT "survivor_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survivor_picks" ADD CONSTRAINT "survivor_picks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "survivor_entries_user_season_uq" ON "survivor_entries" USING btree ("user_id","season");--> statement-breakpoint
CREATE UNIQUE INDEX "survivor_picks_user_week_uq" ON "survivor_picks" USING btree ("user_id","season","week") WHERE "survivor_picks"."result" <> 'void';--> statement-breakpoint
CREATE UNIQUE INDEX "survivor_picks_user_team_uq" ON "survivor_picks" USING btree ("user_id","season","team_abbr") WHERE "survivor_picks"."result" <> 'void';--> statement-breakpoint
CREATE INDEX "survivor_picks_game_idx" ON "survivor_picks" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "survivor_picks_season_week_idx" ON "survivor_picks" USING btree ("season","week");