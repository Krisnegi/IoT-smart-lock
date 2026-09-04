import { redis } from '../config/redis';

export interface LockEventPayload {
  eventId: string;
  lockId: string;
  eventType: 'PIN_SUCCESS' | 'PIN_FAILED' | 'REMOTE_UNLOCK' | 'REMOTE_LOCK' | 'ACCESS_DENIED' | 'OFFLINE_DETECTED';
  method: 'PIN' | 'API' | 'SYSTEM';
  userId?: string;
  pinUsed?: string;
  status: 'SUCCESS' | 'FAILED_UNAUTHORIZED' | 'FAILED_EXPIRED_PIN' | 'FAILED_DEVICE_ERROR' | 'FAILED_OFFLINE';
  timestamp: string;
  details?: string;
}

export const publishLockEvent = async (event: Omit<LockEventPayload, 'eventId' | 'timestamp'>) => {
  try {
    const fullPayload: LockEventPayload = {
      ...event,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    const channel = 'lock.events';
    const jsonMessage = JSON.stringify(fullPayload);

    await redis.publish(channel, jsonMessage);
    console.log(`📡 Redis PubSub Published to [${channel}]: ${event.eventType} for lock [${event.lockId}]`);
  } catch (error) {
    console.error('❌ Failed to publish Redis lock event:', error);
  }
};
