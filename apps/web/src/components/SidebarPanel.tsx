import { FormEvent } from 'react';
import type { RailTab } from '@/components/Rail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Server  = { id: string; name: string; slug: string; role?: 'owner' | 'admin' | 'member' };
type Channel = { id: string; name: string; slug: string; notification_mode: 'hidden' | 'passive' | 'active'; snoozed_until?: string | null };
type Member  = { user_id: string; name: string; handle: string; role: 'owner' | 'admin' | 'member' };
type Invite  = { id: string; code: string; role_to_grant: 'admin' | 'member'; uses_count: number };

type SidebarPanelProps = {
  activeTab: RailTab;
  servers: Server[];
  selectedServerId: string;
  onSelectServer: (id: string) => void;
  serverName: string;
  setServerName: (v: string) => void;
  onCreateServer: (e: FormEvent<HTMLFormElement>) => void;
  joinInviteCode: string;
  setJoinInviteCode: (v: string) => void;
  onJoinInvite: (e: FormEvent<HTMLFormElement>) => void;
  inviteRoleToGrant: 'admin' | 'member';
  setInviteRoleToGrant: (v: 'admin' | 'member') => void;
  inviteMaxUses: string;
  setInviteMaxUses: (v: string) => void;
  inviteExpiresHours: string;
  setInviteExpiresHours: (v: string) => void;
  onCreateInvite: (e: FormEvent<HTMLFormElement>) => void;
  invites: Invite[];
  members: Member[];
  selectedServer: Server | null;
  channels: Channel[];
  selectedChannelId: string;
  onSelectChannel: (id: string) => void;
  unreadCountByChannel: Map<string, number>;
  showUnreadOnly: boolean;
  setShowUnreadOnly: (v: boolean) => void;
  visibleChannels: Channel[];
  channelName: string;
  setChannelName: (v: string) => void;
  onCreateChannel: (e: FormEvent<HTMLFormElement>) => void;
};

/* Shared styles for nav buttons */
const navItem = (active: boolean) =>
  cn(
    'w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors',
    'hover:bg-accent hover:text-accent-foreground',
    active
      ? 'bg-accent text-accent-foreground font-medium'
      : 'text-foreground'
  );

/* Small code/tag chips */
const chip = 'text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono';

export function SidebarPanel({
  activeTab,
  servers,
  selectedServerId,
  onSelectServer,
  serverName,
  setServerName,
  onCreateServer,
  joinInviteCode,
  setJoinInviteCode,
  onJoinInvite,
  inviteRoleToGrant,
  setInviteRoleToGrant,
  inviteMaxUses,
  setInviteMaxUses,
  inviteExpiresHours,
  setInviteExpiresHours,
  onCreateInvite,
  invites,
  members,
  selectedServer,
  selectedChannelId,
  onSelectChannel,
  unreadCountByChannel,
  showUnreadOnly,
  setShowUnreadOnly,
  visibleChannels,
  channelName,
  setChannelName,
  onCreateChannel,
}: SidebarPanelProps) {
  return (
    <aside className="sidebar panel flex flex-col gap-3 px-2 py-3 border-r border-border bg-card h-full overflow-y-auto">

      {/* ── Servers ────────────────────────────────────────────────────── */}
      {activeTab === 'servers' && (
        <>
          <header>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2.5 mb-1">
              Servers
            </h2>
          </header>

          <nav className="flex flex-col gap-0.5">
            {servers.map((server) => (
              <button
                key={server.id}
                type="button"
                className={navItem(server.id === selectedServerId)}
                onClick={() => void onSelectServer(server.id)}
              >
                {server.name}
              </button>
            ))}
          </nav>

          <div className="border-t border-border pt-3 flex flex-col gap-2">
            <p className="text-xs text-muted-foreground px-2.5 font-medium">New server</p>
            <form autoComplete="off" onSubmit={onCreateServer} className="flex flex-col gap-1.5">
              <Input placeholder="Server name" value={serverName} onChange={(e) => setServerName(e.target.value)} />
              <Button type="submit" size="sm">Create</Button>
            </form>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground px-2.5 font-medium">Join with invite</p>
            <form autoComplete="off" onSubmit={onJoinInvite} className="flex flex-col gap-1.5">
              <Input placeholder="Invite code" value={joinInviteCode} onChange={(e) => setJoinInviteCode(e.target.value)} />
              <Button type="submit" size="sm" variant="secondary">Join</Button>
            </form>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground px-2.5 font-medium">Create invite</p>
            <form autoComplete="off" onSubmit={onCreateInvite} className="flex flex-col gap-1.5">
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={inviteRoleToGrant}
                onChange={(e) => setInviteRoleToGrant(e.target.value as 'admin' | 'member')}
              >
                <option value="member">Grant member</option>
                <option value="admin">Grant admin</option>
              </select>
              <Input placeholder="Max uses (optional)" type="number" min="1" value={inviteMaxUses} onChange={(e) => setInviteMaxUses(e.target.value)} />
              <Input placeholder="Expires in hours" type="number" min="1" value={inviteExpiresHours} onChange={(e) => setInviteExpiresHours(e.target.value)} />
              <Button type="submit" size="sm" variant="secondary" disabled={!selectedServerId}>
                Create invite
              </Button>
            </form>
          </div>

          {invites.length > 0 && (
            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
              {invites.slice(0, 5).map((invite) => (
                <code key={invite.id} className={chip}>
                  {invite.code} ({invite.role_to_grant}, {invite.uses_count})
                </code>
              ))}
            </div>
          )}

          {members.length > 0 && (
            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
              {members.slice(0, 6).map((member) => (
                <span key={member.user_id} className={chip}>
                  {member.name} ({member.role})
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── DMs ───────────────────────────────────────────────────────── */}
      {activeTab === 'dms' && (
        <>
          <header>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2.5 mb-1">
              Direct Messages
            </h2>
          </header>
          <p className="text-xs text-muted-foreground px-2.5">
            Private chats between two people.
          </p>
          <div className="flex flex-col gap-1">
            {members.length === 0 && (
              <span className="text-xs text-muted-foreground px-2.5">No contacts yet.</span>
            )}
            {members.map((member) => (
              <span key={member.user_id} className={chip}>
                @{member.handle}
              </span>
            ))}
          </div>
        </>
      )}

      {/* ── Channels ──────────────────────────────────────────────────── */}
      {activeTab === 'channels' && (
        <>
          <header className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2.5">
              {selectedServer?.name ?? 'Channels'}
            </h2>
            <label className="flex items-center gap-2 px-2.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(e) => setShowUnreadOnly(e.target.checked)}
                className="rounded"
              />
              Unread only
            </label>
          </header>

          <nav className="flex flex-col gap-0.5 flex-1 min-h-0">
            {visibleChannels.length === 0 && (
              <p className="text-xs text-muted-foreground px-2.5 py-1">No unread channels.</p>
            )}
            {visibleChannels.map((channel) => {
              const unreadCount = unreadCountByChannel.get(channel.id) ?? 0;
              const active = channel.id === selectedChannelId;
              return (
                <button
                  key={channel.id}
                  type="button"
                  className={cn(
                    navItem(active),
                    'flex items-center justify-between gap-2',
                    unreadCount > 0 ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground'
                  )}
                  onClick={() => void onSelectChannel(channel.id)}
                >
                  <span className="truncate">#{channel.name}</span>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] min-w-[1.25rem] text-center px-1 py-0 rounded-full">
                      {unreadCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-border pt-3">
            <form autoComplete="off" onSubmit={onCreateChannel} className="flex flex-col gap-1.5">
              <Input placeholder="New channel" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
              <Button type="submit" size="sm">Add channel</Button>
            </form>
          </div>
        </>
      )}

      {/* ── Design system ─────────────────────────────────────────────── */}
      {activeTab === 'design' && (
        <>
          <header>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2.5 mb-1">
              Design system
            </h2>
          </header>
          <p className="text-xs text-muted-foreground px-2.5 m-0">
            Reference for UI tokens and components. Preview light and dark themes from the rail.
          </p>
        </>
      )}

    </aside>
  );
}
