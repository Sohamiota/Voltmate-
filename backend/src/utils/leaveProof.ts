import fs from 'fs';
import path from 'path';

export type ProofPayload = {
  filename: string;
  mime_type: string;
  data_base64: string;
};

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_BYTES = 3 * 1024 * 1024;

/** Backend root (backend/) */
export const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads', 'leave-proofs');

export function validateProofPayload(proof: ProofPayload): void {
  if (!proof.filename?.trim()) throw new Error('proof_invalid: Filename is required');
  if (!ALLOWED_MIME.has(proof.mime_type)) {
    throw new Error('proof_invalid: Use PDF, JPEG, PNG, or WebP');
  }
  if (!proof.data_base64?.trim()) throw new Error('proof_invalid: Document data is missing');

  let buf: Buffer;
  try {
    buf = Buffer.from(proof.data_base64, 'base64');
  } catch {
    throw new Error('proof_invalid: Could not read document data');
  }
  if (buf.length === 0) throw new Error('proof_invalid: Document is empty');
  if (buf.length > MAX_BYTES) throw new Error('proof_too_large: Document must be under 3 MB');
}

export function saveProofFile(userId: number, requestId: number, proof: ProofPayload): {
  relativePath: string;
  filename: string;
  mimeType: string;
} {
  validateProofPayload(proof);
  const buf = Buffer.from(proof.data_base64, 'base64');
  const ext = path.extname(proof.filename) || (proof.mime_type === 'application/pdf' ? '.pdf' : '.jpg');
  const safeName = `${requestId}_${Date.now()}${ext.toLowerCase()}`;
  const dir = path.join(UPLOAD_ROOT, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, safeName);
  fs.writeFileSync(fullPath, buf);
  const relativePath = path.join('uploads', 'leave-proofs', String(userId), safeName).replace(/\\/g, '/');
  return { relativePath, filename: proof.filename, mimeType: proof.mime_type };
}

export function resolveProofAbsolute(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.includes('..')) throw new Error('invalid_path');
  return path.join(__dirname, '..', '..', normalized);
}

export function readProofFile(relativePath: string): { buf: Buffer; mimeType: string; filename: string } {
  const abs = resolveProofAbsolute(relativePath);
  if (!fs.existsSync(abs)) throw new Error('proof_not_found');
  const buf = fs.readFileSync(abs);
  const filename = path.basename(abs);
  const ext = path.extname(filename).toLowerCase();
  const mimeType =
    ext === '.pdf' ? 'application/pdf'
    : ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';
  return { buf, mimeType, filename };
}
