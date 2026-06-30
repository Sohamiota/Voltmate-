import { Router, Request, Response } from 'express';

const router = Router();

/** Euler Motors (@EulerMotors) — used when handle lookup is unavailable. */
export const EULER_YOUTUBE_CHANNEL_ID =
  process.env.EULER_YOUTUBE_CHANNEL_ID || 'UCWCjm4kOin3lecjOlxa3wuQ';

// Whitelisted YouTube Data API v3 resources this proxy exposes.
// Anything not in this list is rejected — prevents the proxy from becoming an
// open relay to arbitrary Google APIs.
const ALLOWED_RESOURCES = new Set(['channels', 'playlistItems', 'videos']);

/**
 * GET /api/v1/youtube/euler/config
 *
 * Returns the known Euler Motors channel id so the client can skip handle lookup.
 */
router.get('/euler/config', (_req: Request, res: Response) => {
  res.json({ channelId: EULER_YOUTUBE_CHANNEL_ID, handle: '@EulerMotors' });
});

/**
 * GET /api/v1/youtube/:resource
 *
 * Proxy YouTube Data API v3 calls so YOUTUBE_API_KEY never leaves the server.
 * The frontend passes every query param it needs (part, id, maxResults, etc.)
 * and the backend appends the key before forwarding.
 *
 * Requires a valid JWT (enforced by global authMiddleware in app.ts).
 */
router.get('/:resource', async (req: Request, res: Response) => {
  const { resource } = req.params;

  if (!ALLOWED_RESOURCES.has(resource)) {
    return res.status(400).json({ error: `YouTube resource '${resource}' is not supported` });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'YouTube integration is not configured on this server',
      code: 'YOUTUBE_NOT_CONFIGURED',
    });
  }

  // Forward all query params from the client, then append the key.
  const params = new URLSearchParams(req.query as Record<string, string>);
  params.set('key', apiKey);

  try {
    const upstreamUrl = `https://www.googleapis.com/youtube/v3/${resource}?${params.toString()}`;
    const upstream = await fetch(upstreamUrl);
    const data = await upstream.json();
    // Mirror the upstream HTTP status so the frontend can distinguish quota
    // errors (403) from not-found (404) vs server errors (5xx).
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[youtube-proxy] upstream fetch failed:', err);
    res.status(502).json({ error: 'Failed to reach YouTube API' });
  }
});

export default router;
