import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { LockStatus, Role, AccessMethod, AccessResult } from '@prisma/client';
import { transactionService } from '../services/transaction.service';
import { publishUnlockCommand } from '../services/mqtt.service';
import { schedulePinExpiration } from '../queues/pin-expiration.queue';
import { broadcastEvent } from '../ws';

export const createLock = async (req: Request, res: Response) => {
  try {
    const { id, name } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: 'Lock id and name are required' });
    }

    const existingLock = await prisma.lock.findUnique({ where: { id } });
    if (existingLock) {
      return res.status(409).json({ error: `Lock with id '${id}' already registered` });
    }

    const lock = await prisma.lock.create({
      data: { id, name },
    });

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
    const locks = await prisma.lock.findMany();
    return res.status(200).json({ locks });
  } catch (error) {
    console.error('Get all locks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLockById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lock = await prisma.lock.findUnique({ where: { id } });

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
    const { name, status } = req.body;

    const existingLock = await prisma.lock.findUnique({ where: { id } });
    if (!existingLock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // Validate status if provided
    if (status && !Object.values(LockStatus).includes(status as LockStatus)) {
      return res.status(400).json({ error: `Invalid status. Allowed values: ${Object.values(LockStatus).join(', ')}` });
    }

    const lock = await prisma.lock.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        status: status !== undefined ? (status as LockStatus) : undefined,
      },
    });

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

    const existingLock = await prisma.lock.findUnique({ where: { id } });
    if (!existingLock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    await prisma.lock.delete({ where: { id } });

    return res.status(200).json({ message: `Lock '${id}' deleted successfully` });
  } catch (error) {
    console.error('Delete lock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const unlockLock = async (req: Request, res: Response) => {
  const { id: lockId } = req.params;
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

        return res.status(403).json({ error: 'Forbidden: You do not have permission to unlock this lock' });
      }
    }

    // 3. Create transient transaction
    const { transactionId, promise } = transactionService.createTransaction();

    // 4. Publish MQTT command
    publishUnlockCommand(lockId, transactionId);

    // 5. Wait for Lock Simulator ACK
    try {
      await promise;

      // 6. On success, update lock status to UNLOCKED
      const updatedLock = await prisma.lock.update({
        where: { id: lockId },
        data: { status: LockStatus.UNLOCKED },
      });

      // Log successful access attempt
      await prisma.accessLog.create({
        data: {
          lockId,
          userId: user.id,
          method: AccessMethod.API,
          result: AccessResult.SUCCESS,
        },
      });

      broadcastEvent('LOCK_UNLOCKED', {
        lockId,
        method: 'API',
        user: { id: user.id, email: user.email },
        message: `Lock ${lockId} unlocked remotely by user ${user.email}`,
      });

      return res.status(200).json({
        message: 'Unlock command executed successfully',
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
  const { id: lockId } = req.params;
  const { userId, pin, durationSeconds } = req.body;

  if (!userId || !pin || !durationSeconds) {
    return res.status(400).json({ error: 'userId, pin, and durationSeconds are required' });
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

    // 3. Calculate expiration date
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);

    // 4. Create TemporaryPin in database
    const tempPin = await prisma.temporaryPin.create({
      data: {
        lockId,
        userId,
        pin,
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
        pin: tempPin.pin,
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
  const { id: lockId } = req.params;

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

    return res.status(200).json({ logs });
  } catch (error) {
    console.error('Get lock logs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
