import { Router } from 'express';
import { grantPermission, revokePermission, getUserLocks } from '../controllers/permission.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Apply authentication globally to all permission routes
router.use(authenticate);

// View currently permitted locks for the logged-in user
router.get('/my-locks', getUserLocks);

// Admin only actions
router.post('/grant', authorize([Role.ADMIN]), grantPermission);
router.post('/revoke', authorize([Role.ADMIN]), revokePermission);

export default router;
