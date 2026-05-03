import { Redis } from 'ioredis';

let redis: Redis;

try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 0,
    retryStrategy: (times) => {
      if (times > 1) {
        (redis as any).isMock = true;
        return null;
      }
      return 10;
    }
  });
  redis.on('error', (err) => {
    (redis as any).isMock = true;
    console.warn('Redis connection failed. Running in mock mode.');
  });
} catch (err) {
  redis = {
    get: async () => null,
    set: async () => 'OK',
    setex: async () => 'OK',
    on: () => {},
    defineCommand: () => {},
    isMock: true,
  } as any;
}

export default redis;
