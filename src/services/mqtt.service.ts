import { mqttClient } from '../config/mqtt';
import { transactionService } from './transaction.service';

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
      // Regular expression to parse the lock ID from topic "locks/{lockId}/ack"
      const ackMatch = topic.match(/^locks\/([^/]+)\/ack$/);
      if (ackMatch) {
        const lockId = ackMatch[1];
        const data = JSON.parse(payloadString);
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
      }
    } catch (err) {
      console.error('Error handling MQTT message:', err);
    }
  });
};
