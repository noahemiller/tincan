import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";

export type RailTab = "channels" | "dms" | "library" | "settings";

type RailProps = {
  activeTab: RailTab;
  onTabChange: (tab: RailTab) => void;
};

const TABS: {
  id: RailTab;
  label: string;
  icon: string;
}[] = [
  { id: "channels", label: "Channels", icon: "/tincan-megaphone.svg" },
  { id: "dms", label: "DMs", icon: "/tincan-two-cans.svg" },
  { id: "library", label: "Library", icon: "/tincan-can.svg" },
  { id: "settings", label: "Settings", icon: "/tincan-server.svg" },
];

export function Rail({ activeTab, onTabChange }: RailProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <aside className="flex flex-col items-center px-1.5 py-2 border-r border-border bg-card h-full">
      {/* Nav tabs */}
      <nav className="flex flex-col gap-1 w-full flex-1">
        {TABS.map(({ id, label, icon }) => (
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
            <img
              src={icon}
              alt={label}
              className="object-contain hover:rotate-180 hover:scale-150 transition-transform duration-200"
              onError={(e) => console.error("Failed to load icon:", icon, e)}
            />
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
