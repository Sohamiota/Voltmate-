import { Router } from 'express';
import { clockIn, clockOut, currentAttendance, listAttendance, getAttendance, adminApproveAttendance } from '../controllers/attendanceController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/clockin', authMiddleware, clockIn);
router.post('/clockout', authMiddleware, clockOut);
router.get('/current', authMiddleware, currentAttendance);
router.get('/stats', authMiddleware, attendanceStats);
router.get('/', authMiddleware, listAttendance);
router.get('/:id', authMiddleware, getAttendance);

// admin actions
router.post('/admin/:id/approve', authMiddleware, adminApproveAttendance);

export default router;

