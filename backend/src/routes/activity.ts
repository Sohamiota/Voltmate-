import { Router } from 'express';
import { getActivity } from '../controllers/activityController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/activity', authMiddleware, getActivity);

export default router;

