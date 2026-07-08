export const FREE_SERVICE_KM_GRACE = 500;
export const DUE_SOON_DAYS = 7;
export const DUE_SOON_KM = 500;
export const STALE_KM_DAYS = 30;
export const PDI_DUE_DAYS = 7;

/** @deprecated Use computeInitialServiceDue / computeNextServiceDue instead */
export const DEFAULT_KM_INTERVAL = 10000;
/** @deprecated Use computeInitialServiceDue / computeNextServiceDue instead */
export const DEFAULT_DAYS_INTERVAL = 180;

export type VehicleLine = 'storm' | 'turbo' | 'neo' | 'hiload_hicity';

export type Urgency = 'overdue' | 'due_soon' | 'ok';

export type AlertType =
  | 'overdue'
  | 'due_soon'
  | 'due_today'
  | 'km_overdue'
  | 'stale_odometer'
  | 'pdi_pending';

export interface ServiceMilestone {
  serviceNo: number;
  /** Odometer reading (km) — cumulative from delivery */
  kmTarget: number;
  /** Months from purchase / delivery date */
  monthsFromPurchase: number;
  isFree: boolean;
}

export interface RecurringService {
  kmInterval: number;
  monthsInterval: number;
}

const STORM_TURBO_MILESTONES: ServiceMilestone[] = [
  { serviceNo: 1, kmTarget: 3000, monthsFromPurchase: 2, isFree: true },
  { serviceNo: 2, kmTarget: 10000, monthsFromPurchase: 6, isFree: true },
  { serviceNo: 3, kmTarget: 20000, monthsFromPurchase: 12, isFree: true },
];

const HILOAD_HICITY_MILESTONES: ServiceMilestone[] = [
  { serviceNo: 1, kmTarget: 2000, monthsFromPurchase: 2, isFree: true },
  { serviceNo: 2, kmTarget: 10000, monthsFromPurchase: 12, isFree: true },
];

const NEO_MILESTONES: ServiceMilestone[] = [
  { serviceNo: 1, kmTarget: 1000, monthsFromPurchase: 1, isFree: true },
  { serviceNo: 2, kmTarget: 5000, monthsFromPurchase: 2, isFree: true },
  { serviceNo: 3, kmTarget: 10000, monthsFromPurchase: 3, isFree: true },
  { serviceNo: 4, kmTarget: 15000, monthsFromPurchase: 4, isFree: true },
  { serviceNo: 5, kmTarget: 20000, monthsFromPurchase: 5, isFree: true },
  { serviceNo: 6, kmTarget: 30000, monthsFromPurchase: 7, isFree: true },
  { serviceNo: 7, kmTarget: 40000, monthsFromPurchase: 9, isFree: true },
  { serviceNo: 8, kmTarget: 50000, monthsFromPurchase: 11, isFree: true },
];

const RECURRING: Record<VehicleLine, RecurringService> = {
  storm: { kmInterval: 10000, monthsInterval: 6 },
  turbo: { kmInterval: 10000, monthsInterval: 6 },
  neo: { kmInterval: 10000, monthsInterval: 3 },
  hiload_hicity: { kmInterval: 10000, monthsInterval: 12 },
};

const LINE_LABELS: Record<VehicleLine, string> = {
  storm: 'Storm',
  turbo: 'Turbo',
  neo: 'Neo',
  hiload_hicity: 'HiLoad / HiCity',
};

/** Detect Euler service line from vehicle type / model name. */
export function resolveVehicleLine(vehicleType: string | null | undefined): VehicleLine {
  const t = (vehicleType || '').toLowerCase().replace(/\s+/g, ' ');
  if (/hiload|hi load|hicity|hi city|hi-city/.test(t)) return 'hiload_hicity';
  if (/neo|hirange|hi range|hi-range/.test(t)) return 'neo';
  if (/storm/.test(t)) return 'storm';
  if (/turbo|maxx|fastcharge|fast charge|city fb|city pv|city hd|city dv/.test(t)) return 'turbo';
  return 'storm';
}

export function getVehicleLineLabel(line: VehicleLine): string {
  return LINE_LABELS[line];
}

export function getServiceMilestones(line: VehicleLine): ServiceMilestone[] {
  if (line === 'neo') return NEO_MILESTONES;
  if (line === 'hiload_hicity') return HILOAD_HICITY_MILESTONES;
  return STORM_TURBO_MILESTONES;
}

export function getRecurringService(line: VehicleLine): RecurringService {
  return RECURRING[line];
}

export function isFreeService(line: VehicleLine, serviceNo: number): boolean {
  return getServiceMilestones(line).some(m => m.serviceNo === serviceNo && m.isFree);
}

/** Free services allow up to 500 km over the due KM target (Euler policy). */
export function isWithinFreeServiceGrace(dueKm: number | null, actualKm: number): boolean {
  if (dueKm == null) return false;
  return actualKm <= dueKm + FREE_SERVICE_KM_GRACE;
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function milestoneDue(
  milestone: ServiceMilestone,
  purchaseDate: string | null,
  purchaseKm: number,
): { due_km: number; due_date: string | null; is_free: boolean } {
  const due_km = Math.max(milestone.kmTarget, purchaseKm);
  const due_date = purchaseDate ? addMonths(purchaseDate, milestone.monthsFromPurchase) : null;
  return { due_km, due_date, is_free: milestone.isFree };
}

/** First pending service when a vehicle is registered. */
export function computeInitialServiceDue(
  vehicleType: string | null | undefined,
  purchaseDate: string | null,
  purchaseKm: number,
): { due_km: number; due_date: string | null; is_free: boolean } {
  const line = resolveVehicleLine(vehicleType);
  const first = getServiceMilestones(line)[0];
  if (!first) {
    const rec = getRecurringService(line);
    return {
      due_km: purchaseKm + rec.kmInterval,
      due_date: purchaseDate ? addMonths(purchaseDate, rec.monthsInterval) : null,
      is_free: false,
    };
  }
  return milestoneDue(first, purchaseDate, purchaseKm);
}

/** Due dates/KM for a fixed milestone (from purchase) or recurring (from last completion). */
export function computeNextServiceDue(
  vehicleType: string | null | undefined,
  completedServiceNo: number,
  purchaseDate: string | null,
  purchaseKm: number,
  completionDate: string,
  completionKm: number,
): { serviceNo: number; due_km: number; due_date: string | null; is_free: boolean } {
  const line = resolveVehicleLine(vehicleType);
  const nextNo = completedServiceNo + 1;
  const milestone = getServiceMilestones(line).find(m => m.serviceNo === nextNo);

  if (milestone) {
    const due = milestoneDue(milestone, purchaseDate, purchaseKm);
    return { serviceNo: nextNo, ...due };
  }

  const rec = getRecurringService(line);
  return {
    serviceNo: nextNo,
    due_km: completionKm + rec.kmInterval,
    due_date: addMonths(completionDate, rec.monthsInterval),
    is_free: false,
  };
}

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
