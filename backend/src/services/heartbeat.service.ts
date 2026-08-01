import { prisma } from '../config/db';
import { broadcastEvent } from '../ws';
import { redis } from '../config/redis';

const CHECK_INTERVAL_MS = 15000; // Check every 15 seconds
const OFFLINE_THRESHOLD_MS = 30000; // Flag offline if no heartbeat for 30 seconds

let intervalId: NodeJS.Timeout | null = null;

/**
 * Starts a background interval to detect locks that have stopped sending heartbeats.
 */
export const startHeartbeatChecker = () => {
  if (intervalId) return;

  console.log(`⏰ Starting background heartbeat checker (every ${CHECK_INTERVAL_MS / 1000}s)...`);

  intervalId = setInterval(async () => {
    try {
      // Find all locks currently marked online in PostgreSQL
      const onlineLocks = await prisma.lock.findMany({
        where: { isOnline: true },
      });

      if (onlineLocks.length === 0) return;

      const now = Date.now();

      for (const lock of onlineLocks) {
        const lastHeartbeatStr = await redis.get(`lock:${lock.id}:heartbeat`);
        let isStale = false;

        if (!lastHeartbeatStr) {
          isStale = true;
        } else {
          const lastHeartbeatTime = parseInt(lastHeartbeatStr, 10);
          if (now - lastHeartbeatTime > OFFLINE_THRESHOLD_MS) {
            isStale = true;
          }
        }

        if (isStale) {
          console.log(`❌ Lock [${lock.id}] has missed heartbeats. Flagging as OFFLINE...`);

          // Update Postgres status
          await prisma.lock.update({
            where: { id: lock.id },
            data: { isOnline: false },
          });

          // Sync status to Redis cache
          await redis.set(`lock:${lock.id}:is_online`, 'false');

          // Broadcast state change to live dashboard
          broadcastEvent('LOCK_OFFLINE', {
            lockId: lock.id,
            message: `Lock '${lock.id}' went offline (lost heartbeat)`,
          });
        }
      }
    } catch (error) {
      console.error('Error running stale heartbeat check:', error);
    }
  }, CHECK_INTERVAL_MS);
};

/**
 * Clean shutdown utility for background timer.
 */
export const stopHeartbeatChecker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('🛑 Background heartbeat checker stopped.');
  }
};
