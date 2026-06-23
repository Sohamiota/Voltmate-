import { Router } from 'express';
import {
  requestOwnerOtp,
  verifyOwnerOtp,
  getOwnerServiceStatus,
} from '../controllers/serviceOwnerController';

const router = Router();

router.post('/request-otp', requestOwnerOtp);
router.post('/verify-otp', verifyOwnerOtp);
router.get('/status', getOwnerServiceStatus);

export default router;
