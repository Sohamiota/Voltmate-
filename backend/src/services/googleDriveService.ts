import fs from 'fs';
import { resolveBillingAbsolute } from '../utils/billingStorage';

type UploadInput = {
  docType: 'quotation' | 'receipt';
  docNo: string;
  docDate: string;
  filePath: string;
  customerName?: string;
};

type DriveResult = { fileId: string; webViewLink: string };

function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_BILLING_ROOT_FOLDER_ID
    && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS),
  );
}

/** Optional Google Drive upload — skipped when credentials are not configured. */
export async function uploadBillingFileToDrive(input: UploadInput): Promise<DriveResult | null> {
  if (!driveConfigured()) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { google } = require('googleapis') as { google: { auth: { GoogleAuth: new (opts: Record<string, unknown>) => unknown }; drive: (opts: Record<string, unknown>) => any } };

    let credentials: Record<string, unknown>;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } else {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS!;
      credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const rootId = process.env.GOOGLE_DRIVE_BILLING_ROOT_FOLDER_ID!;

    const d = new Date(`${input.docDate}T00:00:00`);
    const fyLabel = d.getMonth() >= 3
      ? `${d.getFullYear()}-${d.getFullYear() + 1}`
      : `${d.getFullYear() - 1}-${d.getFullYear()}`;
    const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const typeFolder = input.docType === 'quotation' ? 'Quotations' : 'Margin-Money-Receipts';

    const folderId = await ensureDrivePath(drive, rootId, [typeFolder, `FY-${fyLabel}`, monthLabel]);

    const abs = resolveBillingAbsolute(input.filePath);
    const safeName = `${input.docNo.replace(/[/\\:*?"<>|]/g, '-')}${input.customerName ? ` - ${input.customerName}` : ''}.html`;

    const created = await drive.files.create({
      requestBody: {
        name: safeName,
        parents: [folderId],
        mimeType: 'text/html',
      },
      media: {
        mimeType: 'text/html',
        body: fs.createReadStream(abs),
      },
      fields: 'id, webViewLink',
    });

    if (!created.data.id) throw new Error('Drive file id missing');
    return {
      fileId: created.data.id,
      webViewLink: created.data.webViewLink || `https://drive.google.com/file/d/${created.data.id}/view`,
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'MODULE_NOT_FOUND') {
      console.warn('[billing] googleapis not installed — skipping Drive upload');
      return null;
    }
    throw e;
  }
}

async function ensureDrivePath(
  drive: { files: { list: (args: Record<string, unknown>) => Promise<{ data: { files?: Array<{ id?: string }> } }>; create: (args: Record<string, unknown>) => Promise<{ data: { id?: string } }> } },
  rootId: string,
  segments: string[],
): Promise<string> {
  let parentId = rootId;
  for (const name of segments) {
    const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const found = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
    if (found.data.files?.[0]?.id) {
      parentId = found.data.files[0].id;
      continue;
    }
    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });
    parentId = created.data.id!;
  }
  return parentId;
}
