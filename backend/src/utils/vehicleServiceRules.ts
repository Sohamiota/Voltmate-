export const DEFAULT_KM_INTERVAL = 3000;
export const DEFAULT_DAYS_INTERVAL = 90;
export const DUE_SOON_DAYS = 7;
export const DUE_SOON_KM = 500;
export const STALE_KM_DAYS = 30;
export const PDI_DUE_DAYS = 7;

export type Urgency = 'overdue' | 'due_soon' | 'ok';

export type AlertType =
  | 'overdue'
  | 'due_soon'
  | 'due_today'
  | 'km_overdue'
  | 'stale_odometer'
  | 'pdi_pending';

export function urgency(
  currentKm: number,
  dueKm: number | null,
  dueDate: string | null,
): Urgency {
  const today = new Date().toISOString().slice(0, 10);
  const overdueByDate = dueDate && dueDate < today;
  const overdueByKm = dueKm != null && currentKm >= dueKm;
  if (overdueByDate || overdueByKm) return 'overdue';

  const dueDateObj = dueDate ? new Date(dueDate) : null;
  const daysLeft = dueDateObj
    ? Math.ceil((dueDateObj.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : 9999;
  const kmLeft = dueKm != null ? dueKm - currentKm : 9999;
  if (daysLeft <= DUE_SOON_DAYS || kmLeft <= DUE_SOON_KM) return 'due_soon';
  return 'ok';
}

export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate === new Date().toISOString().slice(0, 10);
}

export function isDueThisWeek(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  const inSevenDays = new Date();
  inSevenDays.setDate(inSevenDays.getDate() + DUE_SOON_DAYS);
  const sevenDaysStr = inSevenDays.toISOString().slice(0, 10);
  return dueDate >= today && dueDate <= sevenDaysStr;
}

export function isStaleOdometer(kmUpdatedAt: string | Date | null | undefined): boolean {
  if (!kmUpdatedAt) return true;
  const updated = new Date(kmUpdatedAt);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_KM_DAYS);
  return updated < cutoff;
}

export const DEFAULT_PDI_CHECKLIST = [
  { id: 'battery', label: 'Battery & BMS check', status: 'pending' as const },
  { id: 'charger', label: 'Charger & cable', status: 'pending' as const },
  { id: 'documents', label: 'Documents & RC', status: 'pending' as const },
  { id: 'cosmetic', label: 'Cosmetic inspection', status: 'pending' as const },
];

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}
