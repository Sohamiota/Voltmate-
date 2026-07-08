'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, getStoredToken } from '@/src/api/client';

// YouTube calls are proxied through the backend so the API key is never
// bundled into the client JS bundle or visible in browser DevTools.
const YT_BASE = `${API_BASE.replace(/\/api\/v1\/?$/, '')}/api/v1/youtube`;

/** Euler Motors (@EulerMotors) — fallback when handle lookup fails. */
const EULER_CHANNEL_ID_FALLBACK = 'UCWCjm4kOin3lecjOlxa3wuQ';

function ytFetch(resource: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${YT_BASE}/${resource}?${qs}`, {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
}

async function ytFetchJson<T = Record<string, unknown>>(
  resource: string,
  params: Record<string, string>,
): Promise<T> {
  const r = await ytFetch(resource, params);
  const d = (await r.json()) as T & { error?: string | { message?: string }; code?: string };

  if (!r.ok) {
    if (typeof d.error === 'string') throw new Error(d.error);
    if (d.code === 'YOUTUBE_NOT_CONFIGURED') {
      throw new Error(
        'YouTube is not configured on the server. Ask an admin to set YOUTUBE_API_KEY on Render.',
      );
    }
    const msg =
      typeof d.error === 'object' && d.error?.message
        ? d.error.message
        : `YouTube request failed (${r.status})`;
    throw new Error(msg);
  }

  const apiErr = (d as { error?: { message?: string } }).error;
  if (apiErr?.message) throw new Error(apiErr.message);
  return d;
}

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  viewCount?: string;
}

type PlaylistItem = {
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    resourceId: { videoId: string };
    thumbnails?: { high?: { url: string }; medium?: { url: string } };
  };
};

type VideoStatsItem = {
  id: string;
  statistics?: { viewCount?: string };
};

type PlaylistItemsResponse = {
  items?: PlaylistItem[];
  nextPageToken?: string;
};

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
  const [videos, setVideos] = useState<Video[]>([]);
  const [filtered, setFiltered] = useState<Video[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [channelTitle, setChannelTitle] = useState('Euler Motors');
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchVideos = useCallback(async (pageToken?: string) => {
    async function resolveChannelId(): Promise<string> {
      try {
        const cfg = await fetch(`${YT_BASE}/euler/config`, {
          headers: { Authorization: `Bearer ${getStoredToken()}` },
        }).then(r => r.json());
        if (cfg?.channelId) return cfg.channelId as string;
      } catch {
        /* use local fallback */
      }
      return EULER_CHANNEL_ID_FALLBACK;
    }

    setLoading(true);
    setError(null);
    try {
      const channelId = await resolveChannelId();
      const chData = await ytFetchJson<{ items?: Array<{ snippet: { title: string }; contentDetails: { relatedPlaylists: { uploads: string } } }> }>(
        'channels',
        { part: 'snippet,contentDetails', id: channelId },
      );
      if (!chData.items?.length) {
        throw new Error('Could not load the Euler Motors YouTube channel. Check YOUTUBE_API_KEY on the server.');
      }
      setChannelTitle(chData.items[0].snippet.title);
      const uploadsId: string = chData.items[0].contentDetails.relatedPlaylists.uploads;

      const plParams: Record<string, string> = { part: 'snippet', playlistId: uploadsId, maxResults: '24' };
      if (pageToken) plParams.pageToken = pageToken;
      const plData = await ytFetchJson<PlaylistItemsResponse>('playlistItems', plParams);
      if (!plData.items) return;
      setNextPageToken(plData.nextPageToken || null);

      const videoIds = plData.items.map(i => i.snippet.resourceId.videoId).join(',');
      const statsData = await ytFetchJson<{ items?: VideoStatsItem[] }>('videos', { part: 'statistics', id: videoIds });
      const statsMap: Record<string, VideoStatsItem> = {};
      statsData.items?.forEach(v => { statsMap[v.id] = v; });

      const newVideos: Video[] = plData.items.map(item => {
        const vid = item.snippet.resourceId.videoId;
        return {
          id: vid,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
          publishedAt: item.snippet.publishedAt,
          viewCount: statsMap[vid]?.statistics?.viewCount,
        };
      });

      setVideos(prev => pageToken ? [...prev, ...newVideos] : newVideos);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(videos); return; }
    const q = search.toLowerCase();
    setFiltered(videos.filter(v => v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)));
  }, [search, videos]);

  useEffect(() => { void fetchVideos(); }, [fetchVideos]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-8">

      <div className="mb-7 flex justify-between items-start flex-wrap gap-4">
        <div>
          <div className="text-[28px] font-bold text-white mb-1.5">Vehicle Videos</div>
          <div className="text-zinc-400 text-sm">{channelTitle} — Electric Commercial Vehicles</div>
          <a
            href="https://www.youtube.com/@EulerMotors"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 text-[13px] no-underline inline-flex items-center gap-1 mt-1.5 hover:underline"
          >
            youtube.com/@EulerMotors
          </a>
        </div>
        <button
          className="px-[22px] py-2.5 bg-transparent border border-zinc-800 text-zinc-400 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 whitespace-nowrap hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => fetchVideos()}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-[18px] py-3.5 text-red-500 text-[13px] mb-5">
          {error}
        </div>
      )}

      {loading && videos.length === 0 && (
        <div className="flex justify-center items-center py-20 px-5 gap-3 text-zinc-400">
          <div className="w-6 h-6 border-[3px] border-zinc-800 border-t-cyan-400 rounded-full animate-spin" />
          Loading videos...
        </div>
      )}

      {!loading && videos.length === 0 && !error && (
        <div className="text-center py-20 px-5 text-zinc-500 text-sm">No videos found.</div>
      )}

      {videos.length > 0 && (
        <div className="flex gap-3 items-center mb-6 flex-wrap">
          <input
            ref={searchRef}
            className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 text-sm outline-none transition-colors duration-200 focus:border-cyan-400"
            placeholder="Search videos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="text-zinc-400 text-[13px] whitespace-nowrap">
            {filtered.length} video{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {!loading && videos.length > 0 && filtered.length === 0 && (
        <div className="text-center py-20 px-5 text-zinc-500 text-sm">No videos match your search.</div>
      )}

      {filtered.length > 0 && (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
            {filtered.map(video => (
              <div
                key={video.id}
                className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-cyan-400 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,217,255,0.1)]"
                onClick={() => setActiveVideo(video)}
              >
                <div className="relative aspect-video overflow-hidden bg-[#111]">
                  <img
                    className="w-full h-full object-cover block"
                    src={video.thumbnail}
                    alt={video.title}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <div className="w-[52px] h-[52px] bg-cyan-400/90 rounded-full flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a0a0a" className="ml-1">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm font-semibold text-white mb-2 leading-[1.4] line-clamp-2">{video.title}</div>
                  <div className="text-xs text-zinc-500 leading-[1.5] line-clamp-2 mb-3">
                    {video.description || 'No description available.'}
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span>{formatDate(video.publishedAt)}</span>
                    {video.viewCount && (
                      <span className="text-cyan-400 font-medium">{formatCount(video.viewCount)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {nextPageToken && (
            <div className="flex justify-center mt-8">
              <button
                className="px-[22px] py-2.5 bg-transparent border border-zinc-800 text-zinc-400 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 whitespace-nowrap hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => fetchVideos(nextPageToken)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {activeVideo && (
        <div
          className="fixed inset-0 bg-black/85 z-[1000] flex items-center justify-center p-5"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-[900px] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-5 px-6 gap-4">
              <div className="text-base font-semibold text-white leading-[1.4] flex-1">{activeVideo.title}</div>
              <button
                className="bg-transparent border border-zinc-800 text-zinc-400 rounded-lg w-9 h-9 cursor-pointer text-lg flex items-center justify-center flex-shrink-0 hover:border-zinc-600 hover:text-white"
                onClick={() => setActiveVideo(null)}
              >
                x
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                className="w-full h-full border-0 block"
                src={`https://www.youtube.com/embed/${activeVideo.id}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="p-4 px-6 pb-5 text-zinc-400 text-[13px] flex gap-5 flex-wrap items-center">
              <span>Published: {formatDate(activeVideo.publishedAt)}</span>
              {activeVideo.viewCount && (
                <span className="text-cyan-400 font-medium">{formatCount(activeVideo.viewCount)}</span>
              )}
              <a
                href={`https://www.youtube.com/watch?v=${activeVideo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 no-underline ml-auto"
              >
                Open on YouTube
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
