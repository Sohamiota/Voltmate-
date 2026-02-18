import { Router } from 'express';
import { register, verify, login, me, listEmployees, adminApprove } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Routes are mounted under /api/v1/auth in app.ts, so define paths relative to that base.
router.post('/register', register);
router.post('/verify', verify);
router.post('/login', login);
router.get('/me', authMiddleware, me);

// admin actions
router.post('/admin/users/:id/approve', authMiddleware, adminApprove);
router.get('/employees', authMiddleware, listEmployees);

export default router;

