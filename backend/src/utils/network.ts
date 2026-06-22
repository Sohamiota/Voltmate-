import { Request } from 'express';
// ip-cidr is a CommonJS/ESM hybrid; use the default export
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IPCIDR = require('ip-cidr').default as new (cidr: string) => { contains: (ip: string) => boolean };

/** Strip IPv4-mapped prefix, port suffix, and whitespace. */
export function normalizeIp(raw: string | undefined | null): string {
  if (!raw) return '';
  let ip = String(raw).trim();
  if (!ip) return '';

  // IPv4-mapped IPv6, e.g. ::ffff:203.0.113.5
  ip = ip.replace(/^::ffff:/i, '');

  // Bracketed IPv6 with optional port, e.g. [2001:db8::1]:443
  const bracket = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket) return bracket[1].trim();

  // Plain IPv4 with port, e.g. 203.0.113.5:443
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) {
    return ip.split(':')[0];
  }

  return ip;
}

/** RFC1918 + loopback — never visible to the server from browser/API calls. */
export function isPrivateOrLocalIp(ip: string): boolean {
  const n = normalizeIp(ip);
  if (!n) return false;
  if (n === '127.0.0.1' || n === '::1' || n === 'localhost') return true;
  if (/^10\./.test(n)) return true;
  if (/^192\.168\./.test(n)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(n)) return true;
  if (/^169\.254\./.test(n)) return true;
  return false;
}

/**
 * Extract the real client IP from a request.
 *
 * On Render the app sits behind Cloudflare + Render load balancers. The socket
 * address is often an internal/proxy IP. Prefer Cloudflare's trusted headers,
 * then Express req.ip (requires trust proxy), then X-Forwarded-For leftmost.
 */
export function getClientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) {
    const ip = normalizeIp(cf);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }

  const trueClient = req.headers['true-client-ip'];
  if (typeof trueClient === 'string' && trueClient.trim()) {
    const ip = normalizeIp(trueClient);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    const ip = normalizeIp(realIp);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }

  // Express resolves client IP when trust proxy is configured
  if (req.ip) {
    const ip = normalizeIp(req.ip);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const chain = (typeof forwarded === 'string' ? forwarded : forwarded[0])
      .split(',')
      .map(s => normalizeIp(s))
      .filter(Boolean);
    // Leftmost = original client (Render documents this)
    for (const ip of chain) {
      if (!isPrivateOrLocalIp(ip)) return ip;
    }
    if (chain.length > 0) return chain[0];
  }

  return normalizeIp(req.socket?.remoteAddress || '');
}

/** Ensure CIDR notation; bare IPv4/IPv6 becomes /32 or /128. */
export function normalizeCidr(cidr: string): string {
  const trimmed = cidr.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('/')) return trimmed;
  if (trimmed.includes(':')) return `${trimmed}/128`;
  return `${trimmed}/32`;
}

/**
 * Check whether `ip` falls within any of the active CIDR ranges.
 * Single IP addresses should be stored as "x.x.x.x/32" (auto-normalized).
 */
export function isIpAllowed(
  ip: string,
  rows: Array<{ ip_cidr: string; label: string }>,
): { allowed: boolean; label: string | null } {
  const clientIp = normalizeIp(ip);
  if (!clientIp) return { allowed: false, label: null };

  for (const row of rows) {
    const cidrStr = normalizeCidr(row.ip_cidr);
    try {
      const cidr = new IPCIDR(cidrStr);
      if (cidr.contains(clientIp)) {
        return { allowed: true, label: row.label };
      }
    } catch {
      // Fallback: exact match when stored without valid CIDR
      if (normalizeIp(row.ip_cidr) === clientIp) {
        return { allowed: true, label: row.label };
      }
    }
  }
  return { allowed: false, label: null };
}

/** Validate a CIDR string by attempting to construct an IPCIDR instance. */
export function isValidCidr(cidr: string): boolean {
  try {
    new IPCIDR(normalizeCidr(cidr));
    return true;
  } catch {
    return false;
  }
}

/** Human-readable hint for admins when web attendance shows "outside network". */
export function officeNetworkHint(
  clientIp: string,
  allowed: boolean,
  hasRules: boolean,
): string | null {
  if (!hasRules || allowed || !clientIp) return null;
  if (isPrivateOrLocalIp(clientIp)) {
    return 'Server could not read your public IP. Try again or contact IT.';
  }
  return `Your public IP is ${clientIp}. Ask admin to add ${clientIp}/32 under Allowed Networks (use the office internet public IP, not 192.168.x.x).`;
}
