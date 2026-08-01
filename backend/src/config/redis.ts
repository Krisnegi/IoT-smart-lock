import Redis from 'ioredis';
import { config } from './index';

// Create a single shared Redis client instance
export const redis = config.redis.url
  ? new Redis(config.redis.url)
  : new Redis({
      host: config.redis.host,
      port: config.redis.port,
    });

redis.on('connect', () => {
  console.log(`🔌 Connected to Redis on ${config.redis.host}:${config.redis.port}`);
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});
