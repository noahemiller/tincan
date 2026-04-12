import { FormEvent, useEffect, useMemo, useState } from 'react';

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
};

type Channel = {
  id: string;
  name: string;
  slug: string;
};

type Message = {
  id: string;
  body: string;
  author_handle: string;
  author_name: string;
  created_at: string;
  reactions: { emoji: string; count: number }[];
};

type Command = {
  id: string;
  command: string;
  response_text: string;
};

const TOKEN_KEY = 'tincan_token';

export function App() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
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

  useEffect(() => {
    if (!token) {
      return;
    }

    void bootstrap(token);
  }, [token]);

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
        const firstServer = serverResult.servers[0];
        setSelectedServerId(firstServer.id);
        await loadChannels(nextToken, firstServer.id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load session');
      logout();
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
      const firstChannel = channelResult.channels[0];
      setSelectedChannelId(firstChannel.id);
      await loadMessages(nextToken, firstChannel.id);
    } else {
      setSelectedChannelId('');
      setMessages([]);
    }
  }

  async function loadMessages(nextToken: string, channelId: string) {
    const messageResult = await api.messages(nextToken, channelId);
    setMessages(messageResult.messages);
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

      localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
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

  async function onSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedChannelId || !composer.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createMessage(token, selectedChannelId, { body: composer.trim() });
      setComposer('');
      await loadMessages(token, selectedChannelId);
      const unreadResult = await api.unread(token);
      setUnread(unreadResult.unread);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send message');
    } finally {
      setBusy(false);
    }
  }

  async function onSelectServer(serverId: string) {
    if (!token) {
      return;
    }

    setSelectedServerId(serverId);
    await loadChannels(token, serverId);
  }

  async function onSelectChannel(channelId: string) {
    if (!token) {
      return;
    }

    setSelectedChannelId(channelId);
    await loadMessages(token, channelId);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setUser(null);
    setServers([]);
    setChannels([]);
    setMessages([]);
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

  if (!token || !user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Tincan</h1>
          <p>Private chat for your own people.</p>
          <form onSubmit={onAuthSubmit}>
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
      <aside className="sidebar servers">
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
        <form onSubmit={onCreateServer}>
          <input
            placeholder="New server name"
            value={serverName}
            onChange={(event) => setServerName(event.target.value)}
          />
          <button type="submit">Create</button>
        </form>
      </aside>

      <aside className="sidebar channels">
        <header>
          <h2>{selectedServer?.name ?? 'Channels'}</h2>
        </header>
        <nav>
          {channels.map((channel) => (
            <button
              className={channel.id === selectedChannelId ? 'item active' : 'item'}
              key={channel.id}
              onClick={() => void onSelectChannel(channel.id)}
            >
              #{channel.name}
            </button>
          ))}
        </nav>
        <form onSubmit={onCreateChannel}>
          <input
            placeholder="New channel"
            value={channelName}
            onChange={(event) => setChannelName(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </aside>

      <section className="chat">
        <header className="chat-header">
          <h2>{selectedChannel ? `#${selectedChannel.name}` : 'Pick a channel'}</h2>
          <button className="ghost" onClick={logout}>
            Logout
          </button>
        </header>

        <div className="messages">
          {messages.map((message) => (
            <article key={message.id} className="message">
              <div className="meta">
                <strong>{message.author_name}</strong>
                <span>@{message.author_handle}</span>
                <time>{new Date(message.created_at).toLocaleString()}</time>
              </div>
              <p>{message.body}</p>
              {message.reactions.length > 0 ? (
                <div className="reactions">
                  {message.reactions.map((reaction) => (
                    <span key={`${message.id}-${reaction.emoji}`} className="reaction-pill">
                      {reaction.emoji} {reaction.count}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <form className="composer" onSubmit={onSendMessage}>
          <input
            placeholder="Write a message"
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
          />
          <button type="submit" disabled={!selectedChannelId || busy}>
            Send
          </button>
        </form>
      </section>

      <aside className="sidebar unread">
        <header>
          <h2>Unread</h2>
        </header>
        {unread.length === 0 ? <p>All caught up.</p> : null}
        <ul>
          {unread.map((item) => (
            <li key={`${item.server_id}-${item.channel_id}`}>
              <strong>{item.server_name}</strong>
              <span>
                #{item.channel_name} ({item.unread_count})
              </span>
            </li>
          ))}
        </ul>
        <section className="commands-panel">
          <h3>My Commands</h3>
          <form onSubmit={onCreateUserCommand}>
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
        </section>
        <section className="commands-panel">
          <h3>Server Commands</h3>
          <form onSubmit={onCreateServerCommand}>
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
        </section>
      </aside>

      {error ? <pre className="error floating">{error}</pre> : null}
    </main>
  );
}
