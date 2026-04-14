import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  thread_root_message_id?: string | null;
  thread_reply_count?: number;
  author_handle: string;
  author_name: string;
  author_avatar_url?: string | null;
  created_at: string;
  reactions: { emoji: string; count: number }[];
  attachments: Attachment[];
};

type MessageListProps = {
  messages: Message[];
  linkPreviews: Record<string, LinkPreview>;
  onOpenThread: (rootMessageId: string) => void;
  onOpenLightbox: (attachmentId: string) => void;
};

export function MessageList({
  messages,
  linkPreviews,
  onOpenThread,
  onOpenLightbox,
}: MessageListProps) {
  const { resolvedTheme } = useTheme();
  return (
    <div className="flex flex-col gap-1.5 py-3 overflow-y-auto">
      {messages.map((message) => (
        <article
          key={message.id}
          className="group rounded-lg border-b border-border px-3 py-2.5 hover:bg-accent/40 transition-colors"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage
                src={message.author_avatar_url ?? undefined}
                alt={`${message.author_name} avatar`}
              />
              <AvatarFallback className="text-[10px] font-semibold">
                {initialsFromName(message.author_name)}
              </AvatarFallback>
            </Avatar>
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
            </div>
          </div>

          {/* Body */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap mt-0 mb-0 pl-[2.375rem]">
            {message.body}
          </p>

          {/* Link previews */}
          {extractUrls(message.body).length > 0 && (
            <div className="mt-2 pl-[2.375rem] flex flex-col gap-2">
              {extractUrls(message.body).map((url) => {
                const preview = linkPreviews[url];
                const musicPreview = getMusicPreview(
                  url,
                  preview,
                  resolvedTheme,
                );
                const youtubeEmbedUrl = getYouTubeEmbedUrl(url);

                if (musicPreview) {
                  return (
                    <article
                      key={`${message.id}-${url}`}
                      className="rounded-lg border border-border p-2.5 flex flex-col gap-2"
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
                      className="rounded-lg border border-border bg-muted p-2.5 flex flex-col gap-2"
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
            <div className="mt-2 pl-[2.375rem] flex flex-wrap gap-2">
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

          {/* Reactions */}
          {message.reactions.length > 0 && (
            <div className="mt-2 pl-[2.375rem] flex flex-wrap gap-1.5">
              {message.reactions.map((reaction) => (
                <span
                  key={`${message.id}-${reaction.emoji}`}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-border bg-muted"
                >
                  {reaction.emoji} {reaction.count}
                </span>
              ))}
            </div>
          )}

          {/* Thread action */}
          <div className="mt-2 pl-[2.375rem] opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => void onOpenThread(message.id)}
            >
              {message.thread_reply_count
                ? `${message.thread_reply_count} ${message.thread_reply_count === 1 ? "reply" : "replies"}`
                : "Reply in thread"}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
