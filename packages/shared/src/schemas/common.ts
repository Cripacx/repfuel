import { z } from 'zod';
import { LOCALES } from '../types.js';

export const uuidSchema = z.string().uuid();

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, 'invalid username');

export const localeSchema = z.enum(LOCALES);
