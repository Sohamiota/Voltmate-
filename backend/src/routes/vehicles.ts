import { Router } from 'express';
import {
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  patchCurrentKm,
  deleteVehicle,
  serviceDashboard,
  importVehicles,
  exportVehiclesCSV,
  updatePdi,
  getFilterOptions,
} from '../controllers/vehicleController';
import {
  listServicesForVehicle,
  upsertService,
} from '../controllers/vehicleServiceController';
import {
  getMonitoringSummary,
  listAlerts,
  getOpenAlertCount,
  acknowledgeAlert,
  acknowledgeAllAlerts,
} from '../controllers/serviceAlertController';
import { getServiceAnalytics } from '../controllers/serviceAnalyticsController';
import { authMiddleware } from '../middlewares/auth';
import { requireServiceRead, requireServiceWrite } from '../middlewares/serviceRole';
import { ensureServiceManagerMiddleware } from '../utils/ensureServiceManagerSchema';

const router = Router();

router.use(authMiddleware);
router.use(ensureServiceManagerMiddleware);
router.use(requireServiceRead);

router.get('/monitoring/summary', getMonitoringSummary);
router.get('/alerts/count', getOpenAlertCount);
router.get('/alerts', listAlerts);
router.patch('/alerts/ack-all', requireServiceWrite, acknowledgeAllAlerts);
router.patch('/alerts/:id/ack', requireServiceWrite, acknowledgeAlert);
router.get('/analytics', getServiceAnalytics);
router.get('/filters', getFilterOptions);
router.get('/dashboard', serviceDashboard);
router.get('/export/csv', exportVehiclesCSV);
router.get('/', listVehicles);
router.post('/import', requireServiceWrite, importVehicles);
router.post('/', requireServiceWrite, createVehicle);
router.get('/:id/services', listServicesForVehicle);
router.put('/:id/services/:svcId', requireServiceWrite, upsertService);
router.patch('/:id/pdi', requireServiceWrite, updatePdi);
router.patch('/:id/current-km', requireServiceWrite, patchCurrentKm);
router.get('/:id', getVehicle);
router.put('/:id', requireServiceWrite, updateVehicle);
router.delete('/:id', requireServiceWrite, deleteVehicle);

export default router;
