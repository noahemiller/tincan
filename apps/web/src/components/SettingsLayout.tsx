import { FormEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DesignSystemPage } from "@/components/DesignSystemPage";
import { cn } from "@/lib/utils";
import {
  Paintbrush,
  Radar,
  Settings2,
  Terminal,
  User as UserIcon,
} from "lucide-react";

type Server = {
  id: string;
  name: string;
  slug: string;
  role?: "owner" | "admin" | "member";
};
type Member = {
  user_id: string;
  name: string;
  handle: string;
  role: "owner" | "admin" | "member";
};
type Invite = {
  id: string;
  code: string;
  role_to_grant: "admin" | "member";
  uses_count: number;
};
type Command = { id: string; command: string; response_text: string };
type LibraryItem = {
  id: string;
  media_url?: string | null;
  title?: string | null;
};

type ProfileForm = {
  name: string;
  handle: string;
  email: string;
  bio: string;
  avatarUrl: string;
  avatarThumbUrl: string;
  homeServerId: string;
};

type ChangePasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

type UiPrefs = {
  textSize: "compact" | "comfortable" | "large";
  contrast: "default" | "high" | "soft" | "rg-safe";
  onboarded: boolean;
};

type User = {
  id: string;
  name: string;
  handle: string;
  avatar_thumb_url?: string | null;
};

export type SettingsView =
  | "profile"
  | "settings"
  | "servers"
  | "commands"
  | "design";

export type SettingsLayoutProps = {
  activeView: SettingsView;
  onViewChange: (view: SettingsView) => void;
  user: User;
  onLogout: () => void;
  profileForm: ProfileForm;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  onSaveProfile: (e: FormEvent<HTMLFormElement>) => void;
  profilePhotos: LibraryItem[];
  servers: Server[];
  busy: boolean;
  showUnreadOnly: boolean;
  setShowUnreadOnly: (v: boolean) => void;
  changePasswordForm: ChangePasswordForm;
  setChangePasswordForm: React.Dispatch<
    React.SetStateAction<ChangePasswordForm>
  >;
  onChangePassword: (e: FormEvent<HTMLFormElement>) => void;
  uiPrefs: UiPrefs;
  setUiPrefs: React.Dispatch<React.SetStateAction<UiPrefs>>;
  selectedServerId: string;
  onSelectServer: (id: string) => void;
  serverName: string;
  setServerName: (v: string) => void;
  onCreateServer: (e: FormEvent<HTMLFormElement>) => void;
  joinInviteCode: string;
  setJoinInviteCode: (v: string) => void;
  onJoinInvite: (e: FormEvent<HTMLFormElement>) => void;
  inviteRoleToGrant: "admin" | "member";
  setInviteRoleToGrant: (v: "admin" | "member") => void;
  inviteMaxUses: string;
  setInviteMaxUses: (v: string) => void;
  inviteExpiresHours: string;
  setInviteExpiresHours: (v: string) => void;
  onCreateInvite: (e: FormEvent<HTMLFormElement>) => void;
  invites: Invite[];
  members: Member[];
  userCommands: Command[];
  serverCommands: Command[];
  userCommandForm: { command: string; responseText: string };
  setUserCommandForm: React.Dispatch<
    React.SetStateAction<{ command: string; responseText: string }>
  >;
  serverCommandForm: { command: string; responseText: string };
  setServerCommandForm: React.Dispatch<
    React.SetStateAction<{ command: string; responseText: string }>
  >;
  onCreateUserCommand: (e: FormEvent<HTMLFormElement>) => void;
  onCreateServerCommand: (e: FormEvent<HTMLFormElement>) => void;
};

const selectCls =
  "w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
      {children}
    </article>
  );
}

function CardHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold m-0">{title}</h3>
      {note ? (
        <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
      ) : null}
    </div>
  );
}

function CommandChip({ cmd }: { cmd: string }) {
  return (
    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
      /{cmd}
    </span>
  );
}

const settingsNav = [
  { id: "profile", label: "Profile", Icon: UserIcon },
  { id: "settings", label: "Settings", Icon: Settings2 },
  { id: "servers", label: "Servers", Icon: Radar },
  { id: "commands", label: "Commands", Icon: Terminal },
  { id: "design", label: "Design System", Icon: Paintbrush },
] satisfies {
  id: SettingsView;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[];

export function SettingsLayout({
  activeView,
  onViewChange,
  user,
  onLogout,
  profileForm,
  setProfileForm,
  onSaveProfile,
  profilePhotos,
  servers,
  busy,
  showUnreadOnly,
  setShowUnreadOnly,
  changePasswordForm,
  setChangePasswordForm,
  onChangePassword,
  uiPrefs,
  setUiPrefs,
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
  userCommands,
  serverCommands,
  userCommandForm,
  setUserCommandForm,
  serverCommandForm,
  setServerCommandForm,
  onCreateUserCommand,
  onCreateServerCommand,
}: SettingsLayoutProps) {
  return (
    <section className="h-full min-h-0 grid grid-cols-[240px_1fr] overflow-hidden">
      <aside className="h-full min-h-0 self-stretch border-r border-border bg-card px-3 py-4 overflow-y-auto">
        <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage
                src={user.avatar_thumb_url ?? undefined}
                alt={user.name}
              />
              <AvatarFallback className="text-xs font-semibold">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold m-0 truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground m-0 truncate">
                @{user.handle}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start text-destructive hover:text-destructive"
            onClick={onLogout}
          >
            Log out
          </Button>
        </div>
        <div className="my-4 h-px bg-border" />
        <nav className="flex flex-col gap-1">
          {settingsNav.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              className={cn(
                "w-full rounded-md px-2.5 py-2 text-sm flex items-center gap-2 transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                activeView === id
                  ? "bg-accent text-accent-foreground ring-1 ring-border"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="overflow-y-auto">
        {activeView === "design" ? (
          <DesignSystemPage />
        ) : (
          <div className="max-w-7xl mx-auto px-8 py-10 flex flex-col gap-4">
            {activeView === "profile" ? (
              <Card>
                <CardHeader
                  title="Profile"
                  note="This identity appears across your private servers."
                />
                <form
                  autoComplete="off"
                  onSubmit={onSaveProfile}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      User ID
                      <Input
                        value={user.id}
                        readOnly
                        className="text-sm bg-muted"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Home server
                      <select
                        className={selectCls}
                        value={profileForm.homeServerId}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            homeServerId: e.target.value,
                          }))
                        }
                      >
                        <option value="">None selected</option>
                        {servers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.id.slice(0, 8)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Name
                      <Input
                        value={profileForm.name}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        required
                        className="text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Handle
                      <Input
                        value={profileForm.handle}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            handle: e.target.value,
                          }))
                        }
                        required
                        className="text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Email
                      <Input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        required
                        className="text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Avatar URL
                      <Input
                        type="url"
                        value={profileForm.avatarUrl}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            avatarUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Avatar thumb URL
                      <Input
                        type="url"
                        value={profileForm.avatarThumbUrl}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            avatarThumbUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="text-sm"
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Bio
                      <textarea
                        rows={3}
                        value={profileForm.bio}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            bio: e.target.value,
                          }))
                        }
                        placeholder="Tell your friends who you are."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical"
                      />
                    </label>
                  </div>
                  <div>
                    <Button type="submit" size="sm" disabled={busy}>
                      Save profile
                    </Button>
                  </div>
                </form>
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <div>
                    <h4 className="text-xs font-semibold m-0">
                      Profile Photos
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Images you posted to this server library.
                    </p>
                  </div>
                  {profilePhotos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No profile photos yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                      {profilePhotos.map((item) => (
                        <a
                          key={item.id}
                          href={item.media_url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-md border border-border overflow-hidden"
                        >
                          <img
                            src={item.media_url || ""}
                            alt={item.title || item.id}
                            className="w-full h-[80px] object-cover block"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ) : null}
            {activeView === "settings" ? (
              <>
                <Card>
                  <CardHeader
                    title="Workspace Settings"
                    note="Quick controls for how your workspace is displayed."
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showUnreadOnly}
                      onChange={(e) => setShowUnreadOnly(e.target.checked)}
                      className="rounded"
                    />
                    Unread-only channel mode
                  </label>
                  <div className="pt-3 border-t border-border flex flex-col gap-3">
                    <div>
                      <h4 className="text-xs font-semibold m-0">
                        Change Password
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Update your password while logged in.
                      </p>
                    </div>
                    <form
                      autoComplete="off"
                      onSubmit={onChangePassword}
                      className="flex flex-col gap-2 max-w-sm"
                    >
                      <Input
                        type="password"
                        placeholder="Current password"
                        value={changePasswordForm.currentPassword}
                        onChange={(e) =>
                          setChangePasswordForm((prev) => ({
                            ...prev,
                            currentPassword: e.target.value,
                          }))
                        }
                        required
                        className="text-sm"
                      />
                      <Input
                        type="password"
                        placeholder="New password"
                        value={changePasswordForm.newPassword}
                        onChange={(e) =>
                          setChangePasswordForm((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        required
                        className="text-sm"
                      />
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        value={changePasswordForm.confirmNewPassword}
                        onChange={(e) =>
                          setChangePasswordForm((prev) => ({
                            ...prev,
                            confirmNewPassword: e.target.value,
                          }))
                        }
                        required
                        className="text-sm"
                      />
                      <div>
                        <Button type="submit" size="sm" disabled={busy}>
                          Update password
                        </Button>
                      </div>
                    </form>
                  </div>
                </Card>
                <Card>
                  <CardHeader
                    title="Accessibility"
                    note={
                      uiPrefs.onboarded
                        ? "Adjust text size and contrast at any time."
                        : "Welcome. Choose text size and contrast for your workspace."
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Text size
                      <select
                        className={selectCls}
                        value={uiPrefs.textSize}
                        onChange={(e) =>
                          setUiPrefs((prev) => ({
                            ...prev,
                            textSize: e.target.value as UiPrefs["textSize"],
                          }))
                        }
                      >
                        <option value="compact">Small</option>
                        <option value="comfortable">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Contrast mode
                      <select
                        className={selectCls}
                        value={uiPrefs.contrast}
                        onChange={(e) =>
                          setUiPrefs((prev) => ({
                            ...prev,
                            contrast: e.target.value as UiPrefs["contrast"],
                          }))
                        }
                      >
                        <option value="default">Default</option>
                        <option value="high">High contrast</option>
                        <option value="soft">Soft contrast</option>
                        <option value="rg-safe">Red/green safe</option>
                      </select>
                    </label>
                  </div>
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setUiPrefs((prev) => ({ ...prev, onboarded: true }))
                      }
                    >
                      Save preferences
                    </Button>
                  </div>
                </Card>
              </>
            ) : null}
            {activeView === "servers" ? (
              <>
                <Card>
                  <CardHeader
                    title="Servers"
                    note="Switch servers and manage invites and memberships."
                  />
                  <div className="flex flex-col gap-2">
                    {servers.map((server) => (
                      <button
                        key={server.id}
                        type="button"
                        className={cn(
                          "rounded-md border px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors",
                          server.id === selectedServerId
                            ? "bg-accent text-accent-foreground ring-1 ring-border border-transparent"
                            : "border-border hover:bg-accent/50",
                        )}
                        onClick={() => onSelectServer(server.id)}
                      >
                        <span className="text-sm font-medium">
                          {server.name}
                        </span>
                        {server.role ? (
                          <Badge variant="outline">{server.role}</Badge>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </Card>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader title="New server" />
                    <form
                      autoComplete="off"
                      onSubmit={onCreateServer}
                      className="flex flex-col gap-2"
                    >
                      <Input
                        placeholder="Server name"
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                      />
                      <Button type="submit" size="sm">
                        Create
                      </Button>
                    </form>
                  </Card>
                  <Card>
                    <CardHeader title="Join with invite" />
                    <form
                      autoComplete="off"
                      onSubmit={onJoinInvite}
                      className="flex flex-col gap-2"
                    >
                      <Input
                        placeholder="Invite code"
                        value={joinInviteCode}
                        onChange={(e) => setJoinInviteCode(e.target.value)}
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        Join
                      </Button>
                    </form>
                  </Card>
                </div>
                <Card>
                  <CardHeader title="Create invite" />
                  <form
                    autoComplete="off"
                    onSubmit={onCreateInvite}
                    className="grid grid-cols-4 gap-2 items-end"
                  >
                    <label className="col-span-1 flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Role
                      <select
                        className={selectCls}
                        value={inviteRoleToGrant}
                        onChange={(e) =>
                          setInviteRoleToGrant(
                            e.target.value as "admin" | "member",
                          )
                        }
                      >
                        <option value="member">Grant member</option>
                        <option value="admin">Grant admin</option>
                      </select>
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Max uses
                      <Input
                        placeholder="Optional"
                        type="number"
                        min="1"
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                      Expires (hours)
                      <Input
                        placeholder="Hours"
                        type="number"
                        min="1"
                        value={inviteExpiresHours}
                        onChange={(e) => setInviteExpiresHours(e.target.value)}
                      />
                    </label>
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      disabled={!selectedServerId}
                    >
                      Create invite
                    </Button>
                  </form>
                </Card>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader title="Recent invites" />
                    {invites.length === 0 ? (
                      <p className="text-xs text-muted-foreground m-0">
                        No invites yet.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {invites.slice(0, 8).map((invite) => (
                          <div
                            key={invite.id}
                            className="text-xs rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono"
                          >
                            {invite.code} ({invite.role_to_grant},{" "}
                            {invite.uses_count})
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                  <Card>
                    <CardHeader title="Members" />
                    {members.length === 0 ? (
                      <p className="text-xs text-muted-foreground m-0">
                        No members loaded.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {members.slice(0, 10).map((member) => (
                          <div
                            key={member.user_id}
                            className="rounded-md border border-border px-2 py-1.5 flex items-center justify-between gap-2"
                          >
                            <span className="text-sm">@{member.handle}</span>
                            <Badge variant="outline">{member.role}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </>
            ) : null}
            {activeView === "commands" ? (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader
                    title="My Commands"
                    note="Personal macros available across all servers"
                  />
                  <form
                    autoComplete="off"
                    onSubmit={onCreateUserCommand}
                    className="flex flex-col gap-2"
                  >
                    <Input
                      placeholder="/command"
                      value={userCommandForm.command}
                      onChange={(e) =>
                        setUserCommandForm((prev) => ({
                          ...prev,
                          command: e.target.value,
                        }))
                      }
                    />
                    <Input
                      placeholder="Response text (use {{args}})"
                      value={userCommandForm.responseText}
                      onChange={(e) =>
                        setUserCommandForm((prev) => ({
                          ...prev,
                          responseText: e.target.value,
                        }))
                      }
                    />
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </form>
                  {userCommands.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {userCommands.map((cmd) => (
                        <CommandChip key={cmd.id} cmd={cmd.command} />
                      ))}
                    </div>
                  ) : null}
                </Card>
                <Card>
                  <CardHeader
                    title="Server Commands"
                    note="Commands scoped to the selected server - any member can trigger them"
                  />
                  <form
                    autoComplete="off"
                    onSubmit={onCreateServerCommand}
                    className="flex flex-col gap-2"
                  >
                    <Input
                      placeholder="/command"
                      value={serverCommandForm.command}
                      onChange={(e) =>
                        setServerCommandForm((prev) => ({
                          ...prev,
                          command: e.target.value,
                        }))
                      }
                    />
                    <Input
                      placeholder="Response text (use {{args}})"
                      value={serverCommandForm.responseText}
                      onChange={(e) =>
                        setServerCommandForm((prev) => ({
                          ...prev,
                          responseText: e.target.value,
                        }))
                      }
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!selectedServerId}
                    >
                      Save
                    </Button>
                  </form>
                  {serverCommands.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {serverCommands.map((cmd) => (
                        <CommandChip key={cmd.id} cmd={cmd.command} />
                      ))}
                    </div>
                  ) : null}
                </Card>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
