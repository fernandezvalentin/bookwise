import { z } from 'zod';

/**
 * Environment variables the API needs. They are validated once at startup,
 * so a missing or malformed value fails fast with a clear message instead of
 * breaking later at runtime.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Max requests per minute, per IP, to the auth endpoints (brute-force protection). */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),

  // Queues and email
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  /** SMTP server, e.g. smtp://localhost:1025 (Mailpit) or smtps://user:pass@host:465. */
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  MAIL_FROM: z.string().min(3).default('Bookwise <no-reply@bookwise.local>'),
  /** How long before an appointment the reminder email is sent. */
  REMINDER_HOURS_BEFORE: z.coerce.number().int().min(1).max(168).default(24),

  // Deployment
  /**
   * Express "trust proxy": which hops may set X-Forwarded-For, so rate limits
   * see the visitor's IP instead of the web server's. Behind Docker networks,
   * "loopback, uniquelocal" trusts the private addresses of the web app and
   * the reverse proxy. Unset: the connection's address is used as is.
   */
  TRUST_PROXY: z.string().min(1).optional(),

  // Public demo. With both set, the demo business is created on startup and
  // reset every night, and this account is its owner.
  DEMO_OWNER_EMAIL: z.email().optional(),
  DEMO_OWNER_PASSWORD: z
    .string()
    .min(12, 'must be at least 12 characters')
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema
    .refine(
      (env) => !env.DEMO_OWNER_EMAIL === !env.DEMO_OWNER_PASSWORD,
      'Set both DEMO_OWNER_EMAIL and DEMO_OWNER_PASSWORD, or neither',
    )
    .safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
