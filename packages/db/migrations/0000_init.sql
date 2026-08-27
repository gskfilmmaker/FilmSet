CREATE TABLE IF NOT EXISTS "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"conflict" text NOT NULL,
	"explanation" text,
	"affected" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_suggestion_log" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"kind" text NOT NULL,
	"input" jsonb NOT NULL,
	"suggestion" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"title" text NOT NULL,
	"requested_by" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "breakdown_elements" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"source" text DEFAULT 'confirmed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"department" text NOT NULL,
	"budgeted" numeric(12, 2) NOT NULL,
	"actual" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_sheet_timeline_events" (
	"id" text PRIMARY KEY NOT NULL,
	"shoot_day_id" text NOT NULL,
	"time" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_sheets" (
	"shoot_day_id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"weather" text DEFAULT '' NOT NULL,
	"sunrise" text DEFAULT '' NOT NULL,
	"sunset" text DEFAULT '' NOT NULL,
	"hospital" text DEFAULT '' NOT NULL,
	"parking" text DEFAULT '' NOT NULL,
	"basecamp" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cast_members" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"character_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"status" text NOT NULL,
	"contract" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crew_members" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"role" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"vendor" text NOT NULL,
	"department" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_scenes" (
	"issue_id" text NOT NULL,
	"scene_id" text NOT NULL,
	CONSTRAINT "issue_scenes_issue_id_scene_id_pk" PRIMARY KEY("issue_id","scene_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issues" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"affected_shoot_day_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"permit_status" text NOT NULL,
	"permit_expiry" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_members" (
	"production_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_members_production_id_user_id_pk" PRIMARY KEY("production_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "productions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phase" text DEFAULT 'Development' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prop_scenes" (
	"prop_id" text NOT NULL,
	"scene_id" text NOT NULL,
	CONSTRAINT "prop_scenes_prop_id_scene_id_pk" PRIMARY KEY("prop_id","scene_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "props" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scene_cast" (
	"scene_id" text NOT NULL,
	"cast_member_id" text NOT NULL,
	CONSTRAINT "scene_cast_scene_id_cast_member_id_pk" PRIMARY KEY("scene_id","cast_member_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"number" text NOT NULL,
	"int_ext" text NOT NULL,
	"set_name" text NOT NULL,
	"day_night" text NOT NULL,
	"synopsis" text DEFAULT '' NOT NULL,
	"page_count" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"shoot_day_id" text,
	"schedule_order" integer DEFAULT 0 NOT NULL,
	"location_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "script_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"elements" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shoot_days" (
	"id" text PRIMARY KEY NOT NULL,
	"production_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"total_days" integer NOT NULL,
	"date" text NOT NULL,
	"location_id" text NOT NULL,
	"status" text NOT NULL,
	"call_time" text NOT NULL,
	"wrap_time" text,
	"unit" text DEFAULT 'Main Unit' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_suggestion_log" ADD CONSTRAINT "ai_suggestion_log_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_suggestion_log" ADD CONSTRAINT "ai_suggestion_log_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "breakdown_elements" ADD CONSTRAINT "breakdown_elements_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "breakdown_elements" ADD CONSTRAINT "breakdown_elements_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_sheet_timeline_events" ADD CONSTRAINT "call_sheet_timeline_events_shoot_day_id_call_sheets_shoot_day_id_fk" FOREIGN KEY ("shoot_day_id") REFERENCES "public"."call_sheets"("shoot_day_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_sheets" ADD CONSTRAINT "call_sheets_shoot_day_id_shoot_days_id_fk" FOREIGN KEY ("shoot_day_id") REFERENCES "public"."shoot_days"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_sheets" ADD CONSTRAINT "call_sheets_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cast_members" ADD CONSTRAINT "cast_members_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cast_members" ADD CONSTRAINT "cast_members_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "characters" ADD CONSTRAINT "characters_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_scenes" ADD CONSTRAINT "issue_scenes_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_scenes" ADD CONSTRAINT "issue_scenes_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues" ADD CONSTRAINT "issues_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues" ADD CONSTRAINT "issues_affected_shoot_day_id_shoot_days_id_fk" FOREIGN KEY ("affected_shoot_day_id") REFERENCES "public"."shoot_days"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_members" ADD CONSTRAINT "production_members_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_members" ADD CONSTRAINT "production_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "productions" ADD CONSTRAINT "productions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prop_scenes" ADD CONSTRAINT "prop_scenes_prop_id_props_id_fk" FOREIGN KEY ("prop_id") REFERENCES "public"."props"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prop_scenes" ADD CONSTRAINT "prop_scenes_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "props" ADD CONSTRAINT "props_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scene_cast" ADD CONSTRAINT "scene_cast_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scene_cast" ADD CONSTRAINT "scene_cast_cast_member_id_cast_members_id_fk" FOREIGN KEY ("cast_member_id") REFERENCES "public"."cast_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenes" ADD CONSTRAINT "scenes_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenes" ADD CONSTRAINT "scenes_shoot_day_id_shoot_days_id_fk" FOREIGN KEY ("shoot_day_id") REFERENCES "public"."shoot_days"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenes" ADD CONSTRAINT "scenes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "script_pages" ADD CONSTRAINT "script_pages_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "script_pages" ADD CONSTRAINT "script_pages_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shoot_days" ADD CONSTRAINT "shoot_days_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shoot_days" ADD CONSTRAINT "shoot_days_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_production_idx" ON "activities" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_recommendations_production_idx" ON "ai_recommendations" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_suggestion_log_production_idx" ON "ai_suggestion_log" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_production_idx" ON "approvals" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "breakdown_elements_scene_idx" ON "breakdown_elements" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_lines_production_idx" ON "budget_lines" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_sheet_timeline_shoot_day_idx" ON "call_sheet_timeline_events" USING btree ("shoot_day_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cast_members_production_idx" ON "cast_members" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "characters_production_idx" ON "characters" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crew_members_production_idx" ON "crew_members" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_production_idx" ON "documents" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_production_idx" ON "expenses" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_production_idx" ON "issues" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "locations_production_idx" ON "locations" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "props_production_idx" ON "props" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenes_production_idx" ON "scenes" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenes_shoot_day_idx" ON "scenes" USING btree ("shoot_day_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "script_pages_scene_idx" ON "script_pages" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shoot_days_production_idx" ON "shoot_days" USING btree ("production_id");