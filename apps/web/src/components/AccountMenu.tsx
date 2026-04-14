import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type User = {
  id: string;
  name: string;
  handle: string;
  avatar_thumb_url?: string | null;
};

type AccountMenuProps = {
  user: User;
  open: boolean;
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  menuRef: React.Ref<HTMLDivElement>;
  onProfile: () => void;
  onSettings: () => void;
  onAccessibility: () => void;
  onLogout: () => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function AccountMenu({
  user,
  open,
  setOpen,
  menuRef,
  onProfile,
  onSettings,
  onAccessibility,
  onLogout,
}: AccountMenuProps) {
  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors min-w-[160px]',
          'border border-transparent hover:bg-accent',
          open && 'bg-accent border-border'
        )}
      >
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage src={user.avatar_thumb_url ?? undefined} alt={user.name} />
          <AvatarFallback className="text-[10px] font-semibold">{initials(user.name)}</AvatarFallback>
        </Avatar>

        <span className="flex flex-col text-left leading-tight flex-1 min-w-0">
          <strong className="text-xs font-semibold truncate">{user.name}</strong>
          <span className="text-[11px] text-muted-foreground truncate">@{user.handle}</span>
        </span>

        <span className="text-xs text-muted-foreground">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[180px] rounded-lg border border-border bg-popover shadow-md p-1 flex flex-col gap-0.5"
        >
          <Button variant="ghost" size="sm" className="w-full justify-start font-normal" onClick={onProfile}>
            Profile
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start font-normal" onClick={onSettings}>
            Settings
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start font-normal" onClick={onAccessibility}>
            Accessibility
          </Button>
          <div className="my-0.5 h-px bg-border" />
          <Button variant="ghost" size="sm" className="w-full justify-start font-normal text-destructive hover:text-destructive" onClick={onLogout}>
            Log out
          </Button>
        </div>
      )}
    </div>
  );
}
