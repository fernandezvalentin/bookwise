/**
 * Turns a Redis URL (redis://user:pass@host:6379/1, or rediss:// for TLS, as
 * hosted providers like Upstash use) into the connection options BullMQ expects.
 */
export function redisConnectionFromUrl(url: string) {
  const parsed = new URL(url);
  const db = parsed.pathname.replace('/', '');
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: db ? Number(db) : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    // Required by BullMQ workers: commands wait for Redis instead of failing.
    maxRetriesPerRequest: null,
  };
}
