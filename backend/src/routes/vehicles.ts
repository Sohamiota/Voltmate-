import { Router } from 'express';
import {
  listVehicles,
  createVehicle,
  updateVehicle,
  patchCurrentKm,
  deleteVehicle,
  serviceDashboard,
  importVehicles,
} from '../controllers/vehicleController';
import {
  listServicesForVehicle,
  upsertService,
} from '../controllers/vehicleServiceController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/dashboard', authMiddleware, serviceDashboard);
router.get('/', authMiddleware, listVehicles);
router.post('/import', authMiddleware, importVehicles);
router.post('/', authMiddleware, createVehicle);
router.get('/:id/services', authMiddleware, listServicesForVehicle);
router.put('/:id/services/:svcId', authMiddleware, upsertService);
router.patch('/:id/current-km', authMiddleware, patchCurrentKm);
router.put('/:id', authMiddleware, updateVehicle);
router.delete('/:id', authMiddleware, deleteVehicle);

export default router;
