/** Official Euler / Neo vehicle images downloaded from eulermotors.com & neo.eulermotors.com */
export type EulerVehicle = {
  id: string;
  name: string;
  image: string;
  category: 'Commercial' | 'Passenger';
  tagline?: string;
  /** Extra names for quotation / CRM matching */
  aliases?: string[];
};

export const EULER_VEHICLES: EulerVehicle[] = [
  // ── Commercial (eulermotors.com) ──
  {
    id: 'hiload-dv',
    name: 'Euler HiLoad EV — Delivery Van',
    image: '/vehicles/hiload-delivery-van.png',
    category: 'Commercial',
    tagline: '3-wheeler electric cargo · high payload',
    aliases: ['HiLoad EV', 'HiLoad Delivery Van', 'Highload DV'],
  },
  {
    id: 'hiload-pv',
    name: 'Euler HiLoad EV — Pickup Van',
    image: '/vehicles/hiload-pickup-van.png',
    category: 'Commercial',
    tagline: 'Versatile pickup body for last-mile',
    aliases: ['HiLoad Pickup Van', 'Highload PV'],
  },
  {
    id: 'hiload-ev',
    name: 'Euler HiLoad EV',
    image: '/vehicles/hiload-ev.png',
    category: 'Commercial',
    tagline: 'India’s highest payload 3W electric cargo',
    aliases: ['HiLoad', 'Euler HiLoad'],
  },
  {
    id: 'turbo-ev',
    name: 'Euler Turbo EV 1000',
    image: '/vehicles/turbo-ev.jpg',
    category: 'Commercial',
    tagline: '4-wheel electric loader',
    aliases: ['Turbo EV', 'Turbo EV 1000', 'Euler Turbo'],
  },
  {
    id: 'storm-t1500',
    name: 'Euler Storm EV T1500',
    image: '/vehicles/storm-t1500.png',
    category: 'Commercial',
    tagline: '1.5-ton electric pickup · Storm T1500',
    aliases: [
      'Storm EV T1500',
      'Storm T1500',
      'STORM T1500',
      'STORM T1500 PV',
      'Storm T1500 PV',
      'Storm T1500 TR PV',
    ],
  },
  {
    id: 'storm-lr200',
    name: 'Euler Storm EV LongRange 200',
    image: '/vehicles/storm-ev-lr200.webp',
    category: 'Commercial',
    tagline: 'Extended range commercial EV',
    aliases: ['Storm EV LongRange 200', 'Storm LR200', 'Storm EV LR200'],
  },
  // ── Passenger (neo.eulermotors.com) ──
  {
    id: 'neo-hirange',
    name: 'Euler NEO HiRANGE',
    image: '/vehicles/neo-hirange.webp',
    category: 'Passenger',
    tagline: '200+ km RealRange™ · D+3 seating',
    aliases: ['NEO HiRANGE', 'HiRANGE', 'Neo HiRange'],
  },
  {
    id: 'neo-hirange-plus',
    name: 'Euler NEO HiRANGE PLUS',
    image: '/vehicles/neo-hirange-plus.webp',
    category: 'Passenger',
    tagline: 'Enhanced HiRANGE with extended comfort',
    aliases: ['NEO HiRANGE PLUS', 'HiRANGE PLUS', 'HiRange Plus'],
  },
  {
    id: 'neo-hirange-maxx',
    name: 'Euler NEO HiRANGE MAXX',
    image: '/vehicles/neo-hirange-maxx.webp',
    category: 'Passenger',
    tagline: 'Top-spec HiRANGE · maximum range & features',
    aliases: ['NEO HiRANGE MAXX', 'HiRANGE MAXX', 'HiRange Maxx'],
  },
  {
    id: 'neo-hicity',
    name: 'Euler NEO HiCITY',
    image: '/vehicles/neo-hicity.webp',
    category: 'Passenger',
    tagline: 'City-ready passenger EV · 150+ km range',
    aliases: ['NEO HiCITY', 'HiCITY', 'Neo HiCity'],
  },
  {
    id: 'neo-hicity-maxx',
    name: 'Euler NEO HiCITY MAXX',
    image: '/vehicles/neo-hicity-maxx.webp',
    category: 'Passenger',
    tagline: 'Premium HiCITY · extra space & range',
    aliases: ['NEO HiCITY MAXX', 'HiCITY MAXX', 'HiCity Maxx'],
  },
];

export const EULER_VEHICLE_NAMES = EULER_VEHICLES.map(v => v.name);

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function vehicleByName(name: string): EulerVehicle | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return EULER_VEHICLES.find(
    v => norm(v.name) === n || (v.aliases ?? []).some(a => norm(a) === n),
  );
}

/** Match catalog entry from model name or line-item text (exact, alias, then partial). */
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
      const names = [v.name, ...(v.aliases ?? [])].map(norm);
      return names.some(vn => vn.includes(n) || n.includes(vn));
    });
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
      const best = partial.find(v => {
        const vn = norm(v.name);
        return vn.startsWith(n) || n.startsWith(vn);
      });
      if (best) return best;
      // Prefer longest name match (e.g. "STORM T1500 PV" → Storm T1500 not LR200)
      partial.sort((a, b) => norm(b.name).length - norm(a.name).length);
      const longest = partial.find(v =>
        [v.name, ...(v.aliases ?? [])].some(a => norm(text).includes(norm(a))),
      );
      if (longest) return longest;
    }
  }

  return undefined;
}

export const BRAND_LOGO_DARK = '/branding/euler-logo-black.png';
export const BRAND_LOGO_LIGHT = '/branding/euler-logo-white.png';
export const VOLTWHEELS_LOGO = '/voltwheels-logo.png';
