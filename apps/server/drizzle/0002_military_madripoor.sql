CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"height_cm" integer,
	"birth_year" integer,
	"sex" text,
	"activity_level" text,
	"goal" text,
	"kcal_target" integer,
	"protein_target_g" integer,
	"carbs_target_g" integer,
	"fat_target_g" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'custom' NOT NULL,
	"off_barcode" text,
	"name" text NOT NULL,
	"brand" text,
	"kcal_per_100" numeric(7, 1) NOT NULL,
	"protein_per_100" numeric(6, 2) NOT NULL,
	"carbs_per_100" numeric(6, 2) NOT NULL,
	"fat_per_100" numeric(6, 2) NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "foods_off_barcode_unique" UNIQUE("off_barcode")
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"eaten_at" timestamp with time zone NOT NULL,
	"meal_type" text NOT NULL,
	"food_id" uuid,
	"amount_g" numeric(7, 1),
	"quick_kcal" numeric(7, 1),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foods_user_id_idx" ON "foods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meals_user_id_idx" ON "meals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meals_eaten_at_idx" ON "meals" USING btree ("eaten_at");