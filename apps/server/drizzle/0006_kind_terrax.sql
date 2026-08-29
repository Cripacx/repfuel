ALTER TABLE "exercises" ADD COLUMN "dataset_id" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "gif_url" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_dataset_id_unique" UNIQUE("dataset_id");--> statement-breakpoint
-- Übungsbibliothek wird auf den gymvisual-Datensatz umgestellt: globale
-- wger-Seed-Übungen entfernen, aber NUR solche, auf die keine Nutzerdaten
-- zeigen. Referenzierte Zeilen bleiben als Altbestand erhalten — routine_items
-- hängt per ON DELETE CASCADE an exercises, ein pauschales DELETE würde also
-- stillschweigend Routinen-Einträge mitlöschen.
DELETE FROM "exercises"
WHERE "source" = 'wger'
  AND "user_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "routine_items" WHERE "routine_items"."exercise_id" = "exercises"."id")
  AND NOT EXISTS (SELECT 1 FROM "sets" WHERE "sets"."exercise_id" = "exercises"."id");
