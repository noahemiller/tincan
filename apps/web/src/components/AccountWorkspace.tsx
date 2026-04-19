/**
 * AccountWorkspace
 *
 * Extracted from the App.tsx `centerPane === 'account'` branch.
 * Add this file to src/components/AccountWorkspace.tsx and import in App.tsx.
 */

import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Server = { id: string; name: string; slug: string; role?: string };

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
  textSize: 'compact' | 'comfortable' | 'large';
  contrast: 'default' | 'high' | 'soft' | 'rg-safe';
  sessionDuration: 'standard' | 'hour';
  onboarded: boolean;
};

type LibraryItem = { id: string; media_url?: string | null; title?: string | null };

export type AccountWorkspaceProps = {
  accountView: 'profile' | 'settings' | 'accessibility';
  user: { id: string };
  profileForm: ProfileForm;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  onSaveProfile: (e: FormEvent<HTMLFormElement>) => void;
  onUploadAvatarFile: (file: File) => Promise<void>;
  profilePhotos: LibraryItem[];
  servers: Server[];
  busy: boolean;
  centerPane: 'chat' | 'library' | 'account' | 'design';
  setCenterPane: React.Dispatch<React.SetStateAction<'chat' | 'library' | 'account' | 'design'>>;
  showUnreadOnly: boolean;
  setShowUnreadOnly: (v: boolean) => void;
  changePasswordForm: ChangePasswordForm;
  setChangePasswordForm: React.Dispatch<React.SetStateAction<ChangePasswordForm>>;
  onChangePassword: (e: FormEvent<HTMLFormElement>) => void;
  uiPrefs: UiPrefs;
  setUiPrefs: React.Dispatch<React.SetStateAction<UiPrefs>>;
};

/* Shared select className */
const selectCls =
  'w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

/* Shared card wrapper */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
      {children}
    </article>
  );
}

/* Shared section header */
function CardHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold m-0">{title}</h3>
      {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
    </div>
  );
}

export function AccountWorkspace({
  accountView,
  user,
  profileForm,
  setProfileForm,
  onSaveProfile,
  onUploadAvatarFile,
  profilePhotos,
  servers,
  busy,
  centerPane,
  setCenterPane,
  showUnreadOnly,
  setShowUnreadOnly,
  changePasswordForm,
  setChangePasswordForm,
  onChangePassword,
  uiPrefs,
  setUiPrefs,
}: AccountWorkspaceProps) {
  return (
    <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto flex-1 min-h-0">

      {/* ── Profile ── */}
      {accountView === 'profile' && (
        <Card>
          <CardHeader
            title="Profile"
            note="This identity appears across your private servers."
          />
          <form autoComplete="off" onSubmit={onSaveProfile} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                User ID
                <Input value={user.id} readOnly className="text-sm bg-muted" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                Home server
                <select
                  className={selectCls}
                  value={profileForm.homeServerId}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, homeServerId: e.target.value }))}
                >
                  <option value="">None selected</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id.slice(0, 8)})</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                Name
                <Input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                Handle
                <Input
                  value={profileForm.handle}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, handle: e.target.value }))}
                  required
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                Email
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                Avatar URL
                <Input
                  type="url"
                  value={profileForm.avatarUrl}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                  placeholder="https://…"
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                Avatar thumb URL
                <Input
                  type="url"
                  value={profileForm.avatarThumbUrl}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, avatarThumbUrl: e.target.value }))}
                  placeholder="https://…"
                  className="text-sm"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                Avatar image
                <Input
                  type="file"
                  accept="image/*"
                  className="text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) {
                      return;
                    }
                    void onUploadAvatarFile(file);
                  }}
                />
                <span className="text-[11px] text-muted-foreground">
                  Uploads image and sets it as avatar automatically.
                </span>
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                Bio
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell your friends who you are."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical"
                />
              </label>
            </div>
            <div>
              <Button type="submit" size="sm" disabled={busy}>Save profile</Button>
            </div>
          </form>

          {/* Profile photos */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <div>
              <h4 className="text-xs font-semibold m-0">Profile Photos</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Images you posted to this server library.</p>
            </div>
            {profilePhotos.length === 0 ? (
              <p className="text-xs text-muted-foreground">No profile photos yet.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                {profilePhotos.map((item) => (
                  <a
                    key={item.id}
                    href={item.media_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-border overflow-hidden"
                  >
                    <img
                      src={item.media_url || ''}
                      alt={item.title || item.id}
                      className="w-full h-[80px] object-cover block"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Settings ── */}
      {accountView === 'settings' && (
        <Card>
          <CardHeader
            title="Workspace Settings"
            note="Quick controls for how your workspace is displayed."
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
              Open center workspace
              <select
                className={selectCls}
                value={centerPane === 'account' ? 'chat' : centerPane}
                onChange={(e) => setCenterPane(e.target.value as 'chat' | 'library')}
              >
                <option value="chat">Chat</option>
                <option value="library">Library</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none pt-5">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(e) => setShowUnreadOnly(e.target.checked)}
                className="rounded"
              />
              Unread-only channel mode
            </label>
          </div>

          <div className="pt-3 border-t border-border flex flex-col gap-3">
            <div>
              <h4 className="text-xs font-semibold m-0">Change Password</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Update your password while logged in.</p>
            </div>
            <form autoComplete="off" onSubmit={onChangePassword} className="flex flex-col gap-2 max-w-sm">
              <Input
                type="password"
                placeholder="Current password"
                value={changePasswordForm.currentPassword}
                onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                required
                className="text-sm"
              />
              <Input
                type="password"
                placeholder="New password"
                value={changePasswordForm.newPassword}
                onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                required
                className="text-sm"
              />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={changePasswordForm.confirmNewPassword}
                onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                required
                className="text-sm"
              />
              <div>
                <Button type="submit" size="sm" disabled={busy}>Update password</Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {/* ── Accessibility ── */}
      {accountView === 'accessibility' && (
        <Card>
          <CardHeader
            title="Accessibility"
            note={
              uiPrefs.onboarded
                ? 'Adjust text size and contrast at any time.'
                : 'Welcome. Choose text size and contrast for your workspace.'
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
              Text size
              <select
                className={selectCls}
                value={uiPrefs.textSize}
                onChange={(e) =>
                  setUiPrefs((prev) => ({ ...prev, textSize: e.target.value as UiPrefs['textSize'] }))
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
                  setUiPrefs((prev) => ({ ...prev, contrast: e.target.value as UiPrefs['contrast'] }))
                }
              >
                <option value="default">Default</option>
                <option value="high">High contrast</option>
                <option value="soft">Soft contrast</option>
                <option value="rg-safe">Red/green safe</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
              Session duration
              <select
                className={selectCls}
                value={uiPrefs.sessionDuration}
                onChange={(e) =>
                  setUiPrefs((prev) => ({ ...prev, sessionDuration: e.target.value as UiPrefs['sessionDuration'] }))
                }
              >
                <option value="standard">Standard</option>
                <option value="hour">Keep active (~1 hour)</option>
              </select>
            </label>
          </div>
          <div>
            <Button
              type="button"
              size="sm"
              onClick={() => setUiPrefs((prev) => ({ ...prev, onboarded: true }))}
            >
              Save preferences
            </Button>
          </div>
        </Card>
      )}

    </div>
  );
}
