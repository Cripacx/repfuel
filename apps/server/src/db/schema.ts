/**
 * Aggregiert die Drizzle-Schemas aller Module für drizzle-kit und den DB-Client.
 * Die Tabellen selbst gehören den Modulen (jedes Modul besitzt seine Tabellen).
 */
export * from '../modules/auth/schema.js';
export * from '../modules/workout/schema.js';
export * from '../modules/health/schema.js';
export * from '../modules/nutrition/schema.js';
export * from '../modules/ai/schema.js';
