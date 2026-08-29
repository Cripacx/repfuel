import {
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { ActivityLevel, Goal, Locale, Sex, UserRole } from '@repfuel/shared';

const bytea = customType<{ data: Uint8Array<ArrayBuffer> }>({
  dataType() {
    return 'bytea';
  },
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  role: text('role').$type<UserRole>().notNull().default('user'),
  locale: text('locale').$type<Locale>(),
  /** scrypt-Hash; null = Konto nutzt ausschließlich Passkeys. */
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const credentials = pgTable(
  'credentials',
  {
    /** WebAuthn Credential-ID (base64url). */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: bytea('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: jsonb('transports').$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('credentials_user_id_idx').on(t.userId)],
);

export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    /** Optional vom Admin vorgegebener Username. */
    username: text('username'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedBy: uuid('used_by').references(() => users.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('invites_created_by_idx').on(t.createdBy)],
);

/** Nutzerprofil: Körperdaten, Ziel und kcal-/Makro-Targets. */
export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  heightCm: integer('height_cm'),
  birthYear: integer('birth_year'),
  sex: text('sex').$type<Sex>(),
  activityLevel: text('activity_level').$type<ActivityLevel>(),
  goal: text('goal').$type<Goal>(),
  kcalTarget: integer('kcal_target'),
  proteinTargetG: integer('protein_target_g'),
  carbsTargetG: integer('carbs_target_g'),
  fatTargetG: integer('fat_target_g'),
  /** Tagesziel Wasser in ml (null = kein Ziel, Karte bleibt aus). */
  waterTargetMl: integer('water_target_ml'),
  /** Länge des Fastenfensters in Stunden (null = Fasten wird nicht angezeigt). */
  fastingWindowH: integer('fasting_window_h'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Instanzweite Einstellungen (z.B. DB-Override des Registrierungsmodus). */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type CredentialRow = typeof credentials.$inferSelect;
export type InviteRow = typeof invites.$inferSelect;
