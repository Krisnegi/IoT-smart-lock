import mqtt from 'mqtt';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const LOCK_ID = process.argv[2] || 'lock-01';

console.log(`🤖 Starting IoT Lock Simulator for [${LOCK_ID}]...`);
console.log(`🔌 Connecting to MQTT Broker at ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL);

// Track active PIN entries to match validation replies
const pendingValidations = new Map<string, { pin: string }>();

client.on('connect', () => {
  console.log(`✅ Lock Simulator [${LOCK_ID}] connected to MQTT Broker.`);

  const commandTopic = `locks/${LOCK_ID}/commands`;
  const replyTopic = `locks/${LOCK_ID}/validate-pin/reply`;

  // Subscribe to command topic and validation replies topic
  client.subscribe([commandTopic, replyTopic], (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to topics:`, err);
    } else {
      console.log(`📡 Listening for commands on topic: ${commandTopic}`);
      console.log(`📡 Listening for validation replies on topic: ${replyTopic}`);
      console.log(`⌨️  You can type a PIN code directly in this terminal to simulate a keypad entry!`);
    }
  });
});

// Capture keyboard input to simulate typing a PIN on the lock's physical keypad
process.stdin.resume();
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (text) => {
  const pin = text.toString().trim();
  if (!pin) return;

  if (!/^\d+$/.test(pin)) {
    console.log(`❌ Invalid entry [${pin}]. Keypad only accepts numeric digits.`);
    return;
  }

  const transactionId = crypto.randomUUID();
  pendingValidations.set(transactionId, { pin });

  const validateTopic = `locks/${LOCK_ID}/validate-pin`;
  const payload = JSON.stringify({ pin, transactionId });

  console.log(`⌨️  Keypad: entered PIN [${pin}]. Requesting authorization...`);
  client.publish(validateTopic, payload, { qos: 1 });
});

client.on('message', (topic, message) => {
  const payloadString = message.toString();
  console.log(`📥 Received message on [${topic}]: ${payloadString}`);

  try {
    const data = JSON.parse(payloadString);

    // 1. Handle remote unlock command from API
    if (topic.endsWith('/commands')) {
      const { command, transactionId } = data;
      if (command === 'UNLOCK' && transactionId) {
        console.log(`🔓 Remote unlock command received. Simulating motor turning...`);
        setTimeout(() => {
          const ackTopic = `locks/${LOCK_ID}/ack`;
          client.publish(ackTopic, JSON.stringify({ transactionId, status: 'SUCCESS' }), { qos: 1 });
          console.log(`✅ Lock [${LOCK_ID}] unlocked successfully.`);
        }, 1000);
      }
      return;
    }

    // 2. Handle validation reply for keypad PIN entry
    if (topic.endsWith('/validate-pin/reply')) {
      const { allowed, transactionId, userId } = data;
      
      const pending = pendingValidations.get(transactionId);
      if (!pending) return; // Unrelated or expired entry
      pendingValidations.delete(transactionId);

      if (allowed) {
        console.log(`🔓 Authorization GRANTED by backend. Simulating motor turning...`);
        setTimeout(() => {
          const eventTopic = `locks/${LOCK_ID}/events`;
          const eventPayload = JSON.stringify({
            event: 'PIN_ACCESS_GRANTED',
            transactionId,
            pin: pending.pin,
            userId,
          });
          client.publish(eventTopic, eventPayload, { qos: 1 });
          console.log(`✅ Access success event confirmed and published to ${eventTopic}.`);
        }, 1000);
      } else {
        console.log(`🛑 Authorization DENIED by backend. Access refused.`);
      }
      return;
    }

  } catch (err) {
    console.error('Failed to process message payload:', err);
  }
});

client.on('error', (err) => {
  console.error('MQTT Client Error:', err);
});

export default client;
