import { Queue } from 'bullmq';
import { config } from '../config';

const QUEUE_NAME = 'pin-expiration';

// Connect BullMQ to our local Redis instance
export const pinExpirationQueue = new Queue(QUEUE_NAME, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
  },
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
