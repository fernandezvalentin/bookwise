import { z } from 'zod';

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens')
  .meta({ example: 'barberia-centro' });

/** "Barbería Centro!" -> "barberia-centro" */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}
