import { Router } from 'express';
import {
  adminApproveLeave,
  cancelRequest,
  createLeaveRequest,
  downloadProof,
  getBalance,
  getHolidays,
  listRequests,
  previewWorkingDays,
  uploadProof,
} from '../controllers/leaveController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/balance', getBalance);
router.get('/holidays', getHolidays);
router.get('/preview-days', previewWorkingDays);
router.get('/:id/proof', downloadProof);
router.get('/', listRequests);
router.post('/', createLeaveRequest);
router.post('/:id/proof', uploadProof);
router.post('/:id/cancel', cancelRequest);
router.post('/admin/:id/approve', adminApproveLeave);

export default router;
