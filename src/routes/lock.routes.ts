import { Router } from 'express';
import { createLock, getAllLocks, getLockById, updateLock, deleteLock } from '../controllers/lock.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Apply authentication middleware globally to all lock routes
router.use(authenticate);

// CRUD Routes
router.post('/', authorize([Role.ADMIN]), createLock);
router.get('/', authorize([Role.ADMIN, Role.MANAGER]), getAllLocks);
router.get('/:id', authorize([Role.ADMIN, Role.MANAGER]), getLockById);
router.put('/:id', authorize([Role.ADMIN]), updateLock);
router.delete('/:id', authorize([Role.ADMIN]), deleteLock);

export default router;
