import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';

const QUEUE_NAME = 'pin-expiration';

// Connect BullMQ to Redis instance using URL or options
const connection = config.redis.url
  ? new Redis(config.redis.url, { maxRetriesPerRequest: null })
  : {
      host: config.redis.host,
      port: config.redis.port,
    };

export const pinExpirationQueue = new Queue(QUEUE_NAME, {
  connection,
});

/**
 * Adds a delayed job to the queue to expire a PIN after a certain duration.
 */
export const schedulePinExpiration = async (pinId: string, delayMs: number) => {
  console.log(`⏰ Scheduling expiration job for PIN ID [${pinId}] with delay of ${delayMs / 1000} seconds.`);
  
  await pinExpirationQueue.add(
    'expire-pin',
    { pinId },
    {
      delay: delayMs,
      jobId: pinId, // Using pinId as jobId prevents duplicate scheduled jobs for the same PIN
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
};
