import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { LockStatus } from '@prisma/client';

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
