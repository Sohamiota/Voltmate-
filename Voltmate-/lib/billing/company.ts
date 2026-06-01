import type { CompanyProfile } from './types';

export const DEFAULT_COMPANY: CompanyProfile = {
  name: 'Volt Wheels',
  branch: 'Durgapur',
  financialYear: '',
  tagline: 'Authorized Euler Motors Dealer',
  address: 'Benuban, Bamunara Durgapur-12',
  state: 'West Bengal',
  phone: '+91 XXXXXXXXXX',
  email: 'info@voltwheelsind.com',
  gstin: '',
  website: 'www.voltwheelsind.com',
  bank: {
    accountName: 'Volt Wheels',
    banker: 'State Bank of India, Durgapur',
    accountNumber: '44943252846',
    ifsc: 'SBIN0013124',
  },
};

/** Reverse-geocode via OpenStreetMap Nominatim (no API key). */
export async function resolveAddressFromCoords(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Voltmate-Billing/1.0' },
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (typeof j.display_name === 'string' && j.display_name.trim()) {
      return j.display_name.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/** Try browser GPS, then fall back to default. */
export async function detectCompanyAddress(
  onProgress?: (msg: string) => void,
): Promise<string> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return DEFAULT_COMPANY.address;
  }

  onProgress?.('Detecting location…');

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const addr = await resolveAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
        resolve(addr || DEFAULT_COMPANY.address);
      },
      () => resolve(DEFAULT_COMPANY.address),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  });
}
