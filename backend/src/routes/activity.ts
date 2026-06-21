import { Router } from 'express';
import { getActivity } from '../controllers/activityController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/', authMiddleware, getActivity);

export default router;

