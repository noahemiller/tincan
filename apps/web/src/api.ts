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
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
    request<{ channels: { id: string; name: string; slug: string }[] }>(`/api/servers/${serverId}/channels`, {}, token),
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
        author_handle: string;
        author_name: string;
        created_at: string;
        reactions: { emoji: string; count: number }[];
      }[];
    }>(`/api/channels/${channelId}/messages`, {}, token),
  createMessage: (token: string, channelId: string, payload: { body: string }) =>
    request<{ message: { id: string } }>(
      `/api/channels/${channelId}/messages`,
      { method: 'POST', body: JSON.stringify(payload) },
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
