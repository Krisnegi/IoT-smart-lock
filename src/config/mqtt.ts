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

  // Subscribe to PIN validation requests from locks
  mqttClient.subscribe('locks/+/validate-pin', (err) => {
    if (err) {
      console.error('Failed to subscribe to locks/+/validate-pin:', err);
    } else {
      console.log('📡 Subscribed to MQTT topic: locks/+/validate-pin');
    }
  });

  // Subscribe to lock hardware events (like PIN confirmation and heartbeats)
  mqttClient.subscribe('locks/+/events', (err) => {
    if (err) {
      console.error('Failed to subscribe to locks/+/events:', err);
    } else {
      console.log('📡 Subscribed to MQTT topic: locks/+/events');
    }
  });

  // Subscribe to lock heartbeat topic
  mqttClient.subscribe('locks/+/heartbeat', (err) => {
    if (err) {
      console.error('Failed to subscribe to locks/+/heartbeat:', err);
    } else {
      console.log('📡 Subscribed to MQTT topic: locks/+/heartbeat');
    }
  });
});

mqttClient.on('error', (err) => {
  console.error('MQTT Connection Error:', err);
});
