export function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches)];
}

export function initialsFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function getYouTubeEmbedUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/')[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type LinkPreview = {
  url: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  site_name?: string | null;
};

export type MusicPreview = {
  embedUrl: string;
  sourceLabel: 'Spotify' | 'Apple Music' | 'TIDAL';
  actions: { label: 'Spotify' | 'Apple Music' | 'TIDAL'; url: string }[];
};

function getSpotifyTrackId(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes('spotify.com')) return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'track' && parts[1]) return parts[1];
  } catch {
    return null;
  }
  return null;
}

function getAppleMusicTrackInfo(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes('music.apple.com')) return null;
    const trackId = parsed.searchParams.get('i');
    if (!trackId) return null;
    const country = parsed.pathname.split('/').filter(Boolean)[0] ?? 'us';
    return { country, trackId };
  } catch {
    return null;
  }
}

export function getMusicPreview(url: string, preview?: LinkPreview, theme?: 'light' | 'dark'): MusicPreview | null {
  const query = encodeURIComponent(preview?.title || preview?.description || 'song');
  const tidalSearchUrl = `https://listen.tidal.com/search?q=${query}`;

  const spotifyTrackId = getSpotifyTrackId(url);
  if (spotifyTrackId) {
    return {
      embedUrl: `https://open.spotify.com/embed/track/${spotifyTrackId}`,
      sourceLabel: 'Spotify',
      actions: [
        { label: 'Spotify', url: `https://open.spotify.com/track/${spotifyTrackId}` },
        { label: 'Apple Music', url: `https://music.apple.com/us/search?term=${query}` },
        { label: 'TIDAL', url: tidalSearchUrl }
      ]
    };
  }

  const appleInfo = getAppleMusicTrackInfo(url);
  if (appleInfo) {
    const parsed = new URL(url);
    const themeParam = theme ? `&theme=${theme}` : '';
    return {
      embedUrl: `https://embed.music.apple.com/${appleInfo.country}${parsed.pathname}?i=${appleInfo.trackId}${themeParam}`,
      sourceLabel: 'Apple Music',
      actions: [
        { label: 'Apple Music', url },
        { label: 'Spotify', url: `https://open.spotify.com/search/${query}` },
        { label: 'TIDAL', url: tidalSearchUrl }
      ]
    };
  }

  return null;
}
