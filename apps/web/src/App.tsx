import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { api } from './api';

type User = {
  id: string;
  email: string;
  handle: string;
  name: string;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
  home_server_id?: string | null;
  bio?: string | null;
};

type Server = {
  id: string;
  name: string;
  slug: string;
  role?: 'owner' | 'admin' | 'member';
};

type Channel = {
  id: string;
  name: string;
  slug: string;
  notification_mode: 'hidden' | 'passive' | 'active';
  snoozed_until?: string | null;
};

type Message = {
  id: string;
  body: string;
  thread_root_message_id?: string | null;
  thread_reply_count?: number;
  author_handle: string;
  author_name: string;
  created_at: string;
  reactions: { emoji: string; count: number }[];
  attachments: { id: string; mime_type: string; original_name: string; public_url: string }[];
};

type ThreadMessage = {
  id: string;
  body: string;
  author_handle: string;
  author_name: string;
  created_at: string;
  attachments: { id: string; mime_type: string; original_name: string; public_url: string }[];
};

type LinkPreview = {
  url: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  site_name?: string | null;
};

type Command = {
  id: string;
  command: string;
  response_text: string;
};

type LibraryItem = {
  id: string;
  item_type: 'url' | 'media';
  source_message_id?: string | null;
  post_time?: string;
  posted_by_user_id?: string;
  posted_by_handle?: string;
  posted_by_name?: string;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  taxonomy_terms?: string[];
  media_url?: string | null;
  preview_image_url?: string | null;
  preview_title?: string | null;
  preview_description?: string | null;
  channel_name?: string;
  created_at?: string;
};

const TOKEN_KEY = 'tincan_token';
const REFRESH_TOKEN_KEY = 'tincan_refresh_token';
const UI_PREFS_KEY = 'tincan_ui_prefs_v1';

type UiPrefs = {
  textSize: 'compact' | 'comfortable' | 'large';
  contrast: 'default' | 'high' | 'soft' | 'rg-safe';
  onboarded: boolean;
};

function loadUiPrefs(): UiPrefs {
  const fallback: UiPrefs = { textSize: 'comfortable', contrast: 'default', onboarded: false };
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }
    return {
      textSize: parsed.textSize === 'compact' || parsed.textSize === 'large' ? parsed.textSize : 'comfortable',
      contrast: parsed.contrast === 'high' || parsed.contrast === 'soft' || parsed.contrast === 'rg-safe' ? parsed.contrast : 'default',
      onboarded: parsed.onboarded === true
    };
  } catch {
    return fallback;
  }
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches)];
}

function decodeHtmlEntities(value?: string | null) {
  if (!value) {
    return '';
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return value;
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function getYouTubeEmbedUrl(rawUrl: string) {
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

function guessTaxonomySuggestions(item: LibraryItem) {
  const suggestions = new Set<string>();
  if (item.item_type === 'media') {
    suggestions.add('media');
    const url = item.media_url || '';
    if (/\.(png|jpg|jpeg|gif|webp|avif)$/i.test(url)) suggestions.add('image');
    if (/\.(mp4|mov|m4v|webm)$/i.test(url)) suggestions.add('video');
    if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(url)) suggestions.add('audio');
  } else {
    suggestions.add('link');
    if (item.url) {
      try {
        const host = new URL(item.url).hostname.replace(/^www\./, '');
        const root = host.split('.')[0];
        if (root) suggestions.add(root.toLowerCase());
      } catch {
        // ignore invalid urls
      }
    }
  }

  const sourceText = `${item.preview_title || ''} ${item.preview_description || ''} ${item.title || ''} ${item.description || ''}`.toLowerCase();
  const keywordToTerm: [RegExp, string][] = [
    [/\bmusic|song|album|track|spotify|apple music|tidal\b/, 'music'],
    [/\bvideo|youtube|clip\b/, 'video'],
    [/\bnews|article|blog\b/, 'article'],
    [/\bcode|github|programming|dev\b/, 'tech'],
    [/\bgame|gaming\b/, 'gaming']
  ];
  for (const [pattern, term] of keywordToTerm) {
    if (pattern.test(sourceText)) {
      suggestions.add(term);
    }
  }

  return [...suggestions].slice(0, 8);
}

type MusicPreview = {
  embedUrl: string;
  sourceLabel: 'Spotify' | 'Apple Music' | 'TIDAL';
  actions: { label: 'Spotify' | 'Apple Music' | 'TIDAL'; url: string }[];
};

function getSpotifyTrackId(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes('spotify.com')) {
      return null;
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'track' && parts[1]) {
      return parts[1];
    }
  } catch {
    return null;
  }
  return null;
}

function getAppleMusicTrackInfo(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes('music.apple.com')) {
      return null;
    }
    const trackId = parsed.searchParams.get('i');
    if (!trackId) {
      return null;
    }
    const country = parsed.pathname.split('/').filter(Boolean)[0] ?? 'us';
    return {
      country,
      trackId
    };
  } catch {
    return null;
  }
}

function getMusicPreview(url: string, preview?: LinkPreview): MusicPreview | null {
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
    return {
      embedUrl: `https://embed.music.apple.com/${appleInfo.country}${parsed.pathname}?i=${appleInfo.trackId}`,
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

export function App() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem(REFRESH_TOKEN_KEY) ?? '');
  const [user, setUser] = useState<User | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    name: '',
    handle: ''
  });
  const [serverName, setServerName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [composer, setComposer] = useState('');
  const [pendingMedia, setPendingMedia] = useState<
    { id: string; public_url: string; mime_type: string; original_name: string }[]
  >([]);
  const [selectedThreadRootId, setSelectedThreadRootId] = useState('');
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadComposer, setThreadComposer] = useState('');
  const [channelMode, setChannelMode] = useState<'hidden' | 'passive' | 'active'>('passive');
  const [channelSnoozeHours, setChannelSnoozeHours] = useState('0');
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  const [centerPane, setCenterPane] = useState<'chat' | 'library' | 'account'>('chat');
  const [accountView, setAccountView] = useState<'profile' | 'settings' | 'accessibility'>('profile');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [leftRailTab, setLeftRailTab] = useState<'servers' | 'dms' | 'channels'>('channels');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreview>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { id: string; body: string; author_name: string; channel_name: string; created_at: string }[]
  >([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [collections, setCollections] = useState<{ id: string; name: string; visibility: 'private' | 'public' }[]>([]);
  const [collectionName, setCollectionName] = useState('');
  const [collectionVisibility, setCollectionVisibility] = useState<'private' | 'public'>('private');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [selectedLibraryItemIds, setSelectedLibraryItemIds] = useState<string[]>([]);
  const [collectionItems, setCollectionItems] = useState<LibraryItem[]>([]);
  const [libraryScope, setLibraryScope] = useState<'all' | 'collection'>('all');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryTypeFilter, setLibraryTypeFilter] = useState<'all' | 'url' | 'media'>('all');
  const [librarySort, setLibrarySort] = useState<'newest' | 'oldest' | 'title' | 'manual'>('newest');
  const [libraryPosterFilter, setLibraryPosterFilter] = useState<string>('all');
  const [libraryTaxonomyFilter, setLibraryTaxonomyFilter] = useState<string>('all');
  const [libraryDateFrom, setLibraryDateFrom] = useState('');
  const [libraryDateTo, setLibraryDateTo] = useState('');
  const [taxonomyQuickInput, setTaxonomyQuickInput] = useState('');
  const [editingLibraryItem, setEditingLibraryItem] = useState<LibraryItem | null>(null);
  const [metadataTitleDraft, setMetadataTitleDraft] = useState('');
  const [metadataDescriptionDraft, setMetadataDescriptionDraft] = useState('');
  const [metadataTermsDraft, setMetadataTermsDraft] = useState('');
  const [draggingLibraryItemId, setDraggingLibraryItemId] = useState<string | null>(null);
  const [dragOverLibraryItemId, setDragOverLibraryItemId] = useState<string | null>(null);
  const [inviteRoleToGrant, setInviteRoleToGrant] = useState<'admin' | 'member'>('member');
  const [inviteMaxUses, setInviteMaxUses] = useState('');
  const [inviteExpiresHours, setInviteExpiresHours] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [invites, setInvites] = useState<{ id: string; code: string; role_to_grant: 'admin' | 'member'; uses_count: number }[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string; handle: string; role: 'owner' | 'admin' | 'member' }[]>([]);
  const [unread, setUnread] = useState<
    {
      channel_id: string;
      channel_name: string;
      server_id: string;
      server_name: string;
      unread_count: number;
    }[]
  >([]);
  const [userCommands, setUserCommands] = useState<Command[]>([]);
  const [serverCommands, setServerCommands] = useState<Command[]>([]);
  const [userCommandForm, setUserCommandForm] = useState({ command: '', responseText: '' });
  const [serverCommandForm, setServerCommandForm] = useState({ command: '', responseText: '' });
  const [uiPrefs, setUiPrefs] = useState<UiPrefs>(() => loadUiPrefs());
  const [profileForm, setProfileForm] = useState({
    name: '',
    handle: '',
    email: '',
    bio: '',
    avatarUrl: '',
    avatarThumbUrl: '',
    homeServerId: ''
  });
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [servers, selectedServerId]
  );

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
  );
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId]
  );

  const unreadCountByChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of unread) {
      map.set(item.channel_id, item.unread_count);
    }
    return map;
  }, [unread]);

  const visibleChannels = useMemo(
    () => channels.filter((channel) => !showUnreadOnly || (unreadCountByChannel.get(channel.id) ?? 0) > 0),
    [channels, showUnreadOnly, unreadCountByChannel]
  );

  const profilePhotos = useMemo(
    () =>
      libraryItems
        .filter((item) => item.item_type === 'media' && item.posted_by_user_id === user?.id && item.media_url)
        .slice(0, 24),
    [libraryItems, user?.id]
  );

  const libraryItemsById = useMemo(() => {
    const map = new Map<string, LibraryItem>();
    for (const item of libraryItems) {
      map.set(item.id, item);
    }
    return map;
  }, [libraryItems]);

  const enrichedCollectionItems = useMemo(() => {
    return collectionItems.map((item) => {
      const base = libraryItemsById.get(item.id);
      if (!base) {
        return item;
      }
      return {
        ...base,
        ...item,
        title: item.title ?? base.title,
        description: item.description ?? base.description,
        preview_title: item.preview_title ?? base.preview_title,
        preview_description: item.preview_description ?? base.preview_description,
        preview_image_url: item.preview_image_url ?? base.preview_image_url,
        media_url: item.media_url ?? base.media_url,
        channel_name: item.channel_name ?? base.channel_name
      };
    });
  }, [collectionItems, libraryItemsById]);

  const activeLibraryItems = useMemo(
    () => (libraryScope === 'collection' && selectedCollectionId ? enrichedCollectionItems : libraryItems),
    [libraryScope, selectedCollectionId, enrichedCollectionItems, libraryItems]
  );
  const canReorderCollection = libraryScope === 'collection' && !!selectedCollectionId && librarySort === 'manual';
  const selectedLibraryItems = useMemo(
    () => activeLibraryItems.filter((item) => selectedLibraryItemIds.includes(item.id)),
    [activeLibraryItems, selectedLibraryItemIds]
  );

  const availablePosterFacets = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of activeLibraryItems) {
      if (item.posted_by_user_id) {
        map.set(item.posted_by_user_id, item.posted_by_handle || item.posted_by_name || item.posted_by_user_id);
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeLibraryItems]);

  const availableTaxonomyFacets = useMemo(() => {
    const set = new Set<string>();
    for (const item of activeLibraryItems) {
      for (const term of item.taxonomy_terms ?? []) {
        if (term.trim()) set.add(term.trim().toLowerCase());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [activeLibraryItems]);

  const filteredLibraryItems = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();

    const filtered = activeLibraryItems.filter((item) => {
      if (libraryTypeFilter !== 'all' && item.item_type !== libraryTypeFilter) {
        return false;
      }
      if (libraryPosterFilter !== 'all' && item.posted_by_user_id !== libraryPosterFilter) {
        return false;
      }
      if (libraryTaxonomyFilter !== 'all' && !(item.taxonomy_terms ?? []).map((term) => term.toLowerCase()).includes(libraryTaxonomyFilter)) {
        return false;
      }
      const postTimeValue = new Date(item.post_time || item.created_at || 0).getTime();
      if (libraryDateFrom) {
        const from = new Date(`${libraryDateFrom}T00:00:00`).getTime();
        if (postTimeValue < from) return false;
      }
      if (libraryDateTo) {
        const to = new Date(`${libraryDateTo}T23:59:59`).getTime();
        if (postTimeValue > to) return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        item.title,
        item.description,
        item.preview_title,
        item.preview_description,
        item.url,
        item.media_url,
        item.channel_name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered];
    if (librarySort === 'manual' && libraryScope === 'collection') {
      return sorted;
    }
    if (librarySort === 'title') {
      sorted.sort((a, b) => (a.title || a.url || '').localeCompare(b.title || b.url || ''));
    } else if (librarySort === 'oldest') {
      sorted.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    } else {
      sorted.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    }

    return sorted;
  }, [
    activeLibraryItems,
    libraryQuery,
    libraryTypeFilter,
    libraryPosterFilter,
    libraryTaxonomyFilter,
    libraryDateFrom,
    libraryDateTo,
    librarySort,
    libraryScope
  ]);

  const visibleTaxonomySuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    const seedItems = [...selectedLibraryItems, ...filteredLibraryItems.slice(0, 10), ...activeLibraryItems.slice(0, 6)];
    for (const seed of seedItems) {
      for (const term of guessTaxonomySuggestions(seed)) {
        suggestions.add(term.trim().toLowerCase());
      }
    }
    for (const term of availableTaxonomyFacets.slice(0, 14)) {
      suggestions.add(term);
    }
    if (suggestions.size === 0) {
      for (const fallback of ['link', 'image', 'video', 'audio', 'music', 'article']) {
        suggestions.add(fallback);
      }
    }
    return [...suggestions].slice(0, 12);
  }, [selectedLibraryItems, filteredLibraryItems, activeLibraryItems, availableTaxonomyFacets]);

  const galleryImages = useMemo(
    () =>
      messages.flatMap((message) =>
        message.attachments
          .filter((attachment) => attachment.mime_type.startsWith('image/'))
          .map((attachment) => ({
            ...attachment,
            messageAuthor: message.author_name,
            messageCreatedAt: message.created_at
          }))
      ),
    [messages]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    void bootstrap(token);
  }, [token]);

  useEffect(() => {
    if (!token || messages.length === 0) {
      return;
    }

    const urls = [...new Set(messages.flatMap((message) => extractUrls(message.body)))];
    const missing = urls.filter((url) => !linkPreviews[url]);

    if (missing.length === 0) {
      return;
    }

    void (async () => {
      try {
        const result = await api.fetchLinkPreviews(token, missing);
        setLinkPreviews((prev) => {
          const next = { ...prev };
          for (const preview of result.previews) {
            next[preview.url] = preview;
          }
          return next;
        });
      } catch {
        // Preview loading failures should not block message rendering.
      }
    })();
  }, [token, messages, linkPreviews]);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    if (galleryImages.length === 0 || lightboxIndex >= galleryImages.length) {
      setLightboxIndex(null);
    }
  }, [galleryImages, lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null || galleryImages.length === 0) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null);
      }
      if (event.key === 'ArrowLeft') {
        setLightboxIndex((prev) => {
          if (prev === null) {
            return prev;
          }
          return (prev - 1 + galleryImages.length) % galleryImages.length;
        });
      }
      if (event.key === 'ArrowRight') {
        setLightboxIndex((prev) => {
          if (prev === null) {
            return prev;
          }
          return (prev + 1) % galleryImages.length;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, galleryImages.length]);

  useEffect(() => {
    if (!token || !selectedCollectionId) {
      setCollectionItems([]);
      return;
    }

    void (async () => {
      try {
        const result = await api.collectionItems(token, selectedCollectionId);
        setCollectionItems(result.items);
      } catch {
        setCollectionItems([]);
      }
    })();
  }, [token, selectedCollectionId]);

  useEffect(() => {
    const activeIds = new Set(activeLibraryItems.map((item) => item.id));
    setSelectedLibraryItemIds((prev) => prev.filter((id) => activeIds.has(id)));
  }, [activeLibraryItems]);

  useEffect(() => {
    if (libraryScope === 'collection' && librarySort !== 'manual') {
      setLibrarySort('manual');
    }
  }, [libraryScope, librarySort]);

  useEffect(() => {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs));
  }, [uiPrefs]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setProfileForm({
      name: user.name ?? '',
      handle: user.handle ?? '',
      email: user.email ?? '',
      bio: user.bio ?? '',
      avatarUrl: user.avatar_url ?? '',
      avatarThumbUrl: user.avatar_thumb_url ?? '',
      homeServerId: user.home_server_id ?? ''
    });
  }, [user]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current || accountMenuRef.current.contains(event.target as Node)) {
        return;
      }
      setAccountMenuOpen(false);
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!user || uiPrefs.onboarded) {
      return;
    }
    setCenterPane('account');
    setAccountView('accessibility');
  }, [user, uiPrefs.onboarded]);

  async function bootstrap(nextToken: string) {
    try {
      setBusy(true);
      const meResult = await api.me(nextToken);
      const serverResult = await api.servers(nextToken);
      const unreadResult = await api.unread(nextToken);
      const userCommandResult = await api.userCommands(nextToken);

      setUser(meResult.user);
      setServers(serverResult.servers);
      setUnread(unreadResult.unread);
      setUserCommands(userCommandResult.commands);

      if (serverResult.servers.length > 0) {
        const firstServer = serverResult.servers[0]!;
        setSelectedServerId(firstServer.id);
        await loadServerAdminData(nextToken, firstServer.id);
        await loadLibraryAndCollections(nextToken, firstServer.id);
        await loadChannels(nextToken, firstServer.id);
      }
    } catch (cause) {
      if (refreshToken) {
        try {
          const refreshed = await api.refresh({ refreshToken });
          localStorage.setItem(TOKEN_KEY, refreshed.accessToken ?? refreshed.token);
          if (refreshed.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshed.refreshToken);
            setRefreshToken(refreshed.refreshToken);
          }
          setToken(refreshed.accessToken ?? refreshed.token);
          setUser(refreshed.user);
          return;
        } catch {
          // Fall through to full logout if refresh fails.
        }
      }

      setError(cause instanceof Error ? cause.message : 'Failed to load session');
      await logout();
    } finally {
      setBusy(false);
    }
  }

  async function loadChannels(nextToken: string, serverId: string) {
    const channelResult = await api.channels(nextToken, serverId);
    const serverCommandResult = await api.serverCommands(nextToken, serverId);
    setChannels(channelResult.channels);
    setServerCommands(serverCommandResult.commands);

    if (channelResult.channels.length > 0) {
      const firstChannel = channelResult.channels[0]!;
      setSelectedChannelId(firstChannel.id);
      setSelectedThreadRootId('');
      setThreadMessages([]);
      await loadLibraryAndCollections(nextToken, serverId);
      await loadMessages(nextToken, firstChannel.id);
    } else {
      setSelectedChannelId('');
      setMessages([]);
      setSelectedThreadRootId('');
      setThreadMessages([]);
      await loadLibraryAndCollections(nextToken, serverId);
    }
  }

  async function loadMessages(nextToken: string, channelId: string) {
    const messageResult = await api.messages(nextToken, channelId);
    const preferenceResult = await api.channelPreference(nextToken, channelId);
    setMessages(messageResult.messages);
    setChannelMode(preferenceResult.preference.mode);
  }

  async function loadLibraryAndCollections(nextToken: string, serverId: string) {
    const [libraryResult, collectionResult] = await Promise.all([
      api.libraryItems(nextToken, serverId),
      api.collections(nextToken, serverId)
    ]);

    setLibraryItems(libraryResult.items);
    setCollections(collectionResult.collections);

    setSelectedCollectionId((prev) => {
      if (collectionResult.collections.length === 0) {
        return '';
      }
      if (prev && collectionResult.collections.some((collection) => collection.id === prev)) {
        return prev;
      }
      return collectionResult.collections[0]!.id;
    });
  }

  async function loadServerAdminData(nextToken: string, serverId: string) {
    try {
      const [inviteResult, memberResult] = await Promise.all([api.invites(nextToken, serverId), api.serverMembers(nextToken, serverId)]);
      setInvites(inviteResult.invites);
      setMembers(memberResult.members);
    } catch {
      setInvites([]);
      setMembers([]);
    }
  }

  async function onAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      setBusy(true);
      const result =
        mode === 'login'
          ? await api.login({ email: authForm.email, password: authForm.password })
          : await api.register({
              email: authForm.email,
              password: authForm.password,
              name: authForm.name,
              handle: authForm.handle
            });

      const accessToken = result.accessToken ?? result.token;
      localStorage.setItem(TOKEN_KEY, accessToken);
      if (result.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
        setRefreshToken(result.refreshToken);
      }
      setToken(accessToken);
      setUser(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !serverName.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createServer(token, { name: serverName.trim() });
      setServerName('');
      await bootstrap(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create server');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedServerId || !channelName.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createChannel(token, selectedServerId, { name: channelName.trim() });
      setChannelName('');
      await loadChannels(token, selectedServerId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create channel');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedServerId) {
      return;
    }

    try {
      setBusy(true);
      await api.createInvite(token, selectedServerId, {
        roleToGrant: inviteRoleToGrant,
        maxUses: inviteMaxUses.trim() ? Number(inviteMaxUses) : undefined,
        expiresInHours: inviteExpiresHours.trim() ? Number(inviteExpiresHours) : undefined
      });
      setInviteMaxUses('');
      setInviteExpiresHours('');
      await loadServerAdminData(token, selectedServerId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create invite');
    } finally {
      setBusy(false);
    }
  }

  async function onJoinInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !joinInviteCode.trim()) {
      return;
    }

    try {
      setBusy(true);
      const code = joinInviteCode.trim();
      const info = await api.inviteInfo(token, code);

      if (info.invite.is_member) {
        setSelectedServerId(info.invite.server_id);
        await loadServerAdminData(token, info.invite.server_id);
        await loadChannels(token, info.invite.server_id);
      } else {
        const accepted = await api.acceptInvite(token, code);
        await bootstrap(token);
        setSelectedServerId(accepted.serverId);
        await loadServerAdminData(token, accepted.serverId);
        await loadChannels(token, accepted.serverId);
      }

      setJoinInviteCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to join invite');
    } finally {
      setBusy(false);
    }
  }

  async function onSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = composer.trim();
    const mediaItemIds = pendingMedia.map((media) => media.id);

    if (!token || !selectedChannelId) {
      return;
    }

    if (!body && mediaItemIds.length === 0) {
      setError('Write a message or attach at least one file.');
      return;
    }

    try {
      setBusy(true);
      await api.createMessage(token, selectedChannelId, {
        body,
        mediaItemIds
      });
      setComposer('');
      setPendingMedia([]);
      await loadMessages(token, selectedChannelId);
      const unreadResult = await api.unread(token);
      setUnread(unreadResult.unread);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send message');
    } finally {
      setBusy(false);
    }
  }

  async function onUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !token || !selectedChannelId) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.uploadToChannel(token, selectedChannelId, file);
      setPendingMedia((prev) => [...prev, result.media]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to upload file');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function onOpenThread(rootMessageId: string) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      setSelectedThreadRootId(rootMessageId);
      const result = await api.threadMessages(token, rootMessageId);
      setThreadMessages(result.messages);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load thread');
    } finally {
      setBusy(false);
    }
  }

  async function onSendThreadMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedThreadRootId || !threadComposer.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createThreadMessage(token, selectedThreadRootId, { body: threadComposer.trim() });
      setThreadComposer('');
      const result = await api.threadMessages(token, selectedThreadRootId);
      setThreadMessages(result.messages);
      if (selectedChannelId) {
        await loadMessages(token, selectedChannelId);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to post thread message');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveChannelPreference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedChannelId) {
      return;
    }

    const hours = Number(channelSnoozeHours || '0');
    const snoozedUntil =
      Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;

    try {
      setBusy(true);
      await api.updateChannelPreference(token, selectedChannelId, {
        mode: channelMode,
        snoozedUntil
      });
      setChannelSettingsOpen(false);
      const unreadResult = await api.unread(token);
      setUnread(unreadResult.unread);
      if (selectedServerId) {
        await loadChannels(token, selectedServerId);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update channel preference');
    } finally {
      setBusy(false);
    }
  }

  async function onSearchMessages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !searchQuery.trim()) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.searchMessages(token, {
        q: searchQuery.trim(),
        serverId: selectedServerId || undefined,
        channelId: selectedChannelId || undefined
      });
      setSearchResults(result.results);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  function getLibraryThumbnail(item: LibraryItem) {
    if (item.item_type === 'media') {
      return item.media_url ?? null;
    }
    return item.preview_image_url ?? null;
  }

  function moveLibraryItem(items: LibraryItem[], draggedId: string, targetId: string) {
    const fromIndex = items.findIndex((item) => item.id === draggedId);
    const toIndex = items.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return items;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return items;
    }
    next.splice(toIndex, 0, moved);
    return next;
  }

  async function persistCollectionOrder(nextItems: LibraryItem[]) {
    if (!token || !selectedCollectionId) {
      return;
    }

    const orderedIds = nextItems.map((item) => item.id);
    try {
      setBusy(true);
      await api.reorderCollectionItems(token, selectedCollectionId, orderedIds);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to save collection order';
      const routeMissing = message.includes('Route PATCH') && message.includes('/items/order') && message.includes('not found');
      if (routeMissing) {
        setError('Drag order updated locally. Restart API to enable saved reorder (`/items/order`).');
        return;
      }
      setError(message);
      try {
        const result = await api.collectionItems(token, selectedCollectionId);
        setCollectionItems(result.items);
      } catch {
        setCollectionItems([]);
      }
    } finally {
      setBusy(false);
    }
  }

  function onSelectAllFilteredLibraryItems() {
    const ids = filteredLibraryItems.map((item) => item.id);
    setSelectedLibraryItemIds((prev) => [...new Set([...prev, ...ids])]);
  }

  function onSetMetadataDraft(item: LibraryItem) {
    setEditingLibraryItem(item);
    setMetadataTitleDraft(decodeHtmlEntities(item.title || item.preview_title || ''));
    setMetadataDescriptionDraft(decodeHtmlEntities(item.description || item.preview_description || ''));
    setMetadataTermsDraft((item.taxonomy_terms ?? []).join(', '));
  }

  function onApplySuggestedTerm(term: string) {
    const currentTerms = metadataTermsDraft
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    if (currentTerms.includes(term.toLowerCase())) {
      return;
    }
    const next = [...currentTerms, term.toLowerCase()];
    setMetadataTermsDraft(next.join(', '));
  }

  async function onSaveLibraryMetadata() {
    if (!token || !editingLibraryItem) {
      return;
    }

    const taxonomyTerms = metadataTermsDraft
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

    try {
      setBusy(true);
      const result = await api.updateLibraryItem(token, editingLibraryItem.id, {
        title: metadataTitleDraft.trim() || null,
        description: metadataDescriptionDraft.trim() || null,
        taxonomyTerms
      });
      const patch = result.item;
      setLibraryItems((prev) =>
        prev.map((item) =>
          item.id === editingLibraryItem.id
            ? { ...item, title: patch.title ?? null, description: patch.description ?? null, taxonomy_terms: patch.taxonomy_terms ?? [] }
            : item
        )
      );
      setCollectionItems((prev) =>
        prev.map((item) =>
          item.id === editingLibraryItem.id
            ? { ...item, title: patch.title ?? null, description: patch.description ?? null, taxonomy_terms: patch.taxonomy_terms ?? [] }
            : item
        )
      );
      setEditingLibraryItem(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to save metadata';
      const missingMetadataRoutes =
        message.includes('Route') &&
        message.includes('/api/library/items/') &&
        message.includes('not found');
      if (missingMetadataRoutes) {
        setError('Metadata save route is unavailable on the running API. Restart/rebuild the API service, then try again.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAddFilteredToCollection() {
    if (!token || !selectedCollectionId || filteredLibraryItems.length === 0) {
      return;
    }
    const ids = filteredLibraryItems.map((item) => item.id).slice(0, 100);
    try {
      setBusy(true);
      await api.addCollectionItems(token, selectedCollectionId, ids);
      const result = await api.collectionItems(token, selectedCollectionId);
      setCollectionItems(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to add filtered items');
    } finally {
      setBusy(false);
    }
  }

  async function onApplyTaxonomyTerm(termInput?: string) {
    const term = (termInput ?? taxonomyQuickInput).trim().toLowerCase();
    if (!term) {
      return;
    }

    if (selectedLibraryItems.length === 0) {
      setError('Select one or more library cards to apply a term, or use "Use As Filter".');
      return;
    }

    await onApplyTaxonomyTermToItems(term, selectedLibraryItems);
    setTaxonomyQuickInput('');
  }

  async function onApplyTaxonomyTermToFiltered() {
    const term = taxonomyQuickInput.trim().toLowerCase();
    if (!term || filteredLibraryItems.length === 0) {
      return;
    }
    await onApplyTaxonomyTermToItems(term, filteredLibraryItems.slice(0, 100));
    setTaxonomyQuickInput('');
  }

  async function onApplyTaxonomyTermToItems(term: string, items: LibraryItem[]) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      for (const item of items) {
        const mergedTerms = [...new Set([...(item.taxonomy_terms ?? []).map((value) => value.toLowerCase()), term])];
        const result = await api.updateLibraryItem(token, item.id, { taxonomyTerms: mergedTerms });
        const patch = result.item;
        setLibraryItems((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, taxonomy_terms: patch.taxonomy_terms ?? [] } : entry))
        );
        setCollectionItems((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, taxonomy_terms: patch.taxonomy_terms ?? [] } : entry))
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to apply taxonomy term');
    } finally {
      setBusy(false);
    }
  }

  function onUseTaxonomyTermAsFilter() {
    const term = taxonomyQuickInput.trim().toLowerCase();
    if (!term) {
      return;
    }
    setLibraryTaxonomyFilter(term);
  }

  function onTaxonomySuggestionClick(term: string) {
    if (selectedLibraryItems.length > 0) {
      void onApplyTaxonomyTerm(term);
      return;
    }
    setTaxonomyQuickInput(term);
  }

  function onClearLibrarySelection() {
    setSelectedLibraryItemIds([]);
  }

  function onLibraryItemDragStart(event: DragEvent<HTMLElement>, itemId: string) {
    if (!canReorderCollection) {
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    setDraggingLibraryItemId(itemId);
  }

  function onLibraryItemDragOver(event: DragEvent<HTMLElement>, itemId: string) {
    if (!canReorderCollection || !draggingLibraryItemId || draggingLibraryItemId === itemId) {
      return;
    }
    event.preventDefault();
    setDragOverLibraryItemId(itemId);
  }

  function onLibraryItemDragEnd() {
    setDraggingLibraryItemId(null);
    setDragOverLibraryItemId(null);
  }

  async function onLibraryItemDrop(event: DragEvent<HTMLElement>, itemId: string) {
    event.preventDefault();
    if (!canReorderCollection || !draggingLibraryItemId || draggingLibraryItemId === itemId) {
      onLibraryItemDragEnd();
      return;
    }
    const next = moveLibraryItem(collectionItems, draggingLibraryItemId, itemId);
    setCollectionItems(next);
    onLibraryItemDragEnd();
    await persistCollectionOrder(next);
  }

  async function onCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedServerId || !collectionName.trim()) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.createCollection(token, {
        serverId: selectedServerId,
        name: collectionName.trim(),
        visibility: collectionVisibility
      });
      setCollectionName('');
      await loadLibraryAndCollections(token, selectedServerId);
      setSelectedCollectionId(result.collection.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create collection');
    } finally {
      setBusy(false);
    }
  }

  async function onAddSelectedToCollection() {
    if (!token || !selectedCollectionId || selectedLibraryItemIds.length === 0) {
      return;
    }

    try {
      setBusy(true);
      await api.addCollectionItems(token, selectedCollectionId, selectedLibraryItemIds);
      setSelectedLibraryItemIds([]);
      const result = await api.collectionItems(token, selectedCollectionId);
      setCollectionItems(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to add items to collection');
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveSelectedFromCollection() {
    if (!token || !selectedCollectionId || selectedLibraryItemIds.length === 0) {
      return;
    }

    try {
      setBusy(true);
      await api.removeCollectionItems(token, selectedCollectionId, selectedLibraryItemIds);
      setSelectedLibraryItemIds([]);
      const result = await api.collectionItems(token, selectedCollectionId);
      setCollectionItems(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to remove items from collection');
    } finally {
      setBusy(false);
    }
  }

  async function onSelectServer(serverId: string) {
    if (!token) {
      return;
    }

    setSelectedServerId(serverId);
    await loadServerAdminData(token, serverId);
    await loadChannels(token, serverId);
  }

  async function onSelectChannel(channelId: string) {
    if (!token) {
      return;
    }

    setSelectedChannelId(channelId);
    setChannelSettingsOpen(false);
    setCenterPane('chat');
    setSelectedThreadRootId('');
    setThreadMessages([]);
    if (selectedServerId) {
      await loadLibraryAndCollections(token, selectedServerId);
    }
    await loadMessages(token, channelId);
    const unreadResult = await api.unread(token);
    setUnread(unreadResult.unread);
  }

  async function logout() {
    if (refreshToken) {
      try {
        await api.logout({ refreshToken });
      } catch {
        // Client cleanup should continue even if logout call fails.
      }
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken('');
    setRefreshToken('');
    setUser(null);
    setServers([]);
    setChannels([]);
    setMessages([]);
    setPendingMedia([]);
    setSelectedThreadRootId('');
    setThreadMessages([]);
    setThreadComposer('');
    setLinkPreviews({});
    setSearchQuery('');
    setSearchResults([]);
    setLibraryItems([]);
    setCollectionItems([]);
    setCollections([]);
    setCollectionName('');
    setSelectedCollectionId('');
    setSelectedLibraryItemIds([]);
    setLibraryScope('all');
    setLibraryQuery('');
    setLibraryTypeFilter('all');
    setLibraryPosterFilter('all');
    setLibraryTaxonomyFilter('all');
    setLibraryDateFrom('');
    setLibraryDateTo('');
    setLibrarySort('newest');
    setEditingLibraryItem(null);
    setMetadataTitleDraft('');
    setMetadataDescriptionDraft('');
    setMetadataTermsDraft('');
    setDraggingLibraryItemId(null);
    setDragOverLibraryItemId(null);
    setInvites([]);
    setMembers([]);
    setJoinInviteCode('');
    setInviteMaxUses('');
    setInviteExpiresHours('');
    setUserCommands([]);
    setServerCommands([]);
    setSelectedChannelId('');
    setSelectedServerId('');
  }

  async function onCreateUserCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !userCommandForm.command.trim() || !userCommandForm.responseText.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createUserCommand(token, {
        command: userCommandForm.command.trim(),
        responseText: userCommandForm.responseText.trim()
      });
      setUserCommandForm({ command: '', responseText: '' });
      const result = await api.userCommands(token);
      setUserCommands(result.commands);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create user command');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateServerCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedServerId || !serverCommandForm.command.trim() || !serverCommandForm.responseText.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createServerCommand(token, selectedServerId, {
        command: serverCommandForm.command.trim(),
        responseText: serverCommandForm.responseText.trim()
      });
      setServerCommandForm({ command: '', responseText: '' });
      const result = await api.serverCommands(token, selectedServerId);
      setServerCommands(result.commands);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create server command');
    } finally {
      setBusy(false);
    }
  }

  function onOpenLightbox(attachmentId: string) {
    const index = galleryImages.findIndex((image) => image.id === attachmentId);
    if (index >= 0) {
      setLightboxIndex(index);
    }
  }

  function onOpenAccountView(view: 'profile' | 'settings' | 'accessibility') {
    setAccountView(view);
    setCenterPane('account');
    setChannelSettingsOpen(false);
    setAccountMenuOpen(false);
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.updateMe(token, {
        name: profileForm.name.trim(),
        handle: profileForm.handle.trim(),
        email: profileForm.email.trim().toLowerCase(),
        bio: profileForm.bio.trim() || null,
        avatarUrl: profileForm.avatarUrl.trim() || null,
        avatarThumbUrl: profileForm.avatarThumbUrl.trim() || null,
        homeServerId: profileForm.homeServerId || null
      });
      setUser(result.user);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save profile');
    } finally {
      setBusy(false);
    }
  }

  if (!token || !user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <img className="auth-logo" src="/tincan-logo.svg" alt="Tincan logo" />
          <h1>Tincan</h1>
          <p>Private chat for your own people.</p>
          <form autoComplete="off" onSubmit={onAuthSubmit}>
            {mode === 'register' ? (
              <>
                <input
                  placeholder="Name"
                  value={authForm.name}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
                <input
                  placeholder="Handle"
                  value={authForm.handle}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, handle: event.target.value }))}
                  required
                />
              </>
            ) : null}
            <input
              placeholder="Email"
              type="email"
              value={authForm.email}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
            <input
              placeholder="Password"
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
            <button disabled={busy} type="submit">
              {mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
          <button className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
          </button>
          {error ? <pre className="error">{error}</pre> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell size-${uiPrefs.textSize} contrast-${uiPrefs.contrast}`}>
      <aside className="sidebar rail">
        <div className="rail-brand" aria-label="Tincan">
          <img src="/tincan-logo.svg" alt="Tincan logo" />
        </div>
        <nav className="rail-nav">
          <button
            aria-label="Channels"
            className={leftRailTab === 'channels' ? 'item rail-button active' : 'item rail-button'}
            onClick={() => setLeftRailTab('channels')}
            type="button"
          >
            <img className="rail-icon" src="/icon-channels.png" alt="" />
          </button>
          <button
            aria-label="Direct messages"
            className={leftRailTab === 'dms' ? 'item rail-button active' : 'item rail-button'}
            onClick={() => setLeftRailTab('dms')}
            type="button"
          >
            <img className="rail-icon" src="/icon-dms.png" alt="" />
          </button>
          <button
            aria-label="Servers"
            className={leftRailTab === 'servers' ? 'item rail-button active' : 'item rail-button'}
            onClick={() => setLeftRailTab('servers')}
            type="button"
          >
            <img className="rail-icon" src="/icon-servers.png" alt="" />
          </button>
        </nav>
      </aside>

      <aside className="sidebar panel">
        {leftRailTab === 'servers' ? (
          <>
            <header>
              <h2>Servers</h2>
            </header>
            <nav>
              {servers.map((server) => (
                <button
                  className={server.id === selectedServerId ? 'item active' : 'item'}
                  key={server.id}
                  onClick={() => void onSelectServer(server.id)}
                >
                  {server.name}
                </button>
              ))}
            </nav>
            <form autoComplete="off" onSubmit={onCreateServer}>
              <input
                placeholder="New server name"
                value={serverName}
                onChange={(event) => setServerName(event.target.value)}
              />
              <button type="submit">Create</button>
            </form>
            <form autoComplete="off" onSubmit={onJoinInvite}>
              <input
                placeholder="Invite code"
                value={joinInviteCode}
                onChange={(event) => setJoinInviteCode(event.target.value)}
              />
              <button type="submit">Join</button>
            </form>
            <form autoComplete="off" onSubmit={onCreateInvite}>
              <select
                value={inviteRoleToGrant}
                onChange={(event) => setInviteRoleToGrant(event.target.value as 'admin' | 'member')}
              >
                <option value="member">Grant member</option>
                <option value="admin">Grant admin</option>
              </select>
              <input
                placeholder="Max uses (optional)"
                type="number"
                min="1"
                value={inviteMaxUses}
                onChange={(event) => setInviteMaxUses(event.target.value)}
              />
              <input
                placeholder="Expires in hours"
                type="number"
                min="1"
                value={inviteExpiresHours}
                onChange={(event) => setInviteExpiresHours(event.target.value)}
              />
              <button type="submit" disabled={!selectedServerId}>
                Create Invite
              </button>
            </form>
            {invites.length > 0 ? (
              <div className="mini-list">
                {invites.slice(0, 5).map((invite) => (
                  <code key={invite.id}>
                    {invite.code} ({invite.role_to_grant}, {invite.uses_count})
                  </code>
                ))}
              </div>
            ) : null}
            {members.length > 0 ? (
              <div className="mini-list">
                {members.slice(0, 6).map((member) => (
                  <span key={member.user_id}>
                    {member.name} ({member.role})
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        {leftRailTab === 'dms' ? (
          <>
            <header>
              <h2>DMs</h2>
            </header>
            <p className="panel-note">Direct messages are private chats between two people.</p>
            <div className="mini-list">
              {members.length === 0 ? <span>No contacts yet.</span> : null}
              {members.map((member) => (
                <span key={member.user_id}>
                  @{member.handle}
                </span>
              ))}
            </div>
          </>
        ) : null}
        {leftRailTab === 'channels' ? (
          <>
            <header className="channels-header">
              <h2>{selectedServer?.name ?? 'Channels'}</h2>
              <label className="unread-filter-toggle">
                <input
                  checked={showUnreadOnly}
                  onChange={(event) => setShowUnreadOnly(event.target.checked)}
                  type="checkbox"
                />
                <span>Unread only</span>
              </label>
            </header>
            <nav>
              {visibleChannels.length === 0 ? <p className="empty-channel-filter">No unread channels.</p> : null}
              {visibleChannels.map((channel) => {
                const unreadCount = unreadCountByChannel.get(channel.id) ?? 0;
                const statusClass = unreadCount > 0 ? 'unread-channel' : 'read-channel';
                const activeClass = channel.id === selectedChannelId ? ' active' : '';
                return (
                  <button
                    className={`item channel-item ${statusClass}${activeClass}`}
                    key={channel.id}
                    onClick={() => void onSelectChannel(channel.id)}
                  >
                    <span>#{channel.name}</span>
                    {unreadCount > 0 ? <span className="channel-unread-count">{unreadCount}</span> : null}
                  </button>
                );
              })}
            </nav>
            <form autoComplete="off" onSubmit={onCreateChannel}>
              <input
                placeholder="New channel"
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
              />
              <button type="submit">Add</button>
            </form>
          </>
        ) : null}
      </aside>

      <section className="chat">
        <header className="chat-global-header">
          <div className="chat-toolbar">
            <form autoComplete="off" className="chat-search" onSubmit={onSearchMessages}>
              <input
                placeholder="Search messages"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button type="submit">Search</button>
            </form>
            <button
              className={centerPane === 'library' ? '' : 'ghost'}
              onClick={() =>
                setCenterPane((prev) => {
                  const next = prev === 'chat' ? 'library' : 'chat';
                  if (next === 'library') {
                    setChannelSettingsOpen(false);
                  }
                  return next;
                })
              }
              type="button"
            >
              {centerPane === 'chat' ? 'Library' : 'Chat'}
            </button>
          </div>
          <div className="chat-header-actions top-right">
            <div className="account-menu" ref={accountMenuRef}>
              <button
                type="button"
                className={`ghost account-menu-trigger${accountMenuOpen ? ' open' : ''}`}
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="profile-chip">
                  <strong>{user.name}</strong>
                  <span>@{user.handle}</span>
                </span>
                <span className="account-menu-caret">▾</span>
              </button>
              {accountMenuOpen ? (
                <div className="account-dropdown" role="menu">
                  <button type="button" className="ghost mini" onClick={() => onOpenAccountView('profile')}>
                    Profile
                  </button>
                  <button type="button" className="ghost mini" onClick={() => onOpenAccountView('settings')}>
                    Settings
                  </button>
                  <button type="button" className="ghost mini" onClick={() => onOpenAccountView('accessibility')}>
                    Accessibility
                  </button>
                  <button
                    type="button"
                    className="ghost mini"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      void logout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {searchResults.length > 0 ? (
          <div className="chat-search-results">
            <div className="search-results">
              {searchResults.slice(0, 6).map((result) => (
                <article key={result.id} className="search-hit">
                  <strong>{result.author_name}</strong>
                  <span>{result.channel_name}</span>
                  <p>{result.body}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        <header className="chat-header">
          <h2>
            {centerPane === 'library'
              ? 'Library'
              : centerPane === 'account'
                ? accountView === 'profile'
                  ? 'Profile'
                  : accountView === 'settings'
                    ? 'Settings'
                    : 'Accessibility'
                : selectedChannel
                  ? `#${selectedChannel.name}`
                  : 'Pick a channel'}
          </h2>
          {centerPane === 'chat' ? (
            <div className="chat-channel-actions">
              <button
                aria-label="Open channel settings"
                className="ghost mini icon-button"
                disabled={!selectedChannelId}
                onClick={() => setChannelSettingsOpen((prev) => !prev)}
                type="button"
              >
                ⚙
              </button>
            </div>
          ) : null}
        </header>
        {centerPane === 'chat' ? (
          <div
            className={`channel-settings-accordion${channelSettingsOpen ? ' open' : ''}`}
            aria-hidden={!channelSettingsOpen}
          >
            <form autoComplete="off" className="channel-settings-panel" onSubmit={onSaveChannelPreference}>
              <label>
                Mode
                <select
                  value={channelMode}
                  onChange={(event) => setChannelMode(event.target.value as 'hidden' | 'passive' | 'active')}
                >
                  <option value="passive">Passive</option>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <label>
                Snooze (hours)
                <input
                  type="number"
                  min="0"
                  value={channelSnoozeHours}
                  onChange={(event) => setChannelSnoozeHours(event.target.value)}
                />
              </label>
              <button type="submit" disabled={!selectedChannelId}>
                Save
              </button>
            </form>
          </div>
        ) : null}

        {centerPane === 'chat' ? (
          <div className="messages">
          {messages.map((message) => (
            <article key={message.id} className="message">
              <div className="meta">
                <strong>{message.author_name}</strong>
                <span>@{message.author_handle}</span>
                <time>{new Date(message.created_at).toLocaleString()}</time>
              </div>
              <p>{message.body}</p>
              {extractUrls(message.body).length > 0 ? (
                <div className="link-previews">
                  {extractUrls(message.body).map((url) => {
                    const preview = linkPreviews[url];
                    const musicPreview = getMusicPreview(url, preview);
                    const youtubeEmbedUrl = getYouTubeEmbedUrl(url);

                    if (musicPreview) {
                      return (
                        <article className="preview-card music-card" key={`${message.id}-${url}`}>
                          <iframe
                            src={musicPreview.embedUrl}
                            title={preview?.title || `${musicPreview.sourceLabel} player`}
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                          />
                          <div className="preview-copy">
                            <strong>{preview?.title || `${musicPreview.sourceLabel} track`}</strong>
                            {preview?.description ? <span className="preview-description">{preview.description}</span> : null}
                            <div className="music-actions">
                              {musicPreview.actions.map((action, index) => (
                                <a
                                  className={index === 0 ? 'music-play-button' : 'music-play-button ghost'}
                                  href={action.url}
                                  key={`${message.id}-${url}-${action.label}`}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  Play on {action.label}
                                </a>
                              ))}
                            </div>
                          </div>
                        </article>
                      );
                    }

                    if (youtubeEmbedUrl) {
                      return (
                        <article className="preview-card has-video" key={`${message.id}-${url}`}>
                          <iframe
                            src={youtubeEmbedUrl}
                            title={preview?.title || 'YouTube video'}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                          <div className="preview-copy">
                            <strong>{preview?.title || 'YouTube video'}</strong>
                            {preview?.description ? <span className="preview-description">{preview.description}</span> : null}
                            <a className="preview-url-link" href={url} rel="noreferrer" target="_blank">
                              {url}
                            </a>
                          </div>
                        </article>
                      );
                    }

                    return (
                      <a
                        className={preview?.image_url ? 'preview-card has-image' : 'preview-card'}
                        href={url}
                        key={`${message.id}-${url}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {preview?.image_url ? <img src={preview.image_url} alt={preview?.title || 'Link preview image'} /> : null}
                        <div className="preview-copy">
                          <strong>{preview?.title || preview?.site_name || url}</strong>
                          {preview?.description ? <span className="preview-description">{preview.description}</span> : null}
                          <span className="preview-url">{url}</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : null}
              {message.attachments.length > 0 ? (
                <div className="attachments">
                  {message.attachments.map((attachment) =>
                    attachment.mime_type.startsWith('image/') ? (
                      <button
                        aria-label={`Open image ${attachment.original_name}`}
                        className="attachment-image"
                        key={attachment.id}
                        onClick={() => onOpenLightbox(attachment.id)}
                        type="button"
                      >
                        <img src={attachment.public_url} alt={attachment.original_name} />
                      </button>
                    ) : (
                      <a key={attachment.id} href={attachment.public_url} target="_blank" rel="noreferrer">
                        {attachment.original_name}
                      </a>
                    )
                  )}
                </div>
              ) : null}
              {message.reactions.length > 0 ? (
                <div className="reactions">
                  {message.reactions.map((reaction) => (
                    <span key={`${message.id}-${reaction.emoji}`} className="reaction-pill">
                      {reaction.emoji} {reaction.count}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="thread-actions">
                <button className="ghost mini" onClick={() => void onOpenThread(message.id)} type="button">
                  Thread {message.thread_reply_count ? `(${message.thread_reply_count})` : ''}
                </button>
              </div>
            </article>
          ))}
          </div>
        ) : centerPane === 'library' ? (
          <section className="library-workspace">
            <header>
              <h3>Library</h3>
              <p>{filteredLibraryItems.length} item(s) in view</p>
            </header>
            <form autoComplete="off" onSubmit={onCreateCollection}>
              <input
                placeholder="New collection name"
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
              />
              <select
                value={collectionVisibility}
                onChange={(event) => setCollectionVisibility(event.target.value as 'private' | 'public')}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <button type="submit">Create Collection</button>
            </form>
            <div className="library-toolbar">
              <select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)}>
                <option value="">Select collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name} ({collection.visibility})
                  </option>
                ))}
              </select>
              <div className="library-mode-switch">
                <button
                  type="button"
                  className={libraryScope === 'all' ? '' : 'ghost'}
                  onClick={() => setLibraryScope('all')}
                >
                  Browse Library
                </button>
                <button
                  type="button"
                  className={libraryScope === 'collection' ? '' : 'ghost'}
                  disabled={!selectedCollectionId}
                  onClick={() => setLibraryScope('collection')}
                >
                  View Collection
                </button>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={onSelectAllFilteredLibraryItems}
                disabled={filteredLibraryItems.length === 0}
              >
                Select Filtered
              </button>
              <button
                type="button"
                className="ghost"
                onClick={onClearLibrarySelection}
                disabled={selectedLibraryItemIds.length === 0}
              >
                Clear Selection ({selectedLibraryItemIds.length})
              </button>
              <input
                placeholder="Filter library"
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
              />
              <select value={libraryPosterFilter} onChange={(event) => setLibraryPosterFilter(event.target.value)}>
                <option value="all">All posters</option>
                {availablePosterFacets.map((poster) => (
                  <option key={poster.id} value={poster.id}>
                    @{poster.label}
                  </option>
                ))}
              </select>
              <select value={libraryTypeFilter} onChange={(event) => setLibraryTypeFilter(event.target.value as 'all' | 'url' | 'media')}>
                <option value="all">All types</option>
                <option value="url">Links</option>
                <option value="media">Media</option>
              </select>
              <select value={libraryTaxonomyFilter} onChange={(event) => setLibraryTaxonomyFilter(event.target.value)}>
                <option value="all">All taxonomy</option>
                {availableTaxonomyFacets.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
              <input type="date" value={libraryDateFrom} onChange={(event) => setLibraryDateFrom(event.target.value)} />
              <input type="date" value={libraryDateTo} onChange={(event) => setLibraryDateTo(event.target.value)} />
              <input
                placeholder="taxonomy term"
                value={taxonomyQuickInput}
                list="library-taxonomy-terms"
                onChange={(event) => setTaxonomyQuickInput(event.target.value)}
              />
              <datalist id="library-taxonomy-terms">
                {visibleTaxonomySuggestions.map((term) => (
                  <option key={term} value={term} />
                ))}
                {availableTaxonomyFacets.map((term) => (
                  <option key={`facet-${term}`} value={term} />
                ))}
              </datalist>
              <button
                type="button"
                className="ghost"
                onClick={() => void onApplyTaxonomyTerm()}
                disabled={!taxonomyQuickInput.trim() || selectedLibraryItems.length === 0}
              >
                Apply Term To Selected ({selectedLibraryItems.length})
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void onApplyTaxonomyTermToFiltered()}
                disabled={!taxonomyQuickInput.trim() || filteredLibraryItems.length === 0}
              >
                Apply To Filtered ({Math.min(filteredLibraryItems.length, 100)})
              </button>
              <button
                type="button"
                className="ghost"
                onClick={onUseTaxonomyTermAsFilter}
                disabled={!taxonomyQuickInput.trim()}
              >
                Use As Filter
              </button>
              <select
                value={librarySort}
                onChange={(event) => setLibrarySort(event.target.value as 'newest' | 'oldest' | 'title' | 'manual')}
              >
                <option value="newest" disabled={libraryScope === 'collection'}>
                  Newest first
                </option>
                <option value="oldest" disabled={libraryScope === 'collection'}>
                  Oldest first
                </option>
                <option value="title">Title A-Z</option>
                <option value="manual" disabled={libraryScope !== 'collection'}>
                  Manual order
                </option>
              </select>
              {libraryScope === 'all' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onAddSelectedToCollection()}
                    disabled={!selectedCollectionId || selectedLibraryItemIds.length === 0}
                  >
                    Add Selected To Collection
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void onAddFilteredToCollection()}
                    disabled={!selectedCollectionId || filteredLibraryItems.length === 0}
                  >
                    Add Filtered To Collection
                  </button>
                </>
              ) : (
                <button
                  className="ghost"
                  type="button"
                  onClick={() => void onRemoveSelectedFromCollection()}
                  disabled={!selectedCollectionId || selectedLibraryItemIds.length === 0}
                >
                  Remove Selected From Collection
                </button>
              )}
            </div>
            <p className="panel-note library-context-note">
              {libraryScope === 'all'
                ? selectedCollection
                  ? `Browse mode: selecting items from all library. Add actions target "${selectedCollection.name}".`
                  : 'Browse mode: select a target collection to add items.'
                : selectedCollection
                  ? `Collection mode: viewing "${selectedCollection.name}" (${selectedCollection.visibility}). Remove and reorder act inside this collection.`
                  : 'Collection mode: pick a collection to view and curate.'}
            </p>
            <div className="taxonomy-suggestions">
              <span>Suggested terms:</span>
              {visibleTaxonomySuggestions.length > 0 ? (
                visibleTaxonomySuggestions.map((term) => (
                  <button className="ghost mini" key={term} type="button" onClick={() => onTaxonomySuggestionClick(term)}>
                    {term}
                  </button>
                ))
              ) : (
                <span className="panel-note">No suggestions yet.</span>
              )}
            </div>
            <div className="library-list">
              {canReorderCollection ? <p className="panel-note">Drag cards to reorder this collection.</p> : null}
              {filteredLibraryItems.slice(0, 100).map((item) => {
                const thumbnail = getLibraryThumbnail(item);
                const selected = selectedLibraryItemIds.includes(item.id);
                const rawTitle = item.title || item.preview_title || item.url || item.media_url || 'Untitled item';
                const rawDescription = item.description || item.preview_description;
                const title = decodeHtmlEntities(rawTitle);
                const description = decodeHtmlEntities(rawDescription);
                return (
                  <article
                    className={`library-card${selected ? ' selected' : ''}${dragOverLibraryItemId === item.id ? ' drag-over' : ''}`}
                    draggable={canReorderCollection}
                    key={item.id}
                    onDragEnd={onLibraryItemDragEnd}
                    onDragOver={(event) => onLibraryItemDragOver(event, item.id)}
                    onDragStart={(event) => onLibraryItemDragStart(event, item.id)}
                    onDrop={(event) => void onLibraryItemDrop(event, item.id)}
                  >
                    <div className="library-card-head">
                      <label className="library-check">
                        <input
                          checked={selected}
                          onChange={(event) =>
                            setSelectedLibraryItemIds((prev) =>
                              event.target.checked ? [...new Set([...prev, item.id])] : prev.filter((id) => id !== item.id)
                            )
                          }
                          type="checkbox"
                        />
                        <span>{item.item_type === 'url' ? 'Link' : 'Media'}</span>
                      </label>
                      <span className="library-channel">{item.channel_name ? `#${item.channel_name}` : 'Collection item'}</span>
                    </div>
                    <div className="library-card-body">
                      {thumbnail ? (
                        <a href={item.url || item.media_url || '#'} rel="noreferrer" target="_blank" className="library-thumb" draggable={false}>
                          <img src={thumbnail} alt={title} />
                        </a>
                      ) : null}
                      <div className="library-copy">
                        <strong>{title}</strong>
                        {description ? <p>{description}</p> : null}
                        <span className="library-meta">
                          {item.posted_by_handle ? `@${item.posted_by_handle}` : 'unknown poster'}{' '}
                          {item.post_time ? `• ${new Date(item.post_time).toLocaleDateString()}` : ''}
                          {item.source_message_id ? ` • post ${item.source_message_id.slice(0, 8)}` : ''}
                        </span>
                        {(item.taxonomy_terms ?? []).length > 0 ? (
                          <span className="library-tags">{(item.taxonomy_terms ?? []).slice(0, 4).join(' · ')}</span>
                        ) : null}
                        {item.url ? (
                          <a href={item.url} rel="noreferrer" target="_blank">
                            {item.url}
                          </a>
                        ) : null}
                        <button className="ghost mini" type="button" onClick={() => onSetMetadataDraft(item)}>
                          Edit Metadata
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {filteredLibraryItems.length > 100 ? (
                <p className="panel-note">Showing first 100 items. Narrow filters to refine this list.</p>
              ) : null}
              {filteredLibraryItems.length === 0 ? <p className="panel-note">No library items match this view.</p> : null}
              {libraryScope === 'collection' && !selectedCollectionId ? (
                <p className="panel-note">Pick a collection to curate items.</p>
              ) : null}
            </div>
            {editingLibraryItem ? (
              <div className="metadata-editor">
                <h4>Librarian Metadata</h4>
                <p className="panel-note">Suggestions are gray until you save edits.</p>
                <input value={metadataTitleDraft} onChange={(event) => setMetadataTitleDraft(event.target.value)} placeholder="Title" />
                <textarea
                  value={metadataDescriptionDraft}
                  onChange={(event) => setMetadataDescriptionDraft(event.target.value)}
                  placeholder="Description"
                  rows={4}
                />
                <input
                  value={metadataTermsDraft}
                  onChange={(event) => setMetadataTermsDraft(event.target.value)}
                  placeholder="taxonomy terms (comma-separated)"
                />
                <div className="metadata-suggestions">
                  {guessTaxonomySuggestions(editingLibraryItem).map((term) => (
                    <button className="ghost mini" key={term} type="button" onClick={() => onApplySuggestedTerm(term)}>
                      + {term}
                    </button>
                  ))}
                </div>
                <div className="metadata-actions">
                  <button type="button" onClick={() => void onSaveLibraryMetadata()} disabled={busy}>
                    Save Metadata
                  </button>
                  <button className="ghost" type="button" onClick={() => setEditingLibraryItem(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="account-workspace">
            {accountView === 'profile' ? (
              <article className="account-card">
                <h3>Profile</h3>
                <p className="panel-note">This identity appears across your private servers.</p>
                <form autoComplete="off" className="account-profile-form" onSubmit={onSaveProfile}>
                  <div className="account-grid">
                    <label>
                      User ID
                      <input value={user.id} readOnly />
                    </label>
                    <label>
                      Home server ID
                      <select
                        value={profileForm.homeServerId}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, homeServerId: event.target.value }))}
                      >
                        <option value="">None selected</option>
                        {servers.map((server) => (
                          <option key={server.id} value={server.id}>
                            {server.name} ({server.id.slice(0, 8)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Name
                      <input
                        value={profileForm.name}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Handle
                      <input
                        value={profileForm.handle}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, handle: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Avatar URL (full size)
                      <input
                        type="url"
                        value={profileForm.avatarUrl}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                        placeholder="https://..."
                      />
                    </label>
                    <label>
                      Avatar URL (thumb)
                      <input
                        type="url"
                        value={profileForm.avatarThumbUrl}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, avatarThumbUrl: event.target.value }))}
                        placeholder="https://..."
                      />
                    </label>
                    <label className="account-grid-full">
                      Bio
                      <textarea
                        rows={4}
                        value={profileForm.bio}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))}
                        placeholder="Tell your friends who you are."
                      />
                    </label>
                  </div>
                  <div className="metadata-actions">
                    <button type="submit" disabled={busy}>
                      Save Profile
                    </button>
                  </div>
                </form>
                <div className="profile-photos">
                  <h4>Profile Photos</h4>
                  <p className="panel-note">Images you posted to this server library (tagged by your user id).</p>
                  <div className="profile-photo-grid">
                    {profilePhotos.map((item) => (
                      <a key={item.id} href={item.media_url || '#'} target="_blank" rel="noreferrer">
                        <img src={item.media_url || ''} alt={item.title || item.id} />
                      </a>
                    ))}
                    {profilePhotos.length === 0 ? <span className="panel-note">No profile photos yet.</span> : null}
                  </div>
                </div>
              </article>
            ) : null}

            {accountView === 'settings' ? (
              <article className="account-card">
                <h3>Workspace Settings</h3>
                <p className="panel-note">Quick controls for how your workspace is currently displayed.</p>
                <div className="account-grid">
                  <label>
                    Open center workspace
                    <select
                      value={centerPane === 'account' ? 'chat' : centerPane}
                      onChange={(event) => setCenterPane(event.target.value as 'chat' | 'library')}
                    >
                      <option value="chat">Chat</option>
                      <option value="library">Library</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={showUnreadOnly}
                      onChange={(event) => setShowUnreadOnly(event.target.checked)}
                    />
                    <span>Keep channels panel on unread-only mode</span>
                  </label>
                </div>
              </article>
            ) : null}

            {accountView === 'accessibility' ? (
              <article className="account-card">
                <h3>Accessibility</h3>
                <p className="panel-note">
                  {uiPrefs.onboarded
                    ? 'Adjust your text size and contrast at any time.'
                    : 'Welcome. Choose text size and contrast for your workspace.'}
                </p>
                <div className="account-grid">
                  <label>
                    Text size
                    <select
                      value={uiPrefs.textSize}
                      onChange={(event) =>
                        setUiPrefs((prev) => ({
                          ...prev,
                          textSize: event.target.value as UiPrefs['textSize']
                        }))
                      }
                    >
                      <option value="compact">Compact</option>
                      <option value="comfortable">Comfortable</option>
                      <option value="large">Large</option>
                    </select>
                  </label>
                  <label>
                    Contrast mode
                    <select
                      value={uiPrefs.contrast}
                      onChange={(event) =>
                        setUiPrefs((prev) => ({
                          ...prev,
                          contrast: event.target.value as UiPrefs['contrast']
                        }))
                      }
                    >
                      <option value="default">Default</option>
                      <option value="high">High contrast</option>
                      <option value="soft">Soft contrast</option>
                      <option value="rg-safe">Red/Green colorblind safe</option>
                    </select>
                  </label>
                </div>
                <div className="metadata-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setUiPrefs((prev) => ({
                        ...prev,
                        onboarded: true
                      }))
                    }
                  >
                    Save Accessibility Preferences
                  </button>
                </div>
              </article>
            ) : null}
          </section>
        )}

        {centerPane === 'chat' ? (
          <form autoComplete="off" className="composer" onSubmit={onSendMessage}>
          <div className="composer-main">
            <input
              placeholder="Write a message"
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
            />
            <input type="file" onChange={onUploadFile} disabled={!selectedChannelId || busy} />
          </div>
          <button
            type="submit"
            disabled={!selectedChannelId || busy || (composer.trim().length === 0 && pendingMedia.length === 0)}
          >
            Send
          </button>
          {pendingMedia.length > 0 ? (
            <div className="pending-media">
              {pendingMedia.map((media) => (
                <span key={media.id}>{media.original_name}</span>
              ))}
            </div>
          ) : null}
          </form>
        ) : null}
      </section>

      <aside className="sidebar unread">
        <details className="commands-panel">
          <summary>My Commands</summary>
          <form autoComplete="off" onSubmit={onCreateUserCommand}>
            <input
              placeholder="/command"
              value={userCommandForm.command}
              onChange={(event) => setUserCommandForm((prev) => ({ ...prev, command: event.target.value }))}
            />
            <input
              placeholder="Response text (use {{args}})"
              value={userCommandForm.responseText}
              onChange={(event) => setUserCommandForm((prev) => ({ ...prev, responseText: event.target.value }))}
            />
            <button type="submit">Save</button>
          </form>
          <div className="command-list">
            {userCommands.map((command) => (
              <code key={command.id}>/{command.command}</code>
            ))}
          </div>
        </details>
        <details className="commands-panel">
          <summary>Server Commands</summary>
          <form autoComplete="off" onSubmit={onCreateServerCommand}>
            <input
              placeholder="/command"
              value={serverCommandForm.command}
              onChange={(event) => setServerCommandForm((prev) => ({ ...prev, command: event.target.value }))}
            />
            <input
              placeholder="Response text (use {{args}})"
              value={serverCommandForm.responseText}
              onChange={(event) => setServerCommandForm((prev) => ({ ...prev, responseText: event.target.value }))}
            />
            <button type="submit" disabled={!selectedServerId}>
              Save
            </button>
          </form>
          <div className="command-list">
            {serverCommands.map((command) => (
              <code key={command.id}>/{command.command}</code>
            ))}
          </div>
        </details>
        {selectedThreadRootId ? (
          <details className="commands-panel thread-panel" open>
            <summary>Thread</summary>
            <div className="thread-list">
              {threadMessages.map((message) => (
                <article key={message.id} className="thread-message">
                  <strong>{message.author_name}</strong>
                  <p>{message.body}</p>
                </article>
              ))}
            </div>
            <form autoComplete="off" onSubmit={onSendThreadMessage}>
              <input
                placeholder="Reply in thread"
                value={threadComposer}
                onChange={(event) => setThreadComposer(event.target.value)}
              />
              <button type="submit" disabled={busy}>
                Reply
              </button>
            </form>
          </details>
        ) : null}
      </aside>

      {lightboxIndex !== null && galleryImages[lightboxIndex] ? (
        <div className="lightbox-overlay" onClick={() => setLightboxIndex(null)}>
          <div className="lightbox-modal" onClick={(event) => event.stopPropagation()}>
            <div className="lightbox-header">
              <div>
                <strong>{galleryImages[lightboxIndex].original_name}</strong>
                <p>
                  {galleryImages[lightboxIndex].messageAuthor} ·{' '}
                  {new Date(galleryImages[lightboxIndex].messageCreatedAt).toLocaleString()}
                </p>
              </div>
              <button className="ghost mini" onClick={() => setLightboxIndex(null)} type="button">
                Close
              </button>
            </div>
            <div className="lightbox-stage">
              {galleryImages.length > 1 ? (
                <button
                  aria-label="Previous image"
                  className="ghost mini lightbox-nav"
                  onClick={() =>
                    setLightboxIndex((prev) => (prev === null ? prev : (prev - 1 + galleryImages.length) % galleryImages.length))
                  }
                  type="button"
                >
                  ‹
                </button>
              ) : (
                <span />
              )}
              <img
                className="lightbox-image"
                src={galleryImages[lightboxIndex].public_url}
                alt={galleryImages[lightboxIndex].original_name}
              />
              {galleryImages.length > 1 ? (
                <button
                  aria-label="Next image"
                  className="ghost mini lightbox-nav"
                  onClick={() => setLightboxIndex((prev) => (prev === null ? prev : (prev + 1) % galleryImages.length))}
                  type="button"
                >
                  ›
                </button>
              ) : (
                <span />
              )}
            </div>
            {galleryImages.length > 1 ? (
              <p className="lightbox-index">
                {lightboxIndex + 1} / {galleryImages.length}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <pre className="error floating">{error}</pre> : null}
    </main>
  );
}
