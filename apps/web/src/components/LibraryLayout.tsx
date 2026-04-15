import { cn } from "@/lib/utils";
import { Link, Image, Music } from "lucide-react";
import { LibraryWorkspace, type LibraryWorkspaceProps } from "@/components/LibraryWorkspace";

export type LibraryLayoutProps = LibraryWorkspaceProps & {
  selectedServerName?: string;
  selectedChannelName?: string;
};

export function LibraryLayout({
  selectedServerName,
  selectedChannelName,
  // All LibraryWorkspace props spread through
  ...workspaceProps
}: LibraryLayoutProps) {
  return (
    <section className="h-full grid grid-cols-[240px_1fr] overflow-hidden">
      {/* Left nav */}
      <aside className="border-r border-border bg-card px-3 py-4 overflow-y-auto flex flex-col gap-4">
        {/* Server / channel context */}
        {selectedServerName && (
          <div className="px-1">
            <p className="text-xs font-semibold text-foreground truncate">{selectedServerName}</p>
            {selectedChannelName && (
              <p className="text-xs text-muted-foreground truncate">#{selectedChannelName}</p>
            )}
          </div>
        )}

        {/* BROWSE group */}
        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Browse</p>
          {[
            { label: "All Links", Icon: Link },
            { label: "Media", Icon: Image },
            { label: "Music", Icon: Music },
          ].map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              className={cn(
                "w-full rounded-md px-2.5 py-2 text-sm flex items-center gap-2 transition-colors",
                "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* COLLECTIONS group */}
        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Collections</p>
          {/* TODO: collection list will be populated from props */}
          {workspaceProps.collections.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs text-muted-foreground">(no collections yet)</p>
          ) : (
            workspaceProps.collections.map((col) => (
              <button
                key={col.id}
                type="button"
                className={cn(
                  "w-full rounded-md px-2.5 py-2 text-sm flex items-center gap-2 transition-colors",
                  "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
                )}
              >
                <span className="truncate">{col.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer note */}
        <p className="px-2.5 text-xs text-muted-foreground">
          Library saves links and media shared in channels.
        </p>
      </aside>

      {/* Center pane — full LibraryWorkspace */}
      <LibraryWorkspace {...workspaceProps} />
    </section>
  );
}
