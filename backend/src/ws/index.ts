import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

/**
 * Initializes the WebSocket server and hooks it into the existing Express HTTP server.
 * This allows HTTP and WebSockets to share the same port.
 */
export const initWebSocketServer = (httpServer: HttpServer) => {
  wss = new WebSocketServer({ noServer: true });

  // Handle the HTTP Connection Upgrade handshake
  httpServer.on('upgrade', (request, socket, head) => {
    // If we wanted to restrict access or check auth before upgrading, we could do it here
    wss?.handleUpgrade(request, socket, head, (ws) => {
      wss?.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔌 New dashboard client connected to WebSocket server.');

    // Send a welcome message
    ws.send(
      JSON.stringify({
        type: 'SYSTEM_INFO',
        payload: { message: 'Connected to IoT Smart Lock Live Dashboard WS Server' },
        timestamp: new Date().toISOString(),
      })
    );

    ws.on('close', () => {
      console.log('❌ Dashboard client disconnected from WebSocket server.');
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err);
    });
  });
};

/**
 * Broadcasts an event payload to all currently connected WebSocket clients.
 */
export const broadcastEvent = (type: string, payload: any) => {
  if (!wss) {
    console.warn('⚠️ WebSocket server not initialized. Skipping broadcast.');
    return;
  }

  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  });

  let clientCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      clientCount++;
    }
  });

  console.log(`📢 WS Broadcast [${type}] sent to ${clientCount} active client(s).`);
};
