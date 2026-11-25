import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Almost every page depends on the signed-in user (cookies), so pages are
  // rendered per request. Cache Components (on by default in new apps) would
  // need a Suspense boundary around every cookie read, for little benefit here.
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
