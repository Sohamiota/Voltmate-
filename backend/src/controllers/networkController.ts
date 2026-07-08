import { Request, Response } from 'express';
import { query } from '../db';
import {
  getClientIp,
  isIpAllowed,
  isPrivateOrLocalIp,
  isValidCidr,
  normalizeCidr,
  officeNetworkHint,
} from '../utils/network';
import { optPlainText } from '../utils/validate';

function isAdmin(req: Request): boolean {
  const role = (req as any).user?.role;
  return role === 'admin' || role === 'attendance_admin';
}

/**
 * GET /api/v1/networks/status
 * Any authenticated user. Returns whether their current IP is on an allowed office network.
 */
export async function checkNetworkStatus(req: Request, res: Response) {
  try {
    const ip = getClientIp(req);
    let rows: Array<{ label: string; ip_cidr: string }> = [];

    try {
      const r = await query(
        'SELECT label, ip_cidr FROM allowed_networks WHERE is_active = true',
        [],
      );
      rows = (r as any).rows;
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (/relation.*allowed_networks.*does not exist/i.test(msg)) {
        // Table not yet created — return open-mode response, same as empty table
        return res.json({ allowed: true, label: 'No restriction', ip, no_network_rules: true });
      }
      throw dbErr;
    }

    if (rows.length === 0) {
      // No active networks configured — open mode, all IPs allowed
      return res.json({ allowed: true, label: 'No restriction', ip, no_network_rules: true, hint: null });
    }

    const { allowed, label } = isIpAllowed(ip, rows);
    const hint = officeNetworkHint(ip, allowed, true);
    return res.json({ allowed, label, ip, no_network_rules: false, hint });
  } catch (e) {
    console.error('[checkNetworkStatus]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * GET /api/v1/networks
 * Admin only. Returns all configured networks.
 */
export async function listNetworks(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'forbidden' });
    const r = await query(
      'SELECT id, label, ip_cidr, is_active, created_at FROM allowed_networks ORDER BY created_at DESC',
      [],
    );
    res.json({ networks: (r as any).rows });
  } catch (e) {
    console.error('[listNetworks]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * POST /api/v1/networks
 * Admin only. Body: { label: string, ip_cidr: string }
 */
export async function addNetwork(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'forbidden' });

    const vLabel = optPlainText(req.body?.label, 'note', 100);
    const vCidr  = optPlainText(req.body?.ip_cidr, 'identifier', 50);

    if (vLabel.error || !vLabel.value)
      return res.status(400).json({ error: 'label is required (max 100 chars)' });
    if (vCidr.error || !vCidr.value)
      return res.status(400).json({ error: 'ip_cidr is required (e.g. 203.0.113.0/24 or 203.0.113.5/32)' });

    // Validate CIDR format — constructor throws on invalid input
    if (!isValidCidr(vCidr.value))
      return res.status(400).json({ error: `ip_cidr "${vCidr.value}" is not a valid CIDR address` });

    const normalizedCidr = normalizeCidr(vCidr.value);

    // Private LAN ranges (192.168.x.x etc.) are never sent to the server from a
    // browser — whitelist the office's public internet IP instead.
    const probeIp = normalizedCidr.split('/')[0];
    if (isPrivateOrLocalIp(probeIp)) {
      return res.status(400).json({
        error: 'private_ip_not_usable',
        message:
          'Private LAN IPs (192.168.x.x, 10.x.x.x) cannot be detected from the web app. ' +
          'Add your office public internet IP instead (check Attendance page while on office WiFi).',
      });
    }

    const r = await query(
      'INSERT INTO allowed_networks (label, ip_cidr) VALUES ($1, $2) RETURNING *',
      [vLabel.value, normalizedCidr],
    );
    res.status(201).json((r as any).rows[0]);
  } catch (e) {
    console.error('[addNetwork]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * DELETE /api/v1/networks/:id
 * Admin only. Hard-deletes the network entry.
 */
export async function deleteNetwork(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'forbidden' });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });

    const r = await query('DELETE FROM allowed_networks WHERE id=$1 RETURNING id', [id]);
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('[deleteNetwork]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * PATCH /api/v1/networks/:id/toggle
 * Admin only. Toggles is_active on a network entry.
 */
export async function toggleNetwork(req: Request, res: Response) {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'forbidden' });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });

    const r = await query(
      'UPDATE allowed_networks SET is_active = NOT is_active WHERE id=$1 RETURNING *',
      [id],
    );
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error('[toggleNetwork]', e);
    res.status(500).json({ error: 'failed' });
  }
}
