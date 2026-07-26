import app from './app';
import { config } from './config';
import { initMqttSubscriptions } from './services/mqtt.service';
import { initWebSocketServer } from './ws';
import { startHeartbeatChecker, stopHeartbeatChecker } from './services/heartbeat.service';
import { startDemoSimulators } from './services/demo-simulator.service';
import { seedDatabase } from './config/seed';
import './config/mqtt'; // Boot connection
import './queues/pin-expiration.worker'; // Boot BullMQ Worker

// Run auto-seeding
seedDatabase();

// Start MQTT message parsing listeners
initMqttSubscriptions();

const server = app.listen(config.port, () => {
  console.log(`=========================================`);
  console.log(`  IoT Smart Lock Backend listening on port: ${config.port}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`=========================================`);
});

// Start WebSocket server sharing the same HTTP port
initWebSocketServer(server);

// Start background device status heartbeat monitors
startHeartbeatChecker();
startDemoSimulators();

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  stopHeartbeatChecker();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
export default server;
