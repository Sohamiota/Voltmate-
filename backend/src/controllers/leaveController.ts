import { Request, Response } from 'express';
import { query } from '../db';
import {
  applyLeave,
  approveLeaveRequest,
  cancelLeaveRequest,
  canManageLeave,
  getLeaveBalance,
  getLeaveProofMeta,
  listHolidays,
  listLeaveRequests,
  minClStartDateIso,
  requiresMedicalProof,
  uploadLeaveProof,
  type LeaveType,
} from '../services/leaveService';
import { readProofFile, type ProofPayload } from '../utils/leaveProof';
import { optDate, optId, optStr } from '../utils/validate';

function parseProof(body: Record<string, unknown>): ProofPayload | undefined {
  const p = body.proof as Record<string, unknown> | undefined;
  if (!p) return undefined;
  const filename = String(p.filename || '').trim();
  const mime_type = String(p.mime_type || p.mimeType || '').trim();
  const data_base64 = String(p.data_base64 || p.dataBase64 || '').trim();
  if (!filename && !data_base64) return undefined;
  return { filename, mime_type, data_base64 };
}

export async function getBalance(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const targetId = optId(req.query.userId);
    if (targetId.value && targetId.value !== userId) {
      if (!canManageLeave((req as any).user?.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const balance = await getLeaveBalance(targetId.value || userId);
    res.json({ balance });
  } catch (e) {
    console.error('[leave balance]', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function getHolidays(req: Request, res: Response) {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const holidays = await listHolidays(Number.isFinite(year) ? year : undefined);
    res.json({ holidays });
  } catch (e) {
    console.error('[leave holidays]', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function createLeaveRequest(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const body = req.body || {};
    const leaveType = String(body.leave_type || '').toUpperCase();
    if (leaveType !== 'CL' && leaveType !== 'SL') {
      return res.status(400).json({ error: 'leave_type must be CL or SL' });
    }

    const start = optDate(body.start_date);
    const end = optDate(body.end_date);
    const reason = optStr(body.reason, 1000);
    if (start.error) return res.status(400).json({ error: `start_date: ${start.error}` });
    if (end.error) return res.status(400).json({ error: `end_date: ${end.error}` });
    if (reason.error) return res.status(400).json({ error: `reason: ${reason.error}` });
    if (!start.value || !end.value) return res.status(400).json({ error: 'dates required' });

    const proof = parseProof(body);

    const row = await applyLeave(
      userId,
      leaveType as LeaveType,
      start.value,
      end.value,
      reason.value ?? undefined,
      proof,
    );
    res.status(201).json({
      request: row,
      proof: getLeaveProofMeta(row),
      message: row.requires_proof && !row.proof_path
        ? 'Leave submitted. Upload medical proof before admin can approve.'
        : undefined,
    });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.startsWith('probation_active')) {
      return res.status(403).json({ error: 'probation_active', message: msg.split(': ')[1] });
    }
    if (msg.startsWith('cl_advance_required')) {
      return res.status(400).json({ error: 'cl_advance_required', message: msg.split(': ')[1] });
    }
    if (msg.startsWith('proof_invalid') || msg.startsWith('proof_too_large')) {
      return res.status(400).json({ error: msg.split(':')[0], message: msg.split(': ')[1] });
    }
    if (msg.startsWith('insufficient_balance')) {
      return res.status(400).json({ error: 'insufficient_balance', message: msg.split(': ')[1] });
    }
    if (msg.startsWith('no_working_days') || msg.startsWith('attendance_conflict') || msg.startsWith('leave_overlap')) {
      return res.status(400).json({ error: msg.split(':')[0], message: msg.split(': ')[1] });
    }
    console.error('[leave apply]', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listRequests(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    const role = (req as any).user?.role;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const isAdmin = canManageLeave(role);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const rows = await listLeaveRequests({
      userId: isAdmin ? undefined : userId,
      status,
      limit,
    });
    res.json({ requests: rows });
  } catch (e) {
    console.error('[leave list]', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function adminApproveLeave(req: Request, res: Response) {
  try {
    const approverId = (req as any).user?.sub;
    const role = (req as any).user?.role;
    if (!canManageLeave(role)) return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

    const approve = req.body?.approve !== false;
    const note = optStr(req.body?.note, 500);
    if (note.error) return res.status(400).json({ error: `note: ${note.error}` });

    const row = await approveLeaveRequest(id, approverId, approve, note.value ?? undefined);
    res.json({ request: row });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (msg === 'already_processed') return res.status(409).json({ error: 'already_processed' });
    if (msg.startsWith('insufficient_balance')) {
      return res.status(400).json({ error: 'insufficient_balance', message: msg.split(': ')[1] });
    }
    if (msg.startsWith('proof_required')) {
      return res.status(400).json({ error: 'proof_required', message: msg.split(': ')[1] });
    }
    console.error('[leave approve]', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function cancelRequest(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

    const row = await cancelLeaveRequest(userId, id);
    res.json({ request: row });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (msg === 'cannot_cancel') return res.status(409).json({ error: 'cannot_cancel' });
    console.error('[leave cancel]', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function previewWorkingDays(req: Request, res: Response) {
  try {
    const start = optDate(req.query.start_date);
    const end = optDate(req.query.end_date);
    if (start.error || end.error || !start.value || !end.value) {
      return res.status(400).json({ error: 'start_date and end_date required' });
    }
    const { countWorkingDays } = await import('../services/leaveService');
    const days = await countWorkingDays(start.value, end.value);
    const leaveType = String(req.query.leave_type || '').toUpperCase();
    res.json({
      days,
      requires_proof: leaveType === 'SL' ? requiresMedicalProof('SL', days) : false,
      min_cl_start: minClStartDateIso(),
    });
  } catch (e) {
    console.error('[leave preview days]', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function uploadProof(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

    const proof = parseProof(req.body || {});
    if (!proof) return res.status(400).json({ error: 'proof required' });

    const row = await uploadLeaveProof(userId, id, proof);
    res.json({ request: row, proof: getLeaveProofMeta(row) });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (msg === 'cannot_upload_proof') return res.status(409).json({ error: 'cannot_upload_proof' });
    if (msg === 'proof_not_required') return res.status(400).json({ error: 'proof_not_required' });
    if (msg.startsWith('proof_invalid') || msg.startsWith('proof_too_large')) {
      return res.status(400).json({ error: msg.split(':')[0], message: msg.split(': ')[1] });
    }
    console.error('[leave upload proof]', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function downloadProof(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    const role = (req as any).user?.role;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

    const r0 = await queryRow(id);
    if (!r0) return res.status(404).json({ error: 'not_found' });

    const isOwner = r0.user_id === userId;
    if (!isOwner && !canManageLeave(role)) return res.status(403).json({ error: 'Forbidden' });
    if (!r0.proof_path) return res.status(404).json({ error: 'proof_not_found' });

    const file = readProofFile(r0.proof_path);
    res.setHeader('Content-Type', r0.proof_mime_type || file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${r0.proof_filename || file.filename}"`,
    );
    res.send(file.buf);
  } catch (e: any) {
    if (String(e?.message) === 'proof_not_found') {
      return res.status(404).json({ error: 'proof_not_found' });
    }
    console.error('[leave download proof]', e);
    res.status(500).json({ error: 'failed' });
  }
}

async function queryRow(id: number) {
  const r = await query('SELECT * FROM leave_requests WHERE id = $1', [id]);
  return (r as any).rowCount ? (r as any).rows[0] : null;
}
