import { validateEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  REDIS_URL: 'redis://localhost:6379',
  SMTP_URL: 'smtp://localhost:1025',
};

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv(validEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
  });

  it('coerces PORT from string to number', () => {
    expect(validateEnv({ ...validEnv, PORT: '4000' }).PORT).toBe(4000);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() =>
      validateEnv({ JWT_ACCESS_SECRET: validEnv.JWT_ACCESS_SECRET }),
    ).toThrow(/DATABASE_URL/);
  });

  it('fails when DATABASE_URL is not a Postgres URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('requires both demo owner variables, or neither', () => {
    const demo = {
      DEMO_OWNER_EMAIL: 'demo@bookwise.dev',
      DEMO_OWNER_PASSWORD: 'a-long-demo-password',
    };
    expect(validateEnv({ ...validEnv, ...demo }).DEMO_OWNER_EMAIL).toBe(
      'demo@bookwise.dev',
    );
    expect(() =>
      validateEnv({ ...validEnv, DEMO_OWNER_EMAIL: demo.DEMO_OWNER_EMAIL }),
    ).toThrow(/DEMO_OWNER_PASSWORD/);
  });
});
