import mqtt from 'mqtt';
import { config } from './index';

console.log(`🔌 Connecting to MQTT Broker at ${config.mqtt.brokerUrl}...`);
export const mqttClient = mqtt.connect(config.mqtt.brokerUrl);

mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT Broker successfully.');
  
  // Subscribe to ACK topic. The '+' character is a single-level wildcard in MQTT.
  // This allows the backend to receive acknowledgements for all locks.
  mqttClient.subscribe('locks/+/ack', (err) => {
    if (err) {
      console.error('Failed to subscribe to locks/+/ack:', err);
    } else {
      console.log('📡 Subscribed to MQTT topic: locks/+/ack');
    }
  });
});

mqttClient.on('error', (err) => {
  console.error('MQTT Connection Error:', err);
});
