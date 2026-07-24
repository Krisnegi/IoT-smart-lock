import { prisma } from '../config/db';
import { broadcastEvent } from '../ws';

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
      const threshold = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

      // Find all locks currently marked online but missing recent heartbeats
      const staleLocks = await prisma.lock.findMany({
        where: {
          isOnline: true,
          OR: [
            { lastHeartbeat: { lt: threshold } },
            { lastHeartbeat: null },
          ],
        },
      });

      if (staleLocks.length > 0) {
        console.log(`⚠️ Detected ${staleLocks.length} offline/stale lock(s). Updating status...`);

        for (const lock of staleLocks) {
          await prisma.lock.update({
            where: { id: lock.id },
            data: { isOnline: false },
          });

          console.log(`❌ Lock [${lock.id}] flagged as OFFLINE (no heartbeat).`);

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
