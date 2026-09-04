import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { LockStatus, Role, AccessMethod, AccessResult } from '@prisma/client';
import { transactionService } from '../services/transaction.service';
import { publishUnlockCommand, publishLockCommand } from '../services/mqtt.service';
import bcrypt from 'bcrypt';
import { schedulePinExpiration } from '../queues/pin-expiration.queue';
import { broadcastEvent } from '../ws';
import { registerDynamicDemoSimulator } from '../services/demo-simulator.service';
import { redis } from '../config/redis';
import { publishLockEvent } from '../services/eventPublisher';

export const createLock = async (req: Request, res: Response) => {
  try {
    const { id, name } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: 'Lock id and name are required' });
    }

    const lockId = id.trim().toLowerCase();

    const existingLock = await prisma.lock.findUnique({ where: { id: lockId } });
    if (existingLock) {
      return res.status(409).json({ error: `Lock with id '${lockId}' already registered` });
    }

    const lock = await prisma.lock.create({
      data: { id: lockId, name },
    });

    // Sync to Redis cache
    await redis.set(`lock:${lockId}:registered`, 'true');
    await redis.set(`lock:${lockId}:is_online`, 'false');
    await redis.set(`lock:${lockId}:status`, 'LOCKED');

    // Register simulator client dynamically if in DEMO_MODE
    registerDynamicDemoSimulator(lockId);

    return res.status(201).json({
      message: 'Lock registered successfully',
      lock,
    });
  } catch (error) {
    console.error('Create lock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllLocks = async (req: Request, res: Response) => {
  try {
    const locks = await prisma.lock.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ locks });
  } catch (error) {
    console.error('Get all locks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLockById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lockId = id.trim().toLowerCase();
    const lock = await prisma.lock.findUnique({ where: { id: lockId } });

    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    return res.status(200).json({ lock });
  } catch (error) {
    console.error('Get lock by ID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateLock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lockId = id.trim().toLowerCase();
    const { name, status } = req.body;

    const existingLock = await prisma.lock.findUnique({ where: { id: lockId } });
    if (!existingLock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // Validate status if provided
    if (status && !Object.values(LockStatus).includes(status as LockStatus)) {
      return res.status(400).json({ error: `Invalid status. Allowed values: ${Object.values(LockStatus).join(', ')}` });
    }

    const lock = await prisma.lock.update({
      where: { id: lockId },
      data: {
        name: name !== undefined ? name : undefined,
        status: status !== undefined ? (status as LockStatus) : undefined,
      },
    });

    // Sync status to Redis cache if updated
    if (status !== undefined) {
      await redis.set(`lock:${lockId}:status`, status);
    }

    return res.status(200).json({
      message: 'Lock updated successfully',
      lock,
    });
  } catch (error) {
    console.error('Update lock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteLock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lockId = id.trim().toLowerCase();

    const existingLock = await prisma.lock.findUnique({ where: { id: lockId } });
    if (!existingLock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    await prisma.lock.delete({ where: { id: lockId } });

    // Purge lock keys from Redis cache
    await redis.del(
      `lock:${lockId}:registered`,
      `lock:${lockId}:is_online`,
      `lock:${lockId}:status`,
      `lock:${lockId}:heartbeat`
    );

    return res.status(200).json({ message: `Lock '${id}' deleted successfully` });
  } catch (error) {
    console.error('Delete lock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const unlockLock = async (req: Request, res: Response) => {
  const lockId = req.params.id.trim().toLowerCase();
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  try {
    // 1. Verify lock exists
    const lock = await prisma.lock.findUnique({ where: { id: lockId } });
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // 2. Verify permission (Admin can access any lock. Managers/Users check the permission mapping)
    if (user.role !== Role.ADMIN) {
      const hasPermission = await prisma.userLockPermission.findUnique({
        where: {
          userId_lockId: { userId: user.id, lockId },
        },
      });

      if (!hasPermission) {
        // Log unauthorized attempt in audit log
        await prisma.accessLog.create({
          data: {
            lockId,
            userId: user.id,
            method: AccessMethod.API,
            result: AccessResult.FAILED_UNAUTHORIZED,
          },
        });
        
        broadcastEvent('ACCESS_DENIED', {
          lockId,
          method: 'API',
          reason: 'FAILED_UNAUTHORIZED',
          user: { id: user.id, email: user.email },
          message: `Unauthorized remote unlock attempt on lock ${lockId} by ${user.email}`,
        });

        await publishLockEvent({
          lockId,
          eventType: 'ACCESS_DENIED',
          method: 'API',
          userId: user.id,
          status: 'FAILED_UNAUTHORIZED',
          details: `Unauthorized remote unlock attempt by ${user.email}`,
        });

        return res.status(403).json({ error: 'Forbidden: You do not have permission to unlock this lock' });
      }
    }

    const targetStatus = lock.status === LockStatus.UNLOCKED ? LockStatus.LOCKED : LockStatus.UNLOCKED;
    const command = targetStatus === LockStatus.UNLOCKED ? 'UNLOCK' : 'LOCK';

    // 3. Create transient transaction
    const { transactionId, promise } = transactionService.createTransaction();

    // 4. Publish MQTT command
    publishLockCommand(lockId, command, transactionId);

    // 5. Wait for Lock Simulator ACK
    try {
      await promise;

      // 6. On success, update lock status to targetStatus
      const updatedLock = await prisma.lock.update({
        where: { id: lockId },
        data: { status: targetStatus },
      });

      // Sync status to Redis cache
      await redis.set(`lock:${lockId}:status`, targetStatus);

      // Log successful access attempt
      await prisma.accessLog.create({
        data: {
          lockId,
          userId: user.id,
          method: AccessMethod.API,
          result: AccessResult.SUCCESS,
        },
      });

      const eventType = targetStatus === LockStatus.UNLOCKED ? 'LOCK_UNLOCKED' : 'LOCK_LOCKED';
      const eventMessage = targetStatus === LockStatus.UNLOCKED
        ? `Lock ${lockId} unlocked remotely by user ${user.email}`
        : `Lock ${lockId} locked remotely by user ${user.email}`;

      broadcastEvent(eventType, {
        lockId,
        method: 'API',
        user: { id: user.id, email: user.email },
        message: eventMessage,
      });

      await publishLockEvent({
        lockId,
        eventType: targetStatus === LockStatus.UNLOCKED ? 'REMOTE_UNLOCK' : 'REMOTE_LOCK',
        method: 'API',
        userId: user.id,
        status: 'SUCCESS',
        details: `Remote ${command.toLowerCase()} command executed by ${user.email}`,
      });

      return res.status(200).json({
        message: `${command === 'UNLOCK' ? 'Unlock' : 'Lock'} command executed successfully`,
        lock: updatedLock,
      });
    } catch (cmdError: any) {
      console.warn(`Command-Ack failed for lock ${lockId}:`, cmdError.message);

      let accessResult: AccessResult = AccessResult.FAILED_DEVICE_ERROR;
      if (cmdError.message === 'Device response timeout') {
        accessResult = AccessResult.FAILED_OFFLINE; // Device did not respond (timeout)
      }

      // Log failed attempt
      await prisma.accessLog.create({
        data: {
          lockId,
          userId: user.id,
          method: AccessMethod.API,
          result: accessResult,
        },
      });

      broadcastEvent('UNLOCK_FAILED', {
        lockId,
        method: 'API',
        user: { id: user.id, email: user.email },
        reason: accessResult,
        message: `Remote unlock failed for lock ${lockId}: ${cmdError.message}`,
      });

      await publishLockEvent({
        lockId,
        eventType: 'ACCESS_DENIED',
        method: 'API',
        userId: user.id,
        status: accessResult === AccessResult.FAILED_OFFLINE ? 'FAILED_OFFLINE' : 'FAILED_DEVICE_ERROR',
        details: `Remote unlock failed: ${cmdError.message}`,
      });

      return res.status(504).json({
        error: `Unlock failed: ${cmdError.message || 'Device communication error'}`,
      });
    }
  } catch (error) {
    console.error('Unlock lock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTempPin = async (req: Request, res: Response) => {
  const lockId = req.params.id.trim().toLowerCase();
  const { userId, pin, durationSeconds } = req.body;

  if (!userId || !pin || !durationSeconds) {
    return res.status(400).json({ error: 'userId, pin, and durationSeconds are required' });
  }

  // Verify PIN is exactly 6 numeric digits
  const pinRegex = /^\d{6}$/;
  if (!pinRegex.test(pin)) {
    return res.status(400).json({ error: 'PIN must be exactly 6 numeric digits' });
  }

  try {
    // 1. Verify lock exists
    const lock = await prisma.lock.findUnique({ where: { id: lockId } });
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // 2. Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2.5 Verify user is authorized for this lock
    const permission = await prisma.userLockPermission.findUnique({
      where: {
        userId_lockId: {
          userId,
          lockId,
        },
      },
    });
    if (!permission) {
      return res.status(403).json({ error: 'User must be authorized for this lock before creating a temporary PIN' });
    }

    // Check if an unexpired active temporary PIN already exists for this combination
    const activePin = await prisma.temporaryPin.findFirst({
      where: {
        lockId,
        userId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (activePin) {
      return res.status(400).json({ error: 'An active temporary PIN already exists for this user on this lock' });
    }

    // 3. Calculate expiration date
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);

    // Hash the PIN using bcrypt before storing in database
    const hashedPin = await bcrypt.hash(pin, 10);

    // 4. Create TemporaryPin in database
    const tempPin = await prisma.temporaryPin.create({
      data: {
        lockId,
        userId,
        pin: hashedPin,
        expiresAt,
      },
    });

    // 5. Schedule BullMQ job for expiration
    await schedulePinExpiration(tempPin.id, durationSeconds * 1000);

    return res.status(201).json({
      message: 'Temporary PIN created and scheduled for expiration successfully',
      tempPin: {
        id: tempPin.id,
        lockId: tempPin.lockId,
        userId: tempPin.userId,
        pin: pin, // Return plain text pin once in response for Admin visibility
        expiresAt: tempPin.expiresAt,
        isActive: tempPin.isActive,
      },
    });
  } catch (error) {
    console.error('Create temporary PIN error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLockLogs = async (req: Request, res: Response) => {
  const lockId = req.params.id.trim().toLowerCase();

  try {
    // 1. Verify lock exists
    const lock = await prisma.lock.findUnique({ where: { id: lockId } });
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // 2. Query logs sorted by timestamp descending
    const logs = await prisma.accessLog.findMany({
      where: { lockId },
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // 3. Query all user permissions for this lock
    const permissions = await prisma.userLockPermission.findMany({
      where: { lockId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            tempPins: {
              where: { lockId },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const authorizedUsers = permissions.map(p => {
      const latestPin = p.user.tempPins[0] || null;
      return {
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        latestPin: latestPin ? {
          id: latestPin.id,
          expiresAt: latestPin.expiresAt,
          isActive: latestPin.isActive,
        } : null,
      };
    });

    return res.status(200).json({ logs, authorizedUsers });
  } catch (error) {
    console.error('Get lock logs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
