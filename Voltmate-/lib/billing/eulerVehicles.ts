/** Official Euler / Neo vehicle images downloaded from eulermotors.com & neo.eulermotors.com */
export type EulerVehicle = {
  id: string;
  name: string;
  image: string;
  category: 'Commercial' | 'Passenger';
  tagline?: string;
};

export const EULER_VEHICLES: EulerVehicle[] = [
  {
    id: 'hiload-dv',
    name: 'Euler HiLoad EV — Delivery Van',
    image: '/vehicles/hiload-delivery-van.png',
    category: 'Commercial',
    tagline: '3-wheeler electric cargo · high payload',
  },
  {
    id: 'hiload-pv',
    name: 'Euler HiLoad EV — Pickup Van',
    image: '/vehicles/hiload-pickup-van.png',
    category: 'Commercial',
    tagline: 'Versatile pickup body for last-mile',
  },
  {
    id: 'turbo-ev',
    name: 'Euler Turbo EV 1000',
    image: '/vehicles/turbo-ev.jpg',
    category: 'Commercial',
    tagline: '4-wheel electric loader',
  },
  {
    id: 'storm-lr200',
    name: 'Euler Storm EV LongRange 200',
    image: '/vehicles/storm-ev-lr200.webp',
    category: 'Commercial',
    tagline: 'Extended range commercial EV',
  },
  {
    id: 'neo-hirange',
    name: 'Euler NEO HiRANGE',
    image: '/vehicles/neo-hirange.webp',
    category: 'Passenger',
    tagline: '200+ km RealRange™ · D+3 seating',
  },
  {
    id: 'neo-hicity',
    name: 'Euler NEO HiCITY',
    image: '/vehicles/neo-hicity.webp',
    category: 'Passenger',
    tagline: 'City-ready passenger EV',
  },
  {
    id: 'variant-1',
    name: 'Euler HiLoad — Variant',
    image: '/vehicles/euler-variant-1.png',
    category: 'Commercial',
  },
  {
    id: 'variant-2',
    name: 'Euler Commercial — Variant',
    image: '/vehicles/euler-variant-2.png',
    category: 'Commercial',
  },
  {
    id: 'variant-3',
    name: 'Euler Storm — Variant',
    image: '/vehicles/euler-variant-3.png',
    category: 'Commercial',
  },
];

export const EULER_VEHICLE_NAMES = EULER_VEHICLES.map(v => v.name);

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function vehicleByName(name: string): EulerVehicle | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return EULER_VEHICLES.find(v => norm(v.name) === n);
}

/** Match catalog entry from model name or line-item text (exact, then partial). */
export function resolveQuoteVehicle(
  vehicleModel?: string,
  itemDescriptions: string[] = [],
): EulerVehicle | undefined {
  const candidates = [vehicleModel, ...itemDescriptions].filter(Boolean) as string[];

  for (const text of candidates) {
    const exact = vehicleByName(text);
    if (exact) return exact;
  }

  for (const text of candidates) {
    const n = norm(text);
    const partial = EULER_VEHICLES.filter(v => {
      const vn = norm(v.name);
      return vn.includes(n) || n.includes(vn);
    });
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
      const best = partial.find(v => norm(v.name).startsWith(n) || n.startsWith(norm(v.name)));
      if (best) return best;
    }
  }

  return undefined;
}

export const BRAND_LOGO_DARK = '/branding/euler-logo-black.png';
export const BRAND_LOGO_LIGHT = '/branding/euler-logo-white.png';
export const VOLTWHEELS_LOGO = '/voltwheels-logo.png';
