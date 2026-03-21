import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  verify,
  login,
  me,
  listEmployees,
  adminApprove,
  adminChangeRole,
} from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// ─── [H-2] Rate limiting for brute-force / enumeration protection ─────────────
// Login: max 10 attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// Register: max 5 registrations per IP per hour (prevents spam)
const registerLimiter = rateLimit({
  windowMs:       60 * 60 * 1000,
  max:            5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

// General auth endpoint limiter (OTP verify, etc.)
const authLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Public routes
router.post('/register', registerLimiter, register);
router.post('/verify',   authLimiter,     verify);
router.post('/login',    loginLimiter,    login);

// Authenticated routes
router.get('/me',        authMiddleware, me);
router.get('/employees', authMiddleware, listEmployees);

// Admin-only routes
router.post('/admin/users/:id/approve',   authMiddleware, adminApprove);
router.patch('/admin/users/:id/role',     authMiddleware, adminChangeRole);

export default router;
