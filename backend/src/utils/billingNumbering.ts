/** Indian financial year parts (Apr–Mar), e.g. [26, 27] for Jun 2026. */
export function financialYearParts(dateIso: string): [number, number] {
  const d = new Date(`${dateIso}T00:00:00`);
  const month = d.getMonth();
  const year = d.getFullYear();
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return [fyStart % 100, fyEnd % 100];
}

export function formatReceiptNo(fyStart: number, fyEnd: number, month: number, serial: number): string {
  const mm = String(month).padStart(2, '0');
  const seq = String(serial).padStart(2, '0');
  return `${fyStart}/${fyEnd}/${mm}-${seq}`;
}

export function formatQuoteNo(fyStart: number, fyEnd: number, month: number, serial: number): string {
  const mm = String(month).padStart(2, '0');
  const seq = String(serial).padStart(2, '0');
  return `VW-${fyStart}${fyEnd}-${mm}/${seq}`;
}
