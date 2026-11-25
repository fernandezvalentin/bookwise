import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

/** Applies all migrations to the test database before the e2e suite runs. */
export default function setup(project: TestProject) {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, ...project.config.env },
  });
}
