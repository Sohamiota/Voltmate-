// Salesforce sync removed per request — endpoint disabled.
import { Request, Response } from 'express';

export async function syncSalesforce(_req: Request, res: Response) {
  res.status(410).json({ error: 'Salesforce sync disabled' });
}

