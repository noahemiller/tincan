import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import {
  extractUrls,
  getMusicPreview,
  getYouTubeEmbedUrl,
  initialsFromName,
  type LinkPreview,
} from "@/lib/chat";

type Attachment = {
  id: string;
  mime_type: string;
  original_name: string;
  public_url: string;
};

type Message = {
  id: string;
  body: string;
  reply_to_message_id?: string | null;
  thread_root_message_id?: string | null;
  thread_reply_count?: number;
  author_user_id: string;
  author_handle: string;
  author_name: string;
  author_avatar_url?: string | null;
  edited_at?: string | null;
  created_at: string;
  reactions: { emoji: string; count: number }[];
  attachments: Attachment[];
};

type MessageListProps = {
  messages: Message[];
  linkPreviews: Record<string, LinkPreview>;
  onOpenThread: (rootMessageId: string) => void;
  onReplyToMessage?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => Promise<void>;
  onOpenLightbox: (attachmentId: string) => void;
  currentUserId?: string;
  onEditMessage?: (messageId: string, nextBody: string) => Promise<void>;
  onBottomStateChange?: (atBottom: boolean) => void;
  showAvatars?: boolean;
  density?: "compact" | "comfortable";
  cornerRadiusPx?: number;
  borderWidthPx?: number;
  enableLinkPreviews?: boolean;
  enableMusicEmbeds?: boolean;
  enableThreads?: boolean;
  enableStreamReplies?: boolean;
};

export function MessageList({
  messages,
  linkPreviews,
  onOpenThread,
  onReplyToMessage,
  onToggleReaction,
  onOpenLightbox,
  currentUserId,
  onEditMessage,
  onBottomStateChange,
  showAvatars = true,
  density = "comfortable",
  cornerRadiusPx = 10,
  borderWidthPx = 1,
  enableLinkPreviews = true,
  enableMusicEmbeds = true,
  enableThreads = true,
  enableStreamReplies = true,
}: MessageListProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [openEmojiPickerMessageId, setOpenEmojiPickerMessageId] = useState<string | null>(null);
  const [emojiQuery, setEmojiQuery] = useState("");
  const fallbackQuickReactions = ["😂", "👍", "❤️"];
  const emojiCatalog = [
    "😂","🤣","😮","👍","❤️","🔥","🎺","🎉","⭐","👏","😍","🤔","😎","🥲","😭","🥳",
    "💯","✅","❌","🚀","🙏","👀","😬","😅","😢","🤝","💀","🤯","😡","🫠","🙂","😴",
  ];

  const messageById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const message of messages) {
      map.set(message.id, message);
    }
    return map;
  }, [messages]);

  const frequentReactionEmojis = useMemo(() => {
    const totals = new Map<string, number>();
    for (const message of messages) {
      for (const reaction of message.reactions) {
        totals.set(reaction.emoji, (totals.get(reaction.emoji) ?? 0) + reaction.count);
      }
    }
    const sorted = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([emoji]) => emoji)
      .filter((emoji) => emoji.trim().length > 0);
    const picks = sorted.slice(0, 3);
    for (const fallback of fallbackQuickReactions) {
      if (picks.length >= 3) {
        break;
      }
      if (!picks.includes(fallback)) {
        picks.push(fallback);
      }
    }
    return picks;
  }, [messages]);

  const visibleEmojiCatalog = useMemo(() => {
    const query = emojiQuery.trim();
    if (!query) {
      return emojiCatalog;
    }
    return emojiCatalog.filter((emoji) => emoji.includes(query));
  }, [emojiQuery]);

  const reportBottom = useCallback(() => {
    if (!onBottomStateChange) {
      return;
    }
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const threshold = 12;
    const atBottom =
      node.scrollTop + node.clientHeight >= node.scrollHeight - threshold;
    onBottomStateChange(atBottom);
  }, [onBottomStateChange]);

  useEffect(() => {
    reportBottom();
  }, [messages.length, reportBottom]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const onScroll = () => reportBottom();
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [reportBottom]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-1.5 py-3 overflow-y-auto"
    >
      {messages.map((message) => (
        <article
          key={message.id}
          className={cn(
            "group relative rounded-lg border-b border-border px-3 hover:bg-accent/50 transition-colors",
            density === "compact" ? "py-1.5" : "py-2.5",
          )}
          style={{
            borderRadius: `${cornerRadiusPx}px`,
            borderBottomWidth: `${borderWidthPx}px`,
          }}
        >
          {/* Hover actions */}
          {(enableStreamReplies || enableThreads || onToggleReaction) && (
            <div className="absolute right-3 -top-3 z-20 flex items-center gap-1 rounded-md border border-border bg-popover px-1.5 py-1 shadow-sm opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
              {frequentReactionEmojis.map((emoji) => (
                <Button
                  key={`${message.id}-hover-quick-${emoji}`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-sm"
                  onClick={() => {
                    if (onToggleReaction) {
                      void onToggleReaction(message.id, emoji);
                    }
                  }}
                >
                  {emoji}
                </Button>
              ))}
              {onToggleReaction && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setOpenEmojiPickerMessageId((prev) =>
                      prev === message.id ? null : message.id,
                    )
                  }
                >
                  Add reaction
                </Button>
              )}
              {enableStreamReplies && onReplyToMessage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onReplyToMessage(message.id)}
                >
                  Reply
                </Button>
              )}
              {enableThreads && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void onOpenThread(message.id)}
                >
                  Reply in thread
                </Button>
              )}
            </div>
          )}

          {openEmojiPickerMessageId === message.id && onToggleReaction && (
            <div className="absolute right-3 top-8 z-30 w-[260px] rounded-md border border-border bg-popover p-2 shadow-lg">
              <Input
                placeholder="Find reaction"
                value={emojiQuery}
                onChange={(event) => setEmojiQuery(event.target.value)}
                className="h-8 text-sm mb-2"
              />
              <div className="grid grid-cols-8 gap-1">
                {visibleEmojiCatalog.slice(0, 40).map((emoji) => (
                  <button
                    key={`${message.id}-picker-${emoji}`}
                    type="button"
                    className="h-7 w-7 rounded hover:bg-accent text-base"
                    onClick={() => {
                      void onToggleReaction(message.id, emoji);
                      setOpenEmojiPickerMessageId(null);
                      setEmojiQuery("");
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Header */}
          <div
            className={cn(
              "flex items-center mb-1.5",
              showAvatars ? "gap-2.5" : "gap-0",
            )}
          >
            {showAvatars && (
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage
                  src={message.author_avatar_url ?? undefined}
                  alt={`${message.author_name} avatar`}
                />
                <AvatarFallback className="text-[10px] font-semibold">
                  {initialsFromName(message.author_name)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <strong className="text-sm font-semibold">
                {message.author_name}
              </strong>
              <span className="text-xs text-muted-foreground">
                @{message.author_handle}
              </span>
              <time className="text-xs text-muted-foreground">
                {new Date(message.created_at).toLocaleString()}
              </time>
              {message.edited_at && (
                <span className="text-[11px] text-muted-foreground">
                  edited
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          {editingMessageId === message.id ? (
            <div
              className={cn(
                "mt-0 mb-0 flex flex-col gap-1.5",
                showAvatars ? "pl-[2.375rem]" : "pl-0",
              )}
            >
              <textarea
                className="w-full min-h-[70px] rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
              />
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={savingEdit || !editDraft.trim()}
                  onClick={async () => {
                    if (!onEditMessage || !editDraft.trim()) {
                      return;
                    }
                    setSavingEdit(true);
                    try {
                      await onEditMessage(message.id, editDraft);
                      setEditingMessageId(null);
                      setEditDraft("");
                    } finally {
                      setSavingEdit(false);
                    }
                  }}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  disabled={savingEdit}
                  onClick={() => {
                    setEditingMessageId(null);
                    setEditDraft("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex flex-col gap-1",
                showAvatars ? "pl-[2.375rem]" : "pl-0",
              )}
            >
              {message.reply_to_message_id &&
                messageById.get(message.reply_to_message_id) && (
                  <div className="rounded-md border-l-2 border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground/90">
                      Replying to{" "}
                      {messageById.get(message.reply_to_message_id)?.author_name}
                    </div>
                    <div className="truncate">
                      {messageById.get(message.reply_to_message_id)?.body}
                    </div>
                  </div>
                )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap mt-0 mb-0">
                {message.body}
              </p>
            </div>
          )}

          {/* Link previews */}
          {enableLinkPreviews && extractUrls(message.body).length > 0 && (
            <div
              className={cn(
                "mt-2 flex flex-col gap-2",
                showAvatars ? "pl-[2.375rem]" : "pl-0",
              )}
            >
              {extractUrls(message.body).map((url) => {
                const preview = linkPreviews[url];
                const musicPreview = getMusicPreview(
                  url,
                  preview,
                  resolvedTheme,
                );
                const youtubeEmbedUrl = getYouTubeEmbedUrl(url);

                if (musicPreview && enableMusicEmbeds) {
                  return (
                    <article
                      key={`${message.id}-${url}`}
                      className="w-full max-w-[980px] rounded-lg border border-border p-2.5 flex flex-col gap-2"
                      style={{
                        borderRadius: `${cornerRadiusPx}px`,
                        borderWidth: `${borderWidthPx}px`,
                      }}
                    >
                      <iframe
                        src={musicPreview.embedUrl}
                        title={
                          preview?.title || `${musicPreview.sourceLabel} player`
                        }
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        className="w-full h-[152px] rounded-md border border-border bg-black"
                      />
                      <div className="flex flex-col gap-1">
                        <strong className="text-xs font-semibold line-clamp-1">
                          {preview?.title ||
                            `${musicPreview.sourceLabel} track`}
                        </strong>
                        {preview?.description && (
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {preview.description}
                          </span>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {musicPreview.actions.map((action, index) => (
                            <a
                              key={`${message.id}-${url}-${action.label}`}
                              href={action.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "text-xs font-medium px-2.5 py-0.5 rounded-full border transition-colors",
                                index === 0
                                  ? "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                                  : "border-border bg-transparent text-muted-foreground hover:bg-accent",
                              )}
                            >
                              Play on {action.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                }

                if (youtubeEmbedUrl) {
                  return (
                    <article
                      key={`${message.id}-${url}`}
                      className="w-full max-w-[980px] rounded-lg border border-border bg-muted p-2.5 flex flex-col gap-2"
                      style={{
                        borderRadius: `${cornerRadiusPx}px`,
                        borderWidth: `${borderWidthPx}px`,
                      }}
                    >
                      <iframe
                        src={youtubeEmbedUrl}
                        title={preview?.title || "YouTube video"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full aspect-video rounded-md border border-border bg-black"
                      />
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-xs font-semibold line-clamp-1">
                          {preview?.title || "YouTube video"}
                        </strong>
                        {preview?.description && (
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {preview.description}
                          </span>
                        )}
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-muted-foreground underline underline-offset-2 break-all"
                        >
                          {url}
                        </a>
                      </div>
                    </article>
                  );
                }

                /* Standard link preview */
                return (
                  <a
                    key={`${message.id}-${url}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "rounded-lg border border-border bg-muted p-2.5 no-underline hover:bg-accent transition-colors",
                      preview?.image_url
                        ? "flex gap-3 items-start"
                        : "flex flex-col gap-1",
                    )}
                    style={{
                      borderRadius: `${cornerRadiusPx}px`,
                      borderWidth: `${borderWidthPx}px`,
                    }}
                  >
                    {preview?.image_url && (
                      <img
                        src={preview.image_url}
                        alt={preview?.title || "Link preview"}
                        className="w-auto max-w-[100px] h-[72px] object-cover rounded border border-border shrink-0"
                      />
                    )}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <strong className="text-xs font-semibold text-foreground line-clamp-1">
                        {preview?.title || preview?.site_name || url}
                      </strong>
                      {preview?.description && (
                        <span className="text-[11px] text-muted-foreground line-clamp-2">
                          {preview.description}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground break-all opacity-70">
                        {url}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div
              className={cn(
                "mt-2 flex flex-wrap gap-2",
                showAvatars ? "pl-[2.375rem]" : "pl-0",
              )}
            >
              {message.attachments.map((attachment) =>
                attachment.mime_type.startsWith("image/") ? (
                  <button
                    key={attachment.id}
                    type="button"
                    aria-label={`Open image ${attachment.original_name}`}
                    onClick={() => onOpenLightbox(attachment.id)}
                    className="p-0 border-0 bg-transparent cursor-zoom-in rounded-lg overflow-hidden"
                  >
                    <img
                      src={attachment.public_url}
                      alt={attachment.original_name}
                      className="w-[120px] h-[88px] object-cover rounded-lg border border-border"
                    />
                  </button>
                ) : (
                  <a
                    key={attachment.id}
                    href={attachment.public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    {attachment.original_name}
                  </a>
                ),
              )}
            </div>
          )}

          {/* Footer row: reactions (left) */}
          <div
            className={cn(
              "mt-2 flex items-end justify-between gap-2",
              showAvatars ? "pl-[2.375rem]" : "pl-0",
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {message.reactions.map((reaction) => (
                <button
                  key={`${message.id}-${reaction.emoji}`}
                  type="button"
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-border bg-muted hover:bg-accent transition-colors"
                  onClick={() =>
                    onToggleReaction
                      ? void onToggleReaction(message.id, reaction.emoji)
                      : undefined
                  }
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
              {onToggleReaction && (
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-xs hover:bg-accent transition-colors"
                  onClick={() =>
                    setOpenEmojiPickerMessageId((prev) =>
                      prev === message.id ? null : message.id,
                    )
                  }
                  aria-label="Add reaction"
                >
                  🙂
                </button>
              )}
            </div>
            <div />
          </div>
        </article>
      ))}
    </div>
  );
}
