import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Music } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import {
  extractUrls,
  getMusicPreview,
  type LinkPreview,
} from "@/lib/chat";

type Message = {
  id: string;
  body: string;
  thread_root_message_id?: string | null;
  thread_reply_count?: number;
  author_handle: string;
  author_name: string;
  author_avatar_url?: string | null;
  created_at: string;
  reactions: { emoji: string; count: number }[];
  attachments: {
    id: string;
    mime_type: string;
    original_name: string;
    public_url: string;
  }[];
};

type PlaylistTrack = {
  url: string;
  embedUrl: string;
  sourceLabel: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  preview: LinkPreview | null;
};

type MusicPlaylistProps = {
  messages: Message[];
  linkPreviews: Record<string, LinkPreview>;
  resolvedTheme: "light" | "dark";
};

export function MusicPlaylist({
  messages,
  linkPreviews,
}: Omit<MusicPlaylistProps, "resolvedTheme">) {
  const { resolvedTheme } = useTheme();

  const tracks = useMemo<PlaylistTrack[]>(() => {
    const seen = new Set<string>();
    const result: PlaylistTrack[] = [];

    for (const message of messages) {
      for (const url of extractUrls(message.body)) {
        if (seen.has(url)) continue;
        seen.add(url);
        const preview = linkPreviews[url] ?? null;
        const musicPreview = getMusicPreview(
          url,
          preview ?? undefined,
          resolvedTheme,
        );
        if (!musicPreview) continue;
        result.push({
          url,
          embedUrl: musicPreview.embedUrl,
          sourceLabel: musicPreview.sourceLabel,
          title: preview?.title ?? null,
          description: preview?.description ?? null,
          imageUrl: preview?.image_url ?? null,
          preview,
        });
      }
    }
    return result;
  }, [messages, linkPreviews, resolvedTheme]);

  const [activeTrackUrl, setActiveTrackUrl] = useState<string | null>(
    tracks[0]?.url ?? null,
  );

  useEffect(() => {
    setActiveTrackUrl(tracks[0]?.url ?? null);
  }, [messages]);

  const activeTrack = useMemo(
    () => tracks.find((t) => t.url === activeTrackUrl) ?? null,
    [tracks, activeTrackUrl],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-background">
      {activeTrack && (
        <div className="shrink-0 border-b border-border">
          <iframe
            key={activeTrack.embedUrl}
            src={activeTrack.embedUrl}
            title={activeTrack.title ?? "Now playing"}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="w-full border-0"
            style={{
              height: activeTrack.sourceLabel === "Spotify" ? 152 : 175,
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-border">
        <span className="text-xs font-semibold">
          {tracks.length} track{tracks.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {tracks.length > 0
            ? "Click a track to play"
            : "No music links in this channel"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Music className="w-8 h-8 opacity-30" />
            <p className="text-xs">No music links shared in this channel yet.</p>
          </div>
        )}
        {tracks.map((track, index) => {
          const isActive = track.url === activeTrackUrl;
          return (
            <button
              key={track.url}
              type="button"
              onClick={() => setActiveTrackUrl(track.url)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                "hover:bg-accent group border-b border-border/50 last:border-0",
                isActive && "bg-accent",
              )}
            >
              <div className="w-6 shrink-0 flex items-center justify-center">
                {isActive ? (
                  <span className="text-primary text-[10px] font-bold">▶</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground group-hover:hidden">
                    {index + 1}
                  </span>
                )}
                {!isActive && (
                  <span className="text-[10px] text-muted-foreground hidden group-hover:block">
                    ▶
                  </span>
                )}
              </div>

              <div className="w-9 h-9 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                {track.imageUrl ? (
                  <img
                    src={track.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-4 h-4 text-muted-foreground/40" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm truncate leading-tight",
                    isActive
                      ? "font-semibold text-foreground"
                      : "font-medium",
                  )}
                >
                  {track.title ?? track.url}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {track.sourceLabel}
                  {track.description ? ` · ${track.description}` : ""}
                </p>
              </div>

              <a
                href={track.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Open in streaming service"
              >
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </a>
            </button>
          );
        })}
      </div>
    </div>
  );
}
