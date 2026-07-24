import { mqttClient } from '../config/mqtt';
import { transactionService } from './transaction.service';
import { prisma } from '../config/db';
import { AccessMethod, AccessResult } from '@prisma/client';

/**
 * Publishes an UNLOCK command payload to a specific lock via MQTT.
 */
export const publishUnlockCommand = (lockId: string, transactionId: string) => {
  const topic = `locks/${lockId}/commands`;
  const payload = JSON.stringify({
    command: 'UNLOCK',
    transactionId,
  });

  console.log(`📤 MQTT Publishing command to topic [${topic}]: ${payload}`);
  mqttClient.publish(topic, payload, { qos: 1 });
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

        // Search for pin record
        const pinRecord = await prisma.temporaryPin.findFirst({
          where: { lockId, pin },
          orderBy: { createdAt: 'desc' },
        });

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
        }
        return;
      }

    } catch (err) {
      console.error('Error handling MQTT message:', err);
    }
  });
};
