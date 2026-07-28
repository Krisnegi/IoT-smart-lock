import mqtt from 'mqtt';
import { config } from '../config';
import { prisma } from '../config/db';

const activeSimulators = new Map<string, mqtt.MqttClient>();
const activeIntervals = new Map<string, NodeJS.Timeout>();

export const registerDynamicDemoSimulator = (lockId: string) => {
  if (!config.demoMode) return;
  if (activeSimulators.has(lockId)) return;

  const brokerUrl = config.mqtt.brokerUrl;
  const client = mqtt.connect(brokerUrl);
  let currentStatus = 'LOCKED';
  let relockTimeout: NodeJS.Timeout | null = null;

  const sendHeartbeat = () => {
    if (client.connected) {
      client.publish(
        `locks/${lockId}/heartbeat`,
        JSON.stringify({
          status: currentStatus,
          timestamp: new Date().toISOString(),
        }),
        { qos: 1 }
      );
    }
  };

  client.on('connect', () => {
    console.log(`🤖 Virtual Simulator [${lockId}] connected to MQTT Broker.`);

    // Subscribe to command topic
    client.subscribe(`locks/${lockId}/commands`, (err) => {
      if (err) {
        console.error(`❌ Virtual Simulator [${lockId}] subscription failed:`, err);
      }
    });

    // Subscribe to events topic (to detect PIN unlocks)
    client.subscribe(`locks/${lockId}/events`, (err) => {
      if (err) {
        console.error(`❌ Virtual Simulator [${lockId}] events subscription failed:`, err);
      }
    });

    // Send initial heartbeat
    sendHeartbeat();

    // Start heartbeat loop every 10 seconds
    const interval = setInterval(sendHeartbeat, 10000);
    activeIntervals.set(lockId, interval);
  });

  client.on('message', (topic, message) => {
    try {
      const payloadString = message.toString();
      const data = JSON.parse(payloadString);

      if (topic === `locks/${lockId}/commands`) {
        const { command, transactionId } = data;
        if (transactionId) {
          if (command === 'UNLOCK') {
            console.log(`🤖 Virtual Simulator [${lockId}] executing remote UNLOCK command...`);
            
            // Simulating motor unlock delay of 1 second
            setTimeout(() => {
              // 1. Send ACK back to the backend
              client.publish(
                `locks/${lockId}/ack`,
                JSON.stringify({ transactionId, status: 'SUCCESS' }),
                { qos: 1 }
              );

              // 2. Change status to UNLOCKED
              currentStatus = 'UNLOCKED';
              console.log(`🤖 Virtual Simulator [${lockId}] status changed to UNLOCKED.`);

              // 3. Auto-relock after 30 seconds (30000ms)
              if (relockTimeout) clearTimeout(relockTimeout);
              relockTimeout = setTimeout(() => {
                currentStatus = 'LOCKED';
                sendHeartbeat();
                console.log(`🤖 Virtual Simulator [${lockId}] auto-relocked to LOCKED.`);
              }, 30000);

            }, 1000);
          } else if (command === 'LOCK') {
            console.log(`🤖 Virtual Simulator [${lockId}] executing remote LOCK command...`);
            
            // Simulating motor lock delay of 1 second
            setTimeout(() => {
              // 1. Send ACK back to the backend
              client.publish(
                `locks/${lockId}/ack`,
                JSON.stringify({ transactionId, status: 'SUCCESS' }),
                { qos: 1 }
              );

              // 2. Change status to LOCKED
              currentStatus = 'LOCKED';
              if (relockTimeout) {
                clearTimeout(relockTimeout);
                relockTimeout = null;
              }
              console.log(`🤖 Virtual Simulator [${lockId}] status changed to LOCKED.`);
            }, 1000);
          }
        }
      } else if (topic === `locks/${lockId}/events`) {
        const { event } = data;
        if (event === 'PIN_ACCESS_GRANTED') {
          console.log(`🤖 Virtual Simulator [${lockId}] detected PIN unlock event.`);
          currentStatus = 'UNLOCKED';

          // Auto-relock after 30 seconds (30000ms)
          if (relockTimeout) clearTimeout(relockTimeout);
          relockTimeout = setTimeout(() => {
            currentStatus = 'LOCKED';
            sendHeartbeat();
            console.log(`🤖 Virtual Simulator [${lockId}] auto-relocked to LOCKED.`);
          }, 30000);
        }
      }
    } catch (err) {
      console.error(`❌ Virtual Simulator [${lockId}] message error:`, err);
    }
  });

  client.on('error', (err) => {
    console.error(`❌ Virtual Simulator [${lockId}] connection error:`, err);
  });

  activeSimulators.set(lockId, client);
};

export const startDemoSimulators = async () => {
  if (!config.demoMode) {
    console.log('ℹ️ DEMO_MODE is disabled. Skipping virtual IoT lock simulators.');
    return;
  }

  console.log('🤖 DEMO_MODE is active. Initializing virtual IoT lock simulators inside Express process...');

  try {
    // 1. Fetch all locks currently in the database to simulate them
    const locks = await prisma.lock.findMany();
    console.log(`🤖 Found ${locks.length} locks in database to simulate.`);
    
    locks.forEach(lock => {
      registerDynamicDemoSimulator(lock.id);
    });
  } catch (err) {
    console.error('Error starting demo simulators:', err);
  }
};
