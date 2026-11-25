import { redisConnectionFromUrl } from './redis.js';

describe('redisConnectionFromUrl', () => {
  it('parses a local URL with a database number', () => {
    expect(redisConnectionFromUrl('redis://localhost:6379/1')).toMatchObject({
      host: 'localhost',
      port: 6379,
      db: 1,
      tls: undefined,
      maxRetriesPerRequest: null,
    });
  });

  it('parses credentials and enables TLS for rediss://', () => {
    expect(
      redisConnectionFromUrl('rediss://default:p%40ss@eu1.example.io:6380'),
    ).toMatchObject({
      host: 'eu1.example.io',
      port: 6380,
      username: 'default',
      password: 'p@ss',
      db: 0,
      tls: {},
    });
  });
});
