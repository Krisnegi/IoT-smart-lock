import { Router } from 'express';
import { grantPermission, revokePermission, getUserLocks } from '../controllers/permission.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Apply authentication globally to all permission routes
router.use(authenticate);

// View currently permitted locks for the logged-in user
router.get('/my-locks', getUserLocks);

// Admin & Manager actions
router.post('/grant', authorize([Role.ADMIN, Role.MANAGER]), grantPermission);
router.post('/revoke', authorize([Role.ADMIN, Role.MANAGER]), revokePermission);

export default router;
