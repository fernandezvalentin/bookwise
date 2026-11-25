import { z } from 'zod';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

/** Response shape of a user, as sent over HTTP (dates become ISO strings). Used for the docs. */
export const publicUserResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});
