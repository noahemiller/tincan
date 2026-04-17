import { FormEvent, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { initialsFromName } from '@/lib/chat';

type ThreadMessage = {
  id: string;
  body: string;
  author_handle: string;
  author_name: string;
  author_avatar_url?: string | null;
  created_at: string;
  attachments: { id: string; mime_type: string; original_name: string; public_url: string }[];
};

type ThreadPanelProps = {
  threadMessages: ThreadMessage[];
  threadComposer: string;
  setThreadComposer: (v: string) => void;
  onSendThreadMessage: (e: FormEvent<HTMLFormElement>) => void;
  selectedThreadRootId: string;
  onCloseThread: () => void;
  busy: boolean;
};

/* ─── Small reusable accordion ────────────────────────────────────────────── */
function Accordion({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2 text-xs font-semibold',
          'text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors'
        )}
      >
        {label}
        <span className="text-[10px] leading-none">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-1 pb-2">{children}</div>}
    </div>
  );
}

function ThreadContent({
  threadMessages,
  threadComposer,
  setThreadComposer,
  onSendThreadMessage,
  selectedThreadRootId,
  onCloseThread,
  busy,
}: ThreadPanelProps) {
  return (
    <>
      {selectedThreadRootId && (
        <Accordion label="Thread" defaultOpen>
          <div className="flex justify-end mb-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCloseThread}>
              Close
            </Button>
          </div>
          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto mb-2">
            {threadMessages.map((msg) => (
              <article
                key={msg.id}
                className="rounded-md border border-border bg-background px-2.5 py-2 flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage
                      src={msg.author_avatar_url ?? undefined}
                      alt={`${msg.author_name} avatar`}
                    />
                    <AvatarFallback className="text-[9px] font-semibold">
                      {initialsFromName(msg.author_name)}
                    </AvatarFallback>
                  </Avatar>
                  <strong className="text-xs font-semibold">{msg.author_name}</strong>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap pl-7 mt-0 mb-0">
                  {msg.body}
                </p>
              </article>
            ))}
          </div>
          <form
            autoComplete="off"
            onSubmit={onSendThreadMessage}
            className="flex flex-col gap-1.5"
          >
            <Input
              placeholder="Reply in thread…"
              value={threadComposer}
              onChange={(e) => setThreadComposer(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy}>
              Reply
            </Button>
          </form>
        </Accordion>
      )}
    </>
  );
}

export function ThreadPanel(props: ThreadPanelProps) {
  return (
    <aside className="sidebar unread flex flex-col gap-1 py-2 border-l border-border bg-card h-full overflow-y-auto">
      <ThreadContent {...props} />
    </aside>
  );
}
