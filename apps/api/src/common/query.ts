import { z } from 'zod';

/**
 * Optional boolean query parameter (`?includeArchived=true`). Query strings
 * are text, so only "true" and "false" are accepted; a missing value is false.
 * Declared `.optional()` (not `.default()`) so the docs show it as optional.
 */
export const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');
