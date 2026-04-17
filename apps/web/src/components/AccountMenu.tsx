import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LogOut } from 'lucide-react';

type User = {
  id: string;
  name: string;
  handle: string;
  avatar_thumb_url?: string | null;
};

type AccountMenuProps = {
  user: User;
  menuRef: React.Ref<HTMLDivElement>;
  onProfile: () => void;
  onLogout: () => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function AccountMenu({
  user,
  menuRef,
  onProfile,
  onLogout,
}: AccountMenuProps) {
  return (
    <div className="relative flex items-center gap-1" ref={menuRef}>
      <button
        type="button"
        aria-label="Open profile settings"
        onClick={onProfile}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors min-w-[160px]',
          'border border-transparent hover:bg-accent'
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
      </button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={onLogout}
        aria-label="Log out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
