import { Router } from 'express';
import { getOpportunity, updateOpportunity, listOpportunities } from '../controllers/opportunityController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/', authMiddleware, listOpportunities);
router.get('/:id', authMiddleware, getOpportunity);
router.patch('/:id', authMiddleware, updateOpportunity);

export default router;

