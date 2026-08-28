import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { FoodSource, MealType } from '@repfuel/shared';
import { users } from '../auth/schema.js';

export const foods = pgTable(
  'foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').$type<FoodSource>().notNull().default('custom'),
    /** EAN/UPC bei Open-Food-Facts-Produkten (Cache-Schlüssel). */
    offBarcode: text('off_barcode').unique(),
    name: text('name').notNull(),
    brand: text('brand'),
    kcalPer100: numeric('kcal_per_100', { precision: 7, scale: 1, mode: 'number' }).notNull(),
    proteinPer100: numeric('protein_per_100', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    carbsPer100: numeric('carbs_per_100', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    fatPer100: numeric('fat_per_100', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    /** null = global (OFF-Cache), sonst eigenes Lebensmittel des Nutzers. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('foods_user_id_idx').on(t.userId)],
);

export const meals = pgTable(
  'meals',
  {
    /** Client-generierte UUID (Offline-Sync: Upsert per UUID). */
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eatenAt: timestamp('eaten_at', { withTimezone: true }).notNull(),
    mealType: text('meal_type').$type<MealType>().notNull(),
    foodId: uuid('food_id').references(() => foods.id, { onDelete: 'restrict' }),
    amountG: numeric('amount_g', { precision: 7, scale: 1, mode: 'number' }),
    /** Schnelleintrag ohne Lebensmittel-Referenz. */
    quickKcal: numeric('quick_kcal', { precision: 7, scale: 1, mode: 'number' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('meals_user_id_idx').on(t.userId), index('meals_eaten_at_idx').on(t.eatenAt)],
);

export type FoodRow = typeof foods.$inferSelect;
export type MealRow = typeof meals.$inferSelect;
