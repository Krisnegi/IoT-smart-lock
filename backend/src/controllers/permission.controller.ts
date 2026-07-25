import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const grantPermission = async (req: Request, res: Response) => {
  try {
    const { userId, lockId } = req.body;

    if (!userId || !lockId) {
      return res.status(400).json({ error: 'userId and lockId are required' });
    }

    // Verify user exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify lock exists
    const lockExists = await prisma.lock.findUnique({ where: { id: lockId } });
    if (!lockExists) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // Check if permission already exists
    const existingPermission = await prisma.userLockPermission.findUnique({
      where: {
        userId_lockId: { userId, lockId },
      },
    });

    if (existingPermission) {
      return res.status(409).json({ error: 'User already has permission for this lock' });
    }

    const permission = await prisma.userLockPermission.create({
      data: { userId, lockId },
    });

    return res.status(201).json({
      message: 'Permission granted successfully',
      permission,
    });
  } catch (error) {
    console.error('Grant permission error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const revokePermission = async (req: Request, res: Response) => {
  try {
    const { userId, lockId } = req.body;

    if (!userId || !lockId) {
      return res.status(400).json({ error: 'userId and lockId are required in the body' });
    }

    const existingPermission = await prisma.userLockPermission.findUnique({
      where: {
        userId_lockId: { userId, lockId },
      },
    });

    if (!existingPermission) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    await prisma.userLockPermission.delete({
      where: {
        userId_lockId: { userId, lockId },
      },
    });

    return res.status(200).json({
      message: 'Permission revoked successfully',
    });
  } catch (error) {
    console.error('Revoke permission error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserLocks = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const permissions = await prisma.userLockPermission.findMany({
      where: { userId: req.user.id },
      include: {
        lock: true,
      },
    });

    const locks = permissions.map((p) => p.lock);

    return res.status(200).json({ locks });
  } catch (error) {
    console.error('Get user locks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
