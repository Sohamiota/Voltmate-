export type VehicleLine = 'storm' | 'turbo' | 'neo' | 'hiload_hicity';

export interface ServiceMilestone {
  serviceNo: number;
  kmTarget: number;
  monthsFromPurchase: number;
  isFree: boolean;
}

export interface RecurringService {
  kmInterval: number;
  monthsInterval: number;
  label: string;
}

export const FREE_SERVICE_KM_GRACE = 500;

export const SERVICE_SCHEDULES: Record<
  VehicleLine,
  { label: string; milestones: ServiceMilestone[]; recurring: RecurringService }
> = {
  storm: {
    label: 'Storm',
    milestones: [
      { serviceNo: 1, kmTarget: 3000, monthsFromPurchase: 2, isFree: true },
      { serviceNo: 2, kmTarget: 10000, monthsFromPurchase: 6, isFree: true },
      { serviceNo: 3, kmTarget: 20000, monthsFromPurchase: 12, isFree: true },
    ],
    recurring: { kmInterval: 10000, monthsInterval: 6, label: 'Every 10,000 km or 6 months' },
  },
  turbo: {
    label: 'Turbo',
    milestones: [
      { serviceNo: 1, kmTarget: 3000, monthsFromPurchase: 2, isFree: true },
      { serviceNo: 2, kmTarget: 10000, monthsFromPurchase: 6, isFree: true },
      { serviceNo: 3, kmTarget: 20000, monthsFromPurchase: 12, isFree: true },
    ],
    recurring: { kmInterval: 10000, monthsInterval: 6, label: 'Every 10,000 km or 6 months' },
  },
  hiload_hicity: {
    label: 'HiLoad / HiCity',
    milestones: [
      { serviceNo: 1, kmTarget: 2000, monthsFromPurchase: 2, isFree: true },
      { serviceNo: 2, kmTarget: 10000, monthsFromPurchase: 12, isFree: true },
    ],
    recurring: { kmInterval: 10000, monthsInterval: 12, label: 'Every 10,000 km or 12 months' },
  },
  neo: {
    label: 'Neo',
    milestones: [
      { serviceNo: 1, kmTarget: 1000, monthsFromPurchase: 1, isFree: true },
      { serviceNo: 2, kmTarget: 5000, monthsFromPurchase: 2, isFree: true },
      { serviceNo: 3, kmTarget: 10000, monthsFromPurchase: 3, isFree: true },
      { serviceNo: 4, kmTarget: 15000, monthsFromPurchase: 4, isFree: true },
      { serviceNo: 5, kmTarget: 20000, monthsFromPurchase: 5, isFree: true },
      { serviceNo: 6, kmTarget: 30000, monthsFromPurchase: 7, isFree: true },
      { serviceNo: 7, kmTarget: 40000, monthsFromPurchase: 9, isFree: true },
      { serviceNo: 8, kmTarget: 50000, monthsFromPurchase: 11, isFree: true },
    ],
    recurring: { kmInterval: 10000, monthsInterval: 3, label: 'Every 10,000 km or 3 months' },
  },
};

export function resolveVehicleLine(vehicleType: string | null | undefined): VehicleLine {
  const t = (vehicleType || '').toLowerCase().replace(/\s+/g, ' ');
  if (/hiload|hi load|hicity|hi city|hi-city/.test(t)) return 'hiload_hicity';
  if (/neo|hirange|hi range|hi-range/.test(t)) return 'neo';
  if (/storm/.test(t)) return 'storm';
  if (/turbo|maxx|fastcharge|fast charge|city fb|city pv|city hd|city dv/.test(t)) return 'turbo';
  return 'storm';
}

export function formatMilestone(m: ServiceMilestone): string {
  return `${m.kmTarget.toLocaleString('en-IN')} km or ${m.monthsFromPurchase} mo`;
}
