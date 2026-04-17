type MockMessage = {
  id: string;
  author: "you" | "other";
  name: string;
  time: string;
  body: string;
};

const MOCK_CONVERSATION: MockMessage[] = [
  {
    id: "dm-1",
    author: "other",
    name: "Jordan",
    time: "9:14 AM",
    body: "Hey! You still down to test the new can design later?",
  },
  {
    id: "dm-2",
    author: "you",
    name: "You",
    time: "9:16 AM",
    body: "Yep. I want to compare the embossed logo versions side by side.",
  },
  {
    id: "dm-3",
    author: "other",
    name: "Jordan",
    time: "9:18 AM",
    body: "Perfect. I'll bring both prototypes and a fresh marker pack.",
  },
  {
    id: "dm-4",
    author: "you",
    name: "You",
    time: "9:20 AM",
    body: "Amazing. Let's meet in the studio after lunch.",
  },
];

export function DirectMessagesMock() {
  return (
    <section className="flex flex-col h-full overflow-hidden bg-background">
      <header className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold m-0">Direct Messages</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-0">
          Dummy conversation for the default DM view.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl flex flex-col gap-3">
          {MOCK_CONVERSATION.map((message) => {
            const isYou = message.author === "you";
            return (
              <article
                key={message.id}
                className={`flex flex-col gap-1 ${isYou ? "items-end" : "items-start"}`}
              >
                <div className="text-[11px] text-muted-foreground px-1">
                  <span className="font-medium">{message.name}</span> -{" "}
                  <span>{message.time}</span>
                </div>
                <p
                  className={`m-0 max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed border border-border ${
                    isYou
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      <footer className="px-4 py-3 border-t border-border">
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Mock mode: composer is disabled in this placeholder view.
        </div>
      </footer>
    </section>
  );
}
