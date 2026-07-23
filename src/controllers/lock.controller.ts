import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { LockStatus, Role, AccessMethod, AccessResult } from '@prisma/client';
import { transactionService } from '../services/transaction.service';
import { publishUnlockCommand } from '../services/mqtt.service';

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

      return res.status(504).json({
        error: `Unlock failed: ${cmdError.message || 'Device communication error'}`,
      });
    }
  } catch (error) {
    console.error('Unlock lock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
