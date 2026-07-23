import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const LOCK_ID = process.argv[2] || 'lock-01';

console.log(`🤖 Starting IoT Lock Simulator for [${LOCK_ID}]...`);
console.log(`🔌 Connecting to MQTT Broker at ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
  console.log(`✅ Lock Simulator [${LOCK_ID}] connected to MQTT Broker.`);

  // Subscribe to command topic specifically for this lock
  const commandTopic = `locks/${LOCK_ID}/commands`;
  client.subscribe(commandTopic, (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to ${commandTopic}:`, err);
    } else {
      console.log(`📡 Listening for commands on topic: ${commandTopic}`);
    }
  });
});

client.on('message', (topic, message) => {
  const payloadString = message.toString();
  console.log(`📥 Received command on [${topic}]: ${payloadString}`);

  try {
    const data = JSON.parse(payloadString);
    const { command, transactionId } = data;

    if (command === 'UNLOCK' && transactionId) {
      console.log(`🔓 Simulating lock motor turning...`);
      
      // Simulate hardware unlocking latency
      setTimeout(() => {
        const ackTopic = `locks/${LOCK_ID}/ack`;
        const ackPayload = JSON.stringify({
          transactionId,
          status: 'SUCCESS',
        });

        console.log(`📤 Publishing acknowledgement to [${ackTopic}]: ${ackPayload}`);
        client.publish(ackTopic, ackPayload, { qos: 1 });
        console.log(`✅ Lock [${LOCK_ID}] unlocked successfully.`);
      }, 1000);
    }
  } catch (err) {
    console.error('Failed to parse command payload:', err);
  }
});

client.on('error', (err) => {
  console.error('MQTT Client Error:', err);
});
export default client;
