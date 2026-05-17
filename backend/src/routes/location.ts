import { Router } from 'express';
import { recordPing, getDayTrail, getTodaySnapshot, getMyTrail } from '../controllers/locationController';

const router = Router();

// Any authenticated user — record a location ping
router.post('/ping', recordPing);

// Oversight roles — fetch a specific user's trail for a day (includes attendance record)
router.get('/day', getDayTrail);

// Oversight roles — latest ping today per sales/employee user
router.get('/today-snapshot', getTodaySnapshot);

// Any authenticated user — fetch their own trail
router.get('/mine', getMyTrail);

export default router;
