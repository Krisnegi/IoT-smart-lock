import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { prisma } from '../config/db';

const connection = config.redis.url
  ? new Redis(config.redis.url, { maxRetriesPerRequest: null })
  : {
      host: config.redis.host,
      port: config.redis.port,
    };

const QUEUE_NAME = 'pin-expiration';

// Worker to process completed delay periods
export const pinExpirationWorker = new Worker(
  QUEUE_NAME,
  async (job: Job<{ pinId: string }>) => {
    const { pinId } = job.data;
    console.log(`👷 Worker processing job '${job.id}' to invalidate PIN [${pinId}].`);

    try {
      const pin = await prisma.temporaryPin.findUnique({
        where: { id: pinId },
      });

      if (!pin) {
        console.warn(`⚠️ Temporary PIN ID [${pinId}] not found in database.`);
        return;
      }

      if (!pin.isActive) {
        console.log(`ℹ️ Temporary PIN ID [${pinId}] is already inactive.`);
        return;
      }

      // Deactivate the PIN code in the database
      await prisma.temporaryPin.update({
        where: { id: pinId },
        data: { isActive: false },
      });

      console.log(`❌ Temporary PIN [${pin.pin}] for lock [${pin.lockId}] has expired.`);
    } catch (error) {
      console.error(`❌ Error executing worker job [${pinId}]:`, error);
      throw error;
    }
  },
  {
    connection,
  }
);

pinExpirationWorker.on('completed', (job) => {
  console.log(`✅ PIN expiration job ${job.id} completed.`);
});

pinExpirationWorker.on('failed', (job, err) => {
  console.error(`❌ PIN expiration job ${job?.id} failed:`, err);
});
export default pinExpirationWorker;
