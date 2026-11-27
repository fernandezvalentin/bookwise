import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Almost every page depends on the signed-in user (cookies), so pages are
  // rendered per request. Cache Components (on by default in new apps) would
  // need a Suspense boundary around every cookie read, for little benefit here.

  // Production builds output a self-contained server (.next/standalone) with
  // only the files it needs, so the Docker image skips node_modules. This is
  // a monorepo: trace from the repository root, where dependencies are hoisted.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  turbopack: {
    root: path.join(import.meta.dirname, '../..'),
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
