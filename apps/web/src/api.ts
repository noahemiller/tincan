const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type AuthResult = {
  token: string;
  user: {
    id: string;
    email: string;
    handle: string;
    name: string;
    avatar_url?: string | null;
    bio?: string | null;
  };
};

export async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export const api = {
  register: (payload: { email: string; password: string; name: string; handle: string }) =>
    request<AuthResult>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) =>
    request<AuthResult>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: (token: string) => request<{ user: AuthResult['user'] }>('/api/me', {}, token),
  servers: (token: string) => request<{ servers: { id: string; name: string; slug: string }[] }>('/api/servers', {}, token),
  createServer: (token: string, payload: { name: string }) =>
    request<{ server: { id: string; name: string; slug: string } }>(
      '/api/servers',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  channels: (token: string, serverId: string) =>
    request<{
      channels: {
        id: string;
        name: string;
        slug: string;
        notification_mode: 'hidden' | 'passive' | 'active';
        snoozed_until?: string | null;
      }[];
    }>(`/api/servers/${serverId}/channels`, {}, token),
  createChannel: (token: string, serverId: string, payload: { name: string; topic?: string }) =>
    request<{ channel: { id: string; name: string; slug: string } }>(
      `/api/servers/${serverId}/channels`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  messages: (token: string, channelId: string) =>
    request<{
      messages: {
        id: string;
        body: string;
        thread_root_message_id?: string | null;
        thread_reply_count?: number;
        author_handle: string;
        author_name: string;
        created_at: string;
        reactions: { emoji: string; count: number }[];
        attachments: { id: string; mime_type: string; original_name: string; public_url: string }[];
      }[];
    }>(`/api/channels/${channelId}/messages`, {}, token),
  createMessage: (token: string, channelId: string, payload: { body: string; mediaItemIds?: string[] }) =>
    request<{ message: { id: string } }>(
      `/api/channels/${channelId}/messages`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  uploadToChannel: (token: string, channelId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return request<{ media: { id: string; public_url: string; mime_type: string; original_name: string } }>(
      `/api/channels/${channelId}/uploads`,
      {
        method: 'POST',
        body: formData,
        headers: {}
      },
      token
    );
  },
  threadMessages: (token: string, messageId: string) =>
    request<{
      messages: {
        id: string;
        body: string;
        author_handle: string;
        author_name: string;
        created_at: string;
        attachments: { id: string; mime_type: string; original_name: string; public_url: string }[];
      }[];
    }>(`/api/messages/${messageId}/thread/messages`, {}, token),
  createThreadMessage: (token: string, messageId: string, payload: { body: string; mediaItemIds?: string[] }) =>
    request<{ message: { id: string } }>(
      `/api/messages/${messageId}/thread/messages`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  channelPreference: (token: string, channelId: string) =>
    request<{ preference: { mode: 'hidden' | 'passive' | 'active'; snoozed_until?: string | null } }>(
      `/api/channels/${channelId}/preferences`,
      {},
      token
    ),
  updateChannelPreference: (
    token: string,
    channelId: string,
    payload: { mode: 'hidden' | 'passive' | 'active'; snoozedUntil?: string | null }
  ) =>
    request<{ ok: boolean }>(
      `/api/channels/${channelId}/preferences`,
      { method: 'PUT', body: JSON.stringify(payload) },
      token
    ),
  fetchLinkPreviews: (token: string, urls: string[]) =>
    request<{
      previews: {
        url: string;
        title?: string | null;
        description?: string | null;
        image_url?: string | null;
        site_name?: string | null;
      }[];
    }>('/api/link-previews/batch', { method: 'POST', body: JSON.stringify({ urls }) }, token),
  searchMessages: (token: string, payload: { q: string; serverId?: string; channelId?: string }) => {
    const params = new URLSearchParams({ q: payload.q });
    if (payload.serverId) {
      params.set('serverId', payload.serverId);
    }
    if (payload.channelId) {
      params.set('channelId', payload.channelId);
    }
    return request<{
      results: {
        id: string;
        body: string;
        created_at: string;
        author_name: string;
        author_handle: string;
        channel_name: string;
        server_name: string;
      }[];
    }>(`/api/search/messages?${params.toString()}`, {}, token);
  },
  libraryItems: (token: string, serverId: string, channelId?: string) => {
    const params = new URLSearchParams({ serverId });
    if (channelId) {
      params.set('channelId', channelId);
    }
    return request<{
      items: {
        id: string;
        item_type: 'url' | 'media';
        url?: string | null;
        title?: string | null;
        description?: string | null;
        media_url?: string | null;
        channel_name: string;
      }[];
    }>(`/api/library/items?${params.toString()}`, {}, token);
  },
  collections: (token: string, serverId: string) =>
    request<{
      collections: { id: string; name: string; visibility: 'private' | 'public'; created_at: string }[];
    }>(`/api/library/collections?serverId=${serverId}`, {}, token),
  createCollection: (token: string, payload: { serverId: string; name: string; visibility: 'private' | 'public' }) =>
    request<{ collection: { id: string; name: string; visibility: 'private' | 'public' } }>(
      '/api/library/collections',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  addCollectionItems: (token: string, collectionId: string, libraryItemIds: string[]) =>
    request<{ added: number }>(
      `/api/library/collections/${collectionId}/items`,
      { method: 'POST', body: JSON.stringify({ libraryItemIds }) },
      token
    ),
  userCommands: (token: string) =>
    request<{ commands: { id: string; command: string; response_text: string }[] }>('/api/me/commands', {}, token),
  createUserCommand: (token: string, payload: { command: string; responseText: string }) =>
    request<{ command: { id: string; command: string; response_text: string } }>(
      '/api/me/commands',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  serverCommands: (token: string, serverId: string) =>
    request<{ commands: { id: string; command: string; response_text: string }[] }>(
      `/api/servers/${serverId}/commands`,
      {},
      token
    ),
  createServerCommand: (token: string, serverId: string, payload: { command: string; responseText: string }) =>
    request<{ command: { id: string; command: string; response_text: string } }>(
      `/api/servers/${serverId}/commands`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  unread: (token: string) =>
    request<{
      unread: {
        channel_id: string;
        channel_name: string;
        server_id: string;
        server_name: string;
        unread_count: number;
      }[];
    }>('/api/unread', {}, token)
};
