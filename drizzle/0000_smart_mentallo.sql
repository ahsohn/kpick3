CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"espn_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"kickoff" timestamp with time zone NOT NULL,
	"status_state" text NOT NULL,
	"status_detail" text,
	"completed" boolean DEFAULT false NOT NULL,
	"canceled" boolean DEFAULT false NOT NULL,
	"home_team_name" text NOT NULL,
	"home_team_abbr" text NOT NULL,
	"home_team_logo" text NOT NULL,
	"away_team_name" text NOT NULL,
	"away_team_abbr" text NOT NULL,
	"away_team_logo" text NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"period" integer,
	"display_clock" text,
	"home_spread" real,
	"spread_details" text,
	"odds_available" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"graded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_espn_id_unique" UNIQUE("espn_id")
);
--> statement-breakpoint
CREATE TABLE "picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"side" text NOT NULL,
	"locked_spread" real NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"pin_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_season_week_idx" ON "games" USING btree ("season","week");--> statement-breakpoint
CREATE UNIQUE INDEX "picks_user_game_uq" ON "picks" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "picks_user_week_idx" ON "picks" USING btree ("user_id","season","week");--> statement-breakpoint
CREATE INDEX "picks_game_idx" ON "picks" USING btree ("game_id");