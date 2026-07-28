import { mqttClient } from '../config/mqtt';
import { transactionService } from './transaction.service';
import { prisma } from '../config/db';
import { AccessMethod, AccessResult, LockStatus } from '@prisma/client';
import { broadcastEvent } from '../ws';
import bcrypt from 'bcrypt';

// Map of virtualTransactionId -> pin (to simulate hardware PIN confirmations in browser)
export const virtualSimulatorTransactions = new Map<string, string>();

export const registerVirtualTransaction = (transactionId: string, pin: string) => {
  virtualSimulatorTransactions.set(transactionId, pin);
};

/**
 * Publishes a LOCK/UNLOCK command payload to a specific lock via MQTT.
 */
export const publishLockCommand = (lockId: string, command: 'LOCK' | 'UNLOCK', transactionId: string) => {
  const topic = `locks/${lockId}/commands`;
  const payload = JSON.stringify({
    command,
    transactionId,
  });

  console.log(`📤 MQTT Publishing command to topic [${topic}]: ${payload}`);
  mqttClient.publish(topic, payload, { qos: 1 });
};

export const publishUnlockCommand = (lockId: string, transactionId: string) => {
  publishLockCommand(lockId, 'UNLOCK', transactionId);
};

/**
 * Listens to incoming MQTT messages and routes them to appropriate handlers.
 */
export const initMqttSubscriptions = () => {
  mqttClient.on('message', async (topic, message) => {
    const payloadString = message.toString();
    console.log(`📥 MQTT Message received on [${topic}]: ${payloadString}`);

    try {
      const data = JSON.parse(payloadString);

      // Match locks/:lockId/ack
      const ackMatch = topic.match(/^locks\/([^/]+)\/ack$/);
      if (ackMatch) {
        const lockId = ackMatch[1];
        const { transactionId, status, error } = data;

        if (transactionId) {
          if (status === 'SUCCESS') {
            transactionService.resolveTransaction(transactionId, { lockId, status, ...data });
          } else {
            transactionService.rejectTransaction(
              transactionId,
              new Error(error || `Device command failure: ${status}`)
            );
          }
        }
        return;
      }

      // Match locks/:lockId/validate-pin
      const validateMatch = topic.match(/^locks\/([^/]+)\/validate-pin$/);
      if (validateMatch) {
        const lockId = validateMatch[1];
        const { pin, transactionId } = data;

        if (!pin || !transactionId) {
          console.warn(`⚠️ Incomplete validation payload received for lock [${lockId}]`);
          return;
        }

        const replyTopic = `locks/${lockId}/validate-pin/reply`;

        // Search for all pin records for this lock and compare hashes
        const pinRecords = await prisma.temporaryPin.findMany({
          where: { lockId },
          orderBy: { createdAt: 'desc' },
        });

        let pinRecord = null;
        for (const record of pinRecords) {
          const match = await bcrypt.compare(pin, record.pin);
          if (match) {
            pinRecord = record;
            break;
          }
        }

        // 1. PIN doesn't exist
        if (!pinRecord) {
          console.log(`❌ PIN [${pin}] is unauthorized for lock [${lockId}]`);
          mqttClient.publish(replyTopic, JSON.stringify({ allowed: false, transactionId }), { qos: 1 });
          
          await prisma.accessLog.create({
            data: {
              lockId,
              pinUsed: pin,
              method: AccessMethod.PIN,
              result: AccessResult.FAILED_UNAUTHORIZED,
            },
          });

          broadcastEvent('ACCESS_DENIED', {
            lockId,
            method: 'PIN',
            reason: 'FAILED_UNAUTHORIZED',
            message: `Access denied at lock ${lockId}: Invalid PIN typed`,
          });
          return;
        }

        // 2. PIN exists but is expired or deactivated
        const isExpired = pinRecord.expiresAt < new Date() || !pinRecord.isActive;
        if (isExpired) {
          console.log(`❌ PIN [${pin}] is expired/inactive for lock [${lockId}]`);
          mqttClient.publish(replyTopic, JSON.stringify({ allowed: false, transactionId }), { qos: 1 });

          await prisma.accessLog.create({
            data: {
              lockId,
              userId: pinRecord.userId,
              pinUsed: pin,
              method: AccessMethod.PIN,
              result: AccessResult.FAILED_EXPIRED_PIN,
            },
          });

          broadcastEvent('ACCESS_DENIED', {
            lockId,
            method: 'PIN',
            reason: 'FAILED_EXPIRED_PIN',
            userId: pinRecord.userId,
            message: `Access denied at lock ${lockId}: Expired PIN typed`,
          });
          return;
        }

        // 3. PIN is valid
        console.log(`✅ PIN [${pin}] is valid. Sending allowed: true payload.`);
        mqttClient.publish(
          replyTopic,
          JSON.stringify({ allowed: true, transactionId, userId: pinRecord.userId }),
          { qos: 1 }
        );
        return;
      }

      // Match locks/:lockId/events
      const eventMatch = topic.match(/^locks\/([^/]+)\/events$/);
      if (eventMatch) {
        const lockId = eventMatch[1];
        const { event, transactionId, pin, userId } = data;

        if (event === 'PIN_ACCESS_GRANTED') {
          console.log(`🚪 Lock [${lockId}] reports user [${userId}] entered via PIN successfully.`);
          
          await prisma.accessLog.create({
            data: {
              lockId,
              userId,
              pinUsed: pin,
              method: AccessMethod.PIN,
              result: AccessResult.SUCCESS,
            },
          });

          // Update lock status in database
          await prisma.lock.update({
            where: { id: lockId },
            data: { status: 'UNLOCKED' },
          });

          broadcastEvent('LOCK_UNLOCKED', {
            lockId,
            method: 'PIN',
            userId,
            message: `Lock ${lockId} unlocked successfully via Keypad PIN`,
          });
        }
        return;
      }

      // Match locks/:lockId/heartbeat
      const heartbeatMatch = topic.match(/^locks\/([^/]+)\/heartbeat$/);
      if (heartbeatMatch) {
        const lockId = heartbeatMatch[1];
        const { status } = data; // LOCKED or UNLOCKED

        const lock = await prisma.lock.findUnique({ where: { id: lockId } });
        if (lock) {
          const wasOffline = !lock.isOnline;
          const statusChanged = lock.status !== status;

          await prisma.lock.update({
            where: { id: lockId },
            data: {
              lastHeartbeat: new Date(),
              isOnline: true,
              status: status as any,
            },
          });

          // Broadcast if lock transitioned from offline to online
          if (wasOffline) {
            console.log(`📡 Lock [${lockId}] is now ONLINE.`);
            broadcastEvent('LOCK_ONLINE', {
              lockId,
              message: `Lock ${lockId} has connected online`,
            });
          }

          // Broadcast if lock status changed via heartbeat update (like auto-relock)
          if (statusChanged && !wasOffline) {
            console.log(`📡 Lock [${lockId}] status changed to ${status} via heartbeat.`);
            broadcastEvent('LOCK_STATUS_CHANGED', {
              lockId,
              status,
              message: `Lock ${lockId} auto-relocked to ${status}`,
            });
          }
        }
        return;
      }

      // Match locks/:lockId/validate-pin/reply (browser visual simulator bypass)
      const replyMatch = topic.match(/^locks\/([^/]+)\/validate-pin\/reply$/);
      if (replyMatch) {
        const lockId = replyMatch[1];
        const { allowed, transactionId, userId } = data;

        const pin = virtualSimulatorTransactions.get(transactionId);
        if (pin) {
          virtualSimulatorTransactions.delete(transactionId);

          if (allowed) {
            console.log(`🤖 MOCK HARDWARE [${lockId}]: Received allowed=true. Simulating physical unlock confirmation...`);
            setTimeout(() => {
              const eventTopic = `locks/${lockId}/events`;
              const eventPayload = JSON.stringify({
                event: 'PIN_ACCESS_GRANTED',
                transactionId,
                pin,
                userId,
              });
              mqttClient.publish(eventTopic, eventPayload, { qos: 1 });
              console.log(`🤖 MOCK HARDWARE [${lockId}]: Published PIN_ACCESS_GRANTED event.`);
            }, 1000);
          } else {
            console.log(`🤖 MOCK HARDWARE [${lockId}]: Received allowed=false. Lock refused.`);
          }
        }
        return;
      }

    } catch (err) {
      console.error('Error handling MQTT message:', err);
    }
  });
};
