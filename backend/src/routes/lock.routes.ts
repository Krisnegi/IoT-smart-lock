import { Router } from 'express';
import { createLock, getAllLocks, getLockById, updateLock, deleteLock, unlockLock, createTempPin, getLockLogs } from '../controllers/lock.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Apply authentication middleware globally to all lock routes
router.use(authenticate);

// Control Route (Checks dynamic user permissions inside controller)
router.post('/:id/unlock', unlockLock);

// Temporary Access PIN creation
router.post('/:id/temp-pin', authorize([Role.ADMIN]), createTempPin);

// Audit Logs Query
router.get('/:id/logs', authorize([Role.ADMIN]), getLockLogs);

// CRUD Routes
router.post('/', authorize([Role.ADMIN]), createLock);
router.get('/', authorize([Role.ADMIN]), getAllLocks);
router.get('/:id', authorize([Role.ADMIN]), getLockById);
router.put('/:id', authorize([Role.ADMIN]), updateLock);
router.delete('/:id', authorize([Role.ADMIN]), deleteLock);

export default router;
