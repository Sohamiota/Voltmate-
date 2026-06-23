import { format, parse, isValid, subDays, subMonths } from 'date-fns';

/** Parse YYYY-MM-DD as local date. */
export function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}

/** Format a Date as YYYY-MM-DD in local time (avoids UTC drift from toISOString). */
export function dateToIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayIso(): string {
  return dateToIso(new Date());
}

/** Local date N days before today as YYYY-MM-DD. */
export function daysAgoIso(days: number): string {
  return dateToIso(subDays(new Date(), days));
}

/** Local date N months before today as YYYY-MM-DD. */
export function monthsAgoIso(months: number): string {
  return dateToIso(subMonths(new Date(), months));
}

/** Display as dd-MM-yyyy (matches filter bar placeholder). */
export function formatDateDisplay(iso: string): string {
  const d = isoToDate(iso);
  if (!d) return '';
  return format(d, 'dd-MM-yyyy');
}

export function startOfLocalDay(iso: string): Date | undefined {
  const d = isoToDate(iso);
  if (!d) return undefined;
  d.setHours(0, 0, 0, 0);
  return d;
}
