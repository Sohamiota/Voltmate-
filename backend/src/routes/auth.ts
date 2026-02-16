import { Router } from 'express';
import { register, verify, login, me, listEmployees, adminApprove } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/auth/register', register);
router.post('/auth/verify', verify);
router.post('/auth/login', login);
router.get('/auth/me', authMiddleware, me);

// admin actions
router.post('/admin/users/:id/approve', authMiddleware, adminApprove);
router.get('/employees', authMiddleware, listEmployees);

export default router;

