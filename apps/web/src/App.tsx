import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import { api } from './api';

type User = {
  id: string;
  email: string;
  handle: string;
  name: string;
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
  url?: string | null;
  title?: string | null;
  description?: string | null;
  media_url?: string | null;
  preview_image_url?: string | null;
  preview_title?: string | null;
  preview_description?: string | null;
  channel_name?: string;
  created_at?: string;
};

const TOKEN_KEY = 'tincan_token';
const REFRESH_TOKEN_KEY = 'tincan_refresh_token';

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches)];
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

type MusicPreview = {
  embedUrl: string;
  sourceLabel: 'Spotify' | 'Apple Music';
  sourcePlayUrl: string;
  alternateLabel: 'Spotify' | 'Apple Music';
  alternatePlayUrl: string;
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
  const spotifyTrackId = getSpotifyTrackId(url);
  if (spotifyTrackId) {
    const query = encodeURIComponent(preview?.title || preview?.description || 'song');
    return {
      embedUrl: `https://open.spotify.com/embed/track/${spotifyTrackId}`,
      sourceLabel: 'Spotify',
      sourcePlayUrl: `https://open.spotify.com/track/${spotifyTrackId}`,
      alternateLabel: 'Apple Music',
      alternatePlayUrl: `https://music.apple.com/us/search?term=${query}`
    };
  }

  const appleInfo = getAppleMusicTrackInfo(url);
  if (appleInfo) {
    const parsed = new URL(url);
    const query = encodeURIComponent(preview?.title || preview?.description || 'song');
    return {
      embedUrl: `https://embed.music.apple.com/${appleInfo.country}${parsed.pathname}?i=${appleInfo.trackId}`,
      sourceLabel: 'Apple Music',
      sourcePlayUrl: url,
      alternateLabel: 'Spotify',
      alternatePlayUrl: `https://open.spotify.com/search/${query}`
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
  const [centerPane, setCenterPane] = useState<'chat' | 'library'>('chat');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [leftRailTab, setLeftRailTab] = useState<'servers' | 'dms' | 'channels'>('servers');
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

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [servers, selectedServerId]
  );

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
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

  const activeLibraryItems = useMemo(
    () => (libraryScope === 'collection' && selectedCollectionId ? collectionItems : libraryItems),
    [libraryScope, selectedCollectionId, collectionItems, libraryItems]
  );
  const canReorderCollection = libraryScope === 'collection' && !!selectedCollectionId && librarySort === 'manual';

  const filteredLibraryItems = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();

    const filtered = activeLibraryItems.filter((item) => {
      if (libraryTypeFilter !== 'all' && item.item_type !== libraryTypeFilter) {
        return false;
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
  }, [activeLibraryItems, libraryQuery, libraryTypeFilter, librarySort, libraryScope]);

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
      await loadLibraryAndCollections(nextToken, serverId, firstChannel.id);
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

  async function loadLibraryAndCollections(nextToken: string, serverId: string, channelId?: string) {
    const [libraryResult, collectionResult] = await Promise.all([
      api.libraryItems(nextToken, serverId, channelId),
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
      setError(cause instanceof Error ? cause.message : 'Failed to save collection order');
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

  function onClearLibrarySelection() {
    setSelectedLibraryItemIds([]);
  }

  function onLibraryItemDragStart(itemId: string) {
    if (!canReorderCollection) {
      return;
    }
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
      await loadLibraryAndCollections(token, selectedServerId, selectedChannelId || undefined);
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
      await loadLibraryAndCollections(token, selectedServerId, channelId);
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
    setLibrarySort('newest');
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

  if (!token || !user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
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
    <main className="app-shell">
      <aside className="sidebar rail">
        <nav className="rail-nav">
          <button
            aria-label="Servers"
            className={leftRailTab === 'servers' ? 'item rail-button active' : 'item rail-button'}
            onClick={() => setLeftRailTab('servers')}
            type="button"
          >
            S
          </button>
          <button
            aria-label="Direct messages"
            className={leftRailTab === 'dms' ? 'item rail-button active' : 'item rail-button'}
            onClick={() => setLeftRailTab('dms')}
            type="button"
          >
            DM
          </button>
          <button
            aria-label="Channels"
            className={leftRailTab === 'channels' ? 'item rail-button active' : 'item rail-button'}
            onClick={() => setLeftRailTab('channels')}
            type="button"
          >
            #
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
              onClick={() => setCenterPane(centerPane === 'chat' ? 'library' : 'chat')}
              type="button"
            >
              {centerPane === 'chat' ? 'Library' : 'Chat'}
            </button>
          </div>
          <div className="chat-header-actions top-right">
            <div className="profile-chip">
              <strong>{user.name}</strong>
              <span>@{user.handle}</span>
            </div>
            <button className="ghost" onClick={() => void logout()}>
              Logout
            </button>
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
          <h2>{selectedChannel ? `#${selectedChannel.name}` : 'Pick a channel'}</h2>
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
        </header>
        {channelSettingsOpen ? (
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
                              <a className="music-play-button" href={musicPreview.sourcePlayUrl} rel="noreferrer" target="_blank">
                                Play on {musicPreview.sourceLabel}
                              </a>
                              <a className="music-play-button ghost" href={musicPreview.alternatePlayUrl} rel="noreferrer" target="_blank">
                                Play on {musicPreview.alternateLabel}
                              </a>
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
        ) : (
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
              <select value={libraryScope} onChange={(event) => setLibraryScope(event.target.value as 'all' | 'collection')}>
                <option value="all">All library</option>
                <option value="collection" disabled={!selectedCollectionId}>
                  Selected collection
                </option>
              </select>
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
              <select value={libraryTypeFilter} onChange={(event) => setLibraryTypeFilter(event.target.value as 'all' | 'url' | 'media')}>
                <option value="all">All types</option>
                <option value="url">Links</option>
                <option value="media">Media</option>
              </select>
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
              <button
                type="button"
                onClick={() => void onAddSelectedToCollection()}
                disabled={!selectedCollectionId || selectedLibraryItemIds.length === 0}
              >
                Add Selected
              </button>
              <button
                className="ghost"
                type="button"
                onClick={() => void onRemoveSelectedFromCollection()}
                disabled={!selectedCollectionId || libraryScope !== 'collection' || selectedLibraryItemIds.length === 0}
              >
                Remove Selected
              </button>
            </div>
            <div className="library-list">
              {canReorderCollection ? <p className="panel-note">Drag cards to reorder this collection.</p> : null}
              {filteredLibraryItems.slice(0, 100).map((item) => {
                const thumbnail = getLibraryThumbnail(item);
                const selected = selectedLibraryItemIds.includes(item.id);
                const title = item.title || item.preview_title || item.url || item.media_url || 'Untitled item';
                const description = item.description || item.preview_description;
                return (
                  <article
                    className={`library-card${selected ? ' selected' : ''}${dragOverLibraryItemId === item.id ? ' drag-over' : ''}`}
                    draggable={canReorderCollection}
                    key={item.id}
                    onDragEnd={onLibraryItemDragEnd}
                    onDragOver={(event) => onLibraryItemDragOver(event, item.id)}
                    onDragStart={() => onLibraryItemDragStart(item.id)}
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
                        {item.url ? (
                          <a href={item.url} rel="noreferrer" target="_blank">
                            {item.url}
                          </a>
                        ) : null}
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
