import { Router } from 'express';
import { register, login, getAllUsers } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.post('/register', register);
router.post('/login', login);

// Protected verification routes
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({ user: req.user });
});

router.get('/users', authenticate, authorize([Role.ADMIN]), getAllUsers);

router.get('/admin-only', authenticate, authorize([Role.ADMIN]), (req, res) => {
  res.status(200).json({ message: 'Welcome Admin!', user: req.user });
});

export default router;
