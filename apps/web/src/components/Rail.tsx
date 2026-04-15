import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon, RadioTower, Phone, Library, Settings2 } from "lucide-react";

export type RailTab = "channels" | "dms" | "library" | "settings";

type RailProps = {
  activeTab: RailTab;
  onTabChange: (tab: RailTab) => void;
};

const TABS: {
  id: RailTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "channels", label: "Channels", Icon: RadioTower },
  { id: "dms", label: "Direct messages", Icon: Phone },
  { id: "library", label: "Library", Icon: Library },
  { id: "settings", label: "Settings", Icon: Settings2 },
];

export function Rail({ activeTab, onTabChange }: RailProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <aside className="flex flex-col items-center px-1.5 py-2 border-r border-border bg-card h-full">
      {/* Brand */}
      <div className="w-full px-0.5 pb-3 pt-1 shrink-0">
        <img
          src="/tincan-logo.svg"
          alt="Tincan"
          className="w-full h-8 object-contain"
        />
      </div>

      {/* Nav tabs */}
      <nav className="flex flex-col gap-1 w-full flex-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            onClick={() => onTabChange(id)}
            className={cn(
              "w-full aspect-square rounded-md flex items-center justify-center transition-colors",
              "hover:bg-accent",
              activeTab === id
                ? "bg-accent text-accent-foreground ring-1 ring-border"
                : "text-muted-foreground",
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </nav>

      {/* Theme toggle — sun / moon, pinned to bottom */}
      <button
        type="button"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn(
          "w-full aspect-square rounded-md flex items-center justify-center shrink-0 mt-1",
          "transition-colors hover:bg-accent text-muted-foreground hover:text-foreground",
        )}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </aside>
  );
}
