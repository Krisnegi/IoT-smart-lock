import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { mqttClient } from '../config/mqtt';
import { registerVirtualTransaction } from '../services/mqtt.service';
import crypto from 'crypto';

/**
 * Endpoint to simulate typing a PIN on the smart lock physical keypad.
 * This triggers the exact same MQTT topics and validation pathways as physical locks.
 */
export const triggerKeypadEntry = async (req: Request, res: Response) => {
  const { lockId, pin } = req.body;

  if (!lockId || !pin) {
    return res.status(400).json({ error: 'lockId and pin are required' });
  }

  try {
    // 1. Verify lock exists
    const lock = await prisma.lock.findUnique({ where: { id: lockId } });
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // 2. Generate correlation transaction ID
    const transactionId = crypto.randomUUID();

    // 3. Register the virtual transaction on the backend to automatically
    // simulate lock hardware success responses on the MQTT network
    registerVirtualTransaction(transactionId, pin);

    // 4. Publish validation query to MQTT locks/:lockId/validate-pin
    const topic = `locks/${lockId}/validate-pin`;
    const payload = JSON.stringify({ pin, transactionId });

    console.log(`📤 SIMULATOR PROXY: Clicks digits on keypad for lock [${lockId}]. Publishing: ${payload}`);
    mqttClient.publish(topic, payload, { qos: 1 });

    return res.status(200).json({
      message: 'Keypad entry request published successfully',
      transactionId,
    });
  } catch (error) {
    console.error('Simulator keypad proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
