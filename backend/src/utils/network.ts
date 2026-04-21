import { Request } from 'express';
// ip-cidr is a CommonJS/ESM hybrid; use the default export
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IPCIDR = require('ip-cidr').default as new (cidr: string) => { contains: (ip: string) => boolean };

/**
 * Extract the real client IP from a request.
 * Respects the X-Forwarded-For header when trust proxy is enabled (set in app.ts).
 * Strips the IPv4-mapped IPv6 prefix (::ffff:) so comparisons are consistent.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  let ip: string;
  if (forwarded) {
    // X-Forwarded-For may be a comma-separated list; the first entry is the client
    ip = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  } else {
    ip = req.socket?.remoteAddress || req.ip || '';
  }
  // Strip IPv4-mapped IPv6 prefix
  return ip.replace(/^::ffff:/, '');
}

/**
 * Check whether `ip` falls within any of the active CIDR ranges.
 * Each row must have an `ip_cidr` string field (e.g. "192.168.1.0/24").
 * Single IP addresses should be stored as "x.x.x.x/32".
 * Construction of IPCIDR throws on invalid CIDR — we catch and skip those.
 */
export function isIpAllowed(
  ip: string,
  rows: Array<{ ip_cidr: string; label: string }>,
): { allowed: boolean; label: string | null } {
  for (const row of rows) {
    try {
      const cidr = new IPCIDR(row.ip_cidr);
      if (cidr.contains(ip)) {
        return { allowed: true, label: row.label };
      }
    } catch {
      // Skip malformed entries
    }
  }
  return { allowed: false, label: null };
}

/**
 * Validate a CIDR string by attempting to construct an IPCIDR instance.
 * Returns true if valid, false otherwise.
 */
export function isValidCidr(cidr: string): boolean {
  try {
    new IPCIDR(cidr);
    return true;
  } catch {
    return false;
  }
}
