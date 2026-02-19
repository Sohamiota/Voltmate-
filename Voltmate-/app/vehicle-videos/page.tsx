'use client'

import { useCallback, useEffect, useRef, useState } from 'react';

const YT_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || '';
const EULER_CHANNEL = '@EulerMotors';

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  viewCount?: string;
  duration?: string;
}

const STYLES = `
  * { margin:0; padding:0; box-sizing:border-box; }
  .vv-root { min-height:100vh; background:#0a0a0a; color:#e5e5e5; font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif; padding:32px; }
  .vv-header { margin-bottom:32px; }
  .vv-title { font-size:28px; font-weight:700; color:#fff; margin-bottom:6px; }
  .vv-subtitle { color:#9ca3af; font-size:14px; }
  .vv-config { background:#1a1a1a; border:1px solid #2a2a2a; border-radius:12px; padding:24px; margin-bottom:28px; }
  .vv-config h3 { color:#fff; font-size:15px; font-weight:600; margin-bottom:16px; }
  .vv-config-row { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; }
  .vv-field { display:flex; flex-direction:column; gap:6px; flex:1; min-width:220px; }
  .vv-field label { color:#9ca3af; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.5px; }
  .vv-input { background:#111; border:1px solid #333; border-radius:8px; padding:10px 14px; color:#e5e5e5; font-size:14px; outline:none; transition:border-color .2s; }
  .vv-input:focus { border-color:#00d9ff; }
  .vv-btn { padding:10px 22px; border:none; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; transition:all .2s; white-space:nowrap; }
  .vv-btn-primary { background:#00d9ff; color:#0a0a0a; }
  .vv-btn-primary:hover { background:#00c4e6; box-shadow:0 0 16px rgba(0,217,255,.35); }
  .vv-btn-primary:disabled { opacity:.5; cursor:not-allowed; }
  .vv-btn-ghost { background:transparent; color:#9ca3af; border:1px solid #333; }
  .vv-btn-ghost:hover { border-color:#555; color:#e5e5e5; }
  .vv-search-row { display:flex; gap:12px; align-items:center; margin-bottom:24px; flex-wrap:wrap; }
  .vv-search { flex:1; min-width:200px; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:8px; padding:10px 16px; color:#e5e5e5; font-size:14px; outline:none; }
  .vv-search:focus { border-color:#00d9ff; }
  .vv-count { color:#9ca3af; font-size:13px; white-space:nowrap; }
  .vv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:20px; }
  .vv-card { background:#1a1a1a; border:1px solid #2a2a2a; border-radius:12px; overflow:hidden; cursor:pointer; transition:all .2s; }
  .vv-card:hover { border-color:#00d9ff; transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,217,255,.1); }
  .vv-thumb-wrap { position:relative; aspect-ratio:16/9; overflow:hidden; background:#111; }
  .vv-thumb { width:100%; height:100%; object-fit:cover; display:block; }
  .vv-play-icon { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.35); opacity:0; transition:opacity .2s; }
  .vv-card:hover .vv-play-icon { opacity:1; }
  .vv-play-btn { width:52px; height:52px; background:rgba(0,217,255,.9); border-radius:50%; display:flex; align-items:center; justify-content:center; }
  .vv-play-btn svg { margin-left:4px; }
  .vv-card-body { padding:16px; }
  .vv-card-title { font-size:14px; font-weight:600; color:#fff; margin-bottom:8px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .vv-card-desc { font-size:12px; color:#6b7280; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:12px; }
  .vv-card-meta { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#6b7280; }
  .vv-views { color:#00d9ff; font-weight:500; }
  .vv-empty { text-align:center; padding:80px 20px; color:#6b7280; }
  .vv-empty-icon { font-size:48px; margin-bottom:16px; }
  .vv-error { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.25); border-radius:8px; padding:14px 18px; color:#ef4444; font-size:13px; margin-bottom:20px; }
  .vv-loading { display:flex; justify-content:center; align-items:center; padding:80px 20px; gap:12px; color:#9ca3af; }
  .vv-spinner { width:24px; height:24px; border:3px solid #2a2a2a; border-top-color:#00d9ff; border-radius:50%; animation:spin .8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .vv-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
  .vv-modal { background:#1a1a1a; border:1px solid #2a2a2a; border-radius:16px; width:100%; max-width:900px; overflow:hidden; }
  .vv-modal-header { display:flex; justify-content:space-between; align-items:flex-start; padding:20px 24px; gap:16px; }
  .vv-modal-title { font-size:16px; font-weight:600; color:#fff; line-height:1.4; flex:1; }
  .vv-modal-close { background:transparent; border:1px solid #333; color:#9ca3af; border-radius:8px; width:36px; height:36px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .vv-modal-close:hover { border-color:#555; color:#fff; }
  .vv-iframe-wrap { position:relative; aspect-ratio:16/9; background:#000; }
  .vv-iframe { width:100%; height:100%; border:none; display:block; }
  .vv-modal-meta { padding:16px 24px 20px; color:#9ca3af; font-size:13px; display:flex; gap:20px; flex-wrap:wrap; }
  .vv-load-more { display:flex; justify-content:center; margin-top:32px; }
`;

function formatCount(n: string | undefined): string {
  if (!n) return '';
  const num = parseInt(n, 10);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M views';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K views';
  return num + ' views';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function VehicleVideosPage() {
  const [apiKey, setApiKey] = useState(YT_API_KEY);
  const [channelInput, setChannelInput] = useState(EULER_CHANNEL);
  const [videos, setVideos] = useState<Video[]>([]);
  const [filtered, setFiltered] = useState<Video[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [channelTitle, setChannelTitle] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!search.trim()) { setFiltered(videos); return; }
    const q = search.toLowerCase();
    setFiltered(videos.filter(v => v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)));
  }, [search, videos]);

  // Auto-fetch Euler Motors on mount if API key is set
  useEffect(() => {
    if (apiKey) fetchVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveChannelId(input: string, key: string): Promise<string> {
    const trimmed = input.trim();
    // Already a channel ID (starts with UC)
    if (/^UC[\w-]{22}$/.test(trimmed)) return trimmed;
    // Handle URL formats
    const urlMatch = trimmed.match(/youtube\.com\/(channel\/(UC[\w-]{22})|@([\w.-]+)|c\/([\w.-]+)|user\/([\w.-]+))/);
    if (urlMatch) {
      if (urlMatch[2]) return urlMatch[2]; // channel/UC...
      const handle = urlMatch[3] || urlMatch[4] || urlMatch[5];
      if (handle) {
        const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${key}`);
        const d = await r.json();
        if (d.items?.[0]?.id) return d.items[0].id;
      }
    }
    // Try as handle (@ prefix)
    const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${key}`);
    const d = await r.json();
    if (d.items?.[0]?.id) return d.items[0].id;
    // Try as username
    const r2 = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${handle}&key=${key}`);
    const d2 = await r2.json();
    if (d2.items?.[0]?.id) return d2.items[0].id;
    throw new Error(`Could not resolve channel: "${input}"`);
  }

  const fetchVideos = useCallback(async (pageToken?: string) => {
    if (!apiKey) { setError('Enter your YouTube Data API v3 key above.'); return; }
    if (!channelInput.trim()) { setError('Enter a channel ID, handle (@voltwheels), or URL.'); return; }
    setLoading(true);
    setError(null);
    try {
      const channelId = await resolveChannelId(channelInput, apiKey);
      // Get channel info
      const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${channelId}&key=${apiKey}`);
      const chData = await chRes.json();
      if (!chData.items?.length) throw new Error('Channel not found. Check the channel ID or handle.');
      setChannelTitle(chData.items[0].snippet.title);
      const uploadsId: string = chData.items[0].contentDetails.relatedPlaylists.uploads;

      // Get videos from uploads playlist
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=24&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const plRes = await fetch(url);
      const plData = await plRes.json();
      if (plData.error) throw new Error(plData.error.message);
      setNextPageToken(plData.nextPageToken || null);

      const videoIds: string = plData.items.map((i: any) => i.snippet.resourceId.videoId).join(',');
      // Get view counts and stats
      const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${apiKey}`);
      const statsData = await statsRes.json();
      const statsMap: Record<string, any> = {};
      statsData.items?.forEach((v: any) => { statsMap[v.id] = v; });

      const newVideos: Video[] = plData.items.map((item: any) => {
        const vid = item.snippet.resourceId.videoId;
        const stats = statsMap[vid];
        return {
          id: vid,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
          publishedAt: item.snippet.publishedAt,
          viewCount: stats?.statistics?.viewCount,
        };
      });

      if (pageToken) {
        setVideos(prev => [...prev, ...newVideos]);
      } else {
        setVideos(newVideos);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  }, [apiKey, channelInput]);

  return (
    <div className="vv-root">
      <style>{STYLES}</style>

      {/* Header */}
      <div className="vv-header">
        <div className="vv-title">🚗 Vehicle Videos</div>
        <div className="vv-subtitle">
          {channelTitle
            ? `Showing videos from: ${channelTitle}`
            : 'Euler Motors — Electric Commercial Vehicles'}
        </div>
      </div>

      {/* Config — only API key needed, channel is fixed */}
      <div className="vv-config">
        <h3>YouTube API Key</h3>
        <div className="vv-config-row">
          <div className="vv-field">
            <label>API Key</label>
            <input
              className="vv-input"
              type="password"
              placeholder="AIzaSy... (YouTube Data API v3)"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchVideos()}
            />
          </div>
          <button
            className="vv-btn vv-btn-primary"
            onClick={() => fetchVideos()}
            disabled={loading}
            style={{ alignSelf: 'flex-end' }}
          >
            {loading ? 'Loading...' : videos.length ? 'Refresh' : 'Load Videos'}
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          Channel: <span style={{ color: '#00d9ff' }}>@EulerMotors</span> — 
          <a href="https://www.youtube.com/@EulerMotors" target="_blank" rel="noopener noreferrer" style={{ color: '#00d9ff', marginLeft: 4 }}>
            youtube.com/@EulerMotors ↗
          </a>
        </div>
      </div>

      {/* Error */}
      {error && <div className="vv-error">⚠ {error}</div>}

      {/* Search & count */}
      {videos.length > 0 && (
        <div className="vv-search-row">
          <input
            ref={searchRef}
            className="vv-search"
            placeholder="Search videos by title or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="vv-count">{filtered.length} video{filtered.length !== 1 ? 's' : ''}</span>
          <button className="vv-btn vv-btn-ghost" onClick={() => { setVideos([]); setFiltered([]); setChannelTitle(''); setSearch(''); setNextPageToken(null); }}>Clear</button>
        </div>
      )}

      {/* Loading */}
      {loading && videos.length === 0 && (
        <div className="vv-loading">
          <div className="vv-spinner" />
          Fetching videos...
        </div>
      )}

      {/* Empty state */}
      {!loading && videos.length === 0 && !error && (
        <div className="vv-empty">
          <div className="vv-empty-icon">📺</div>
          <div>Enter your YouTube Data API v3 key above to load Euler Motors videos</div>
        </div>
      )}

      {/* No results after search */}
      {!loading && videos.length > 0 && filtered.length === 0 && (
        <div className="vv-empty">
          <div className="vv-empty-icon">🔍</div>
          <div>No videos match your search</div>
        </div>
      )}

      {/* Video grid */}
      {filtered.length > 0 && (
        <>
          <div className="vv-grid">
            {filtered.map(video => (
              <div key={video.id} className="vv-card" onClick={() => setActiveVideo(video)}>
                <div className="vv-thumb-wrap">
                  <img className="vv-thumb" src={video.thumbnail} alt={video.title} loading="lazy" />
                  <div className="vv-play-icon">
                    <div className="vv-play-btn">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a0a0a">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="vv-card-body">
                  <div className="vv-card-title">{video.title}</div>
                  <div className="vv-card-desc">{video.description || 'No description available.'}</div>
                  <div className="vv-card-meta">
                    <span>{formatDate(video.publishedAt)}</span>
                    {video.viewCount && <span className="vv-views">{formatCount(video.viewCount)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {nextPageToken && (
            <div className="vv-load-more">
              <button
                className="vv-btn vv-btn-ghost"
                onClick={() => fetchVideos(nextPageToken)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More Videos'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Player modal */}
      {activeVideo && (
        <div className="vv-modal-overlay" onClick={() => setActiveVideo(null)}>
          <div className="vv-modal" onClick={e => e.stopPropagation()}>
            <div className="vv-modal-header">
              <div className="vv-modal-title">{activeVideo.title}</div>
              <button className="vv-modal-close" onClick={() => setActiveVideo(null)}>✕</button>
            </div>
            <div className="vv-iframe-wrap">
              <iframe
                className="vv-iframe"
                src={`https://www.youtube.com/embed/${activeVideo.id}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="vv-modal-meta">
              <span>Published: {formatDate(activeVideo.publishedAt)}</span>
              {activeVideo.viewCount && <span className="vv-views">{formatCount(activeVideo.viewCount)}</span>}
              <a
                href={`https://www.youtube.com/watch?v=${activeVideo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00d9ff', textDecoration: 'none', marginLeft: 'auto' }}
              >
                Open on YouTube ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
