import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';

// e2e tests run against the separate `bookwise_test` database (see .env.test).
// Variables already set in the environment (e.g. in CI) take precedence.
const testEnv = {
  ...parse(readFileSync('.env.test')),
  ...pickDefined(process.env),
};

function pickDefined(env: NodeJS.ProcessEnv) {
  const keys = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'REDIS_URL'] as const;
  return Object.fromEntries(
    keys.filter((k) => env[k]).map((k) => [k, env[k] as string]),
  );
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: testEnv,
    globalSetup: ['./test/global-setup.ts'],
    // Test files share one database, so they run one at a time.
    fileParallelism: false,
  },
});
