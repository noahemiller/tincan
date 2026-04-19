const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type AuthResult = {
  token: string;
  accessToken?: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    handle: string;
    name: string;
    avatar_url?: string | null;
    avatar_thumb_url?: string | null;
    home_server_id?: string | null;
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
  refresh: (payload: { refreshToken: string }) =>
    request<AuthResult>('/api/auth/refresh', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload: { email: string }) =>
    request<{ ok: boolean; resetToken?: string; expiresAt?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  resetPassword: (payload: { token: string; newPassword: string }) =>
    request<{ ok: boolean }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
  changePassword: (token: string, payload: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }, token),
  logout: (payload: { refreshToken: string }) =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: JSON.stringify(payload) }),
  logoutAll: (token: string) => request<{ ok: boolean }>('/api/auth/logout-all', { method: 'POST', body: '{}' }, token),
  me: (token: string) => request<{ user: AuthResult['user'] }>('/api/me', {}, token),
  updateMe: (
    token: string,
    payload: {
      name?: string;
      handle?: string;
      email?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      avatarThumbUrl?: string | null;
      homeServerId?: string | null;
    }
  ) =>
    (async () => {
      const body = JSON.stringify(payload);
      const attempts: { path: string; method: 'PATCH' | 'PUT' | 'POST' }[] = [
        { path: '/api/me', method: 'PATCH' },
        { path: '/api/me', method: 'PUT' },
        { path: '/api/me/profile', method: 'POST' }
      ];
      let lastError: Error | null = null;
      for (const attempt of attempts) {
        try {
          return await request<{ user: AuthResult['user'] }>(attempt.path, { method: attempt.method, body }, token);
        } catch (cause) {
          lastError = cause instanceof Error ? cause : new Error('Failed to update profile');
        }
      }
      throw lastError ?? new Error('Failed to update profile');
    })(),
  profilePhotos: (token: string) =>
    request<{
      photos: { id: string; original_name: string; mime_type: string; public_url: string; created_at: string }[];
    }>('/api/me/profile-photos', {}, token),
  uploadProfilePhoto: (token: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ photo: { id: string; original_name: string; mime_type: string; public_url: string; created_at: string } }>(
      '/api/me/profile-photos',
      { method: 'POST', body: formData, headers: {} },
      token
    );
  },
  servers: (token: string) =>
    request<{ servers: { id: string; name: string; slug: string; role: 'owner' | 'admin' | 'member' }[] }>(
      '/api/servers',
      {},
      token
    ),
  createServer: (token: string, payload: { name: string }) =>
    request<{ server: { id: string; name: string; slug: string } }>(
      '/api/servers',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  serverMembers: (token: string, serverId: string) =>
    request<{ members: { user_id: string; handle: string; name: string; role: 'owner' | 'admin' | 'member' }[] }>(
      `/api/servers/${serverId}/members`,
      {},
      token
    ),
  updateMemberRole: (token: string, serverId: string, memberUserId: string, role: 'admin' | 'member') =>
    request<{ ok: boolean }>(
      `/api/servers/${serverId}/members/${memberUserId}/role`,
      { method: 'PUT', body: JSON.stringify({ role }) },
      token
    ),
  invites: (token: string, serverId: string) =>
    request<{
      invites: {
        id: string;
        code: string;
        role_to_grant: 'admin' | 'member';
        max_uses?: number | null;
        uses_count: number;
        expires_at?: string | null;
        revoked_at?: string | null;
      }[];
    }>(`/api/servers/${serverId}/invites`, {}, token),
  createInvite: (
    token: string,
    serverId: string,
    payload: { roleToGrant?: 'admin' | 'member'; maxUses?: number; expiresInHours?: number }
  ) =>
    request<{
      invite: { id: string; code: string; role_to_grant: 'admin' | 'member'; max_uses?: number | null; uses_count: number };
    }>(`/api/servers/${serverId}/invites`, { method: 'POST', body: JSON.stringify(payload) }, token),
  revokeInvite: (token: string, serverId: string, inviteId: string) =>
    request<{ ok: boolean }>(`/api/servers/${serverId}/invites/${inviteId}`, { method: 'DELETE' }, token),
  inviteInfo: (token: string, code: string) =>
    request<{
      invite: { code: string; server_id: string; server_name: string; role_to_grant: 'admin' | 'member'; is_member: boolean };
    }>(`/api/invites/${code}`, {}, token),
  acceptInvite: (token: string, code: string) =>
    request<{ ok: boolean; serverId: string }>(`/api/invites/${code}/accept`, { method: 'POST', body: '{}' }, token),
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
  updateChannel: (token: string, channelId: string, payload: { name: string }) =>
    request<{ channel: { id: string; name: string; slug: string; topic?: string | null } }>(
      `/api/channels/${channelId}`,
      { method: 'PUT', body: JSON.stringify(payload) },
      token
    ),
  messages: (token: string, channelId: string) =>
    request<{
      messages: {
        id: string;
        body: string;
        thread_root_message_id?: string | null;
        thread_reply_count?: number;
        author_user_id: string;
        author_handle: string;
        author_name: string;
        author_avatar_url?: string | null;
        edited_at?: string | null;
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
  updateMessage: (token: string, messageId: string, payload: { body: string }) =>
    request<{ message: { id: string; body: string; edited_at?: string | null } }>(
      `/api/messages/${messageId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
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
        author_avatar_url?: string | null;
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
  dmConversations: (token: string) =>
    request<{
      conversations: {
        id: string;
        other_user_id: string;
        other_handle: string;
        other_name: string;
        other_avatar_url?: string | null;
        unread_count: number;
        last_message_at?: string | null;
      }[];
    }>('/api/dms', {}, token),
  createDmConversation: (token: string, payload: { handle: string }) =>
    request<{
      conversation: {
        id: string;
        other_user_id: string;
        other_handle: string;
        other_name: string;
        other_avatar_url?: string | null;
        unread_count: number;
      };
    }>('/api/dms', { method: 'POST', body: JSON.stringify(payload) }, token),
  dmMessages: (token: string, conversationId: string) =>
    request<{
      messages: {
        id: string;
        body: string;
        author_user_id: string;
        author_handle: string;
        author_name: string;
        author_avatar_url?: string | null;
        edited_at?: string | null;
        created_at: string;
        reactions: { emoji: string; count: number }[];
        attachments: { id: string; mime_type: string; original_name: string; public_url: string }[];
        thread_root_message_id?: string | null;
        thread_reply_count?: number;
      }[];
    }>(`/api/dms/${conversationId}/messages`, {}, token),
  createDmMessage: (token: string, conversationId: string, payload: { body: string }) =>
    request<{ message: { id: string } }>(
      `/api/dms/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
  markDmRead: (token: string, conversationId: string, payload?: { lastReadMessageId?: string }) =>
    request<{ ok: boolean }>(
      `/api/dms/${conversationId}/read`,
      { method: 'POST', body: JSON.stringify(payload ?? {}) },
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
  markChannelRead: (token: string, channelId: string, payload?: { lastReadMessageId?: string }) =>
    request<{ ok: boolean }>(
      `/api/channels/${channelId}/read`,
      { method: 'POST', body: JSON.stringify(payload ?? {}) },
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
        source_message_id?: string | null;
        post_time: string;
        posted_by_user_id: string;
        posted_by_handle: string;
        posted_by_name: string;
        url?: string | null;
        title?: string | null;
        description?: string | null;
        taxonomy_terms: string[];
        media_url?: string | null;
        preview_image_url?: string | null;
        preview_title?: string | null;
        preview_description?: string | null;
        channel_name: string;
        created_at: string;
      }[];
    }>(`/api/library/items?${params.toString()}`, {}, token);
  },
  updateLibraryItem: (
    token: string,
    itemId: string,
    payload: { title?: string | null; description?: string | null; taxonomyTerms?: string[] }
  ) =>
    (async () => {
      const body = JSON.stringify(payload);
      const attempts: { path: string; method: 'PATCH' | 'PUT' | 'POST' }[] = [
        { path: `/api/library/items/${itemId}`, method: 'PATCH' },
        { path: `/api/library/items/${itemId}`, method: 'PUT' },
        { path: `/api/library/items/${itemId}/metadata`, method: 'POST' }
      ];

      let lastError: Error | null = null;
      for (const attempt of attempts) {
        try {
          return await request<{ item: { id: string; title?: string | null; description?: string | null; taxonomy_terms: string[] } }>(
            attempt.path,
            { method: attempt.method, body },
            token
          );
        } catch (cause) {
          lastError = cause instanceof Error ? cause : new Error('Failed to update library item');
          // Continue to fallback aliases for 404/method mismatch or proxy behavior differences.
        }
      }
      if (
        lastError?.message.includes('Route') &&
        lastError.message.includes('/api/library/items/') &&
        lastError.message.includes('not found')
      ) {
        throw new Error('API metadata update route unavailable (all aliases returned 404). Restart/rebuild API service.');
      }
      throw lastError ?? new Error('Failed to update library item');
    })(),
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
  removeCollectionItems: (token: string, collectionId: string, libraryItemIds: string[]) =>
    request<{ removed: number }>(
      `/api/library/collections/${collectionId}/items`,
      { method: 'DELETE', body: JSON.stringify({ libraryItemIds }) },
      token
    ),
  collectionItems: (token: string, collectionId: string) =>
    request<{
      items: {
        id: string;
        item_type: 'url' | 'media';
        source_message_id?: string | null;
        post_time: string;
        posted_by_user_id: string;
        posted_by_handle: string;
        posted_by_name: string;
        url?: string | null;
        title?: string | null;
        description?: string | null;
        taxonomy_terms: string[];
        media_url?: string | null;
        preview_image_url?: string | null;
        preview_title?: string | null;
        preview_description?: string | null;
        channel_name?: string;
        created_at: string;
      }[];
    }>(`/api/library/collections/${collectionId}/items`, {}, token),
  reorderCollectionItems: (token: string, collectionId: string, libraryItemIds: string[]) =>
    request<{ updated: number }>(
      `/api/library/collections/${collectionId}/items/order`,
      { method: 'PATCH', body: JSON.stringify({ libraryItemIds }) },
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
        mention_count?: number;
      }[];
    }>('/api/unread', {}, token)
};
