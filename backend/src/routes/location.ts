import { Router } from 'express';
import { recordPing, getDayTrail, getMyTrail } from '../controllers/locationController';

const router = Router();

// Any authenticated user — record a location ping
router.post('/ping', recordPing);

// Admin-only — fetch a specific user's trail for a day (includes attendance record)
router.get('/day',  getDayTrail);

// Any authenticated user — fetch their own trail
router.get('/mine', getMyTrail);

export default router;
