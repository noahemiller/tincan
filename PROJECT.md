# Tincan — Project Overview

Private, self-hostable chat platform for small trusted communities. Inspired by Discord/Slack but built to be run on infrastructure you own.

---

## Monorepo layout

```
tincan/
├── apps/
│   ├── api/          Fastify + Node.js + PostgreSQL backend
│   └── web/          React 18 + Vite frontend
├── packages/
│   └── config/       Shared TypeScript base config
├── docs/             Specs, ADRs, runbooks, work logs
└── docker-compose.yml
```

**Package manager:** pnpm 10 (workspaces)

---

## Stack

### Backend (`apps/api`)
- **Runtime:** Node.js, TypeScript
- **Framework:** Fastify 4
- **Database:** PostgreSQL (with migrations)
- **Auth:** JWT access + refresh tokens, bcrypt passwords, invite-code server membership

### Frontend (`apps/web`)
- **Framework:** React 18 + TypeScript
- **Build:** Vite 5
- **Styling:** Tailwind CSS v3 + shadcn/ui component primitives
- **UI primitives:** Radix UI headless components
- **Utilities:** `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`

---

## Key features implemented

- Multi-server workspace with invite-code membership
- Channels with unread tracking, snooze, and notification modes
- Threaded messages, emoji reactions, file attachments, lightbox gallery
- Link previews with YouTube embeds, Spotify/Apple Music/TIDAL players
- Library system: save links/media from messages, tag with taxonomy terms, curate into collections with drag-to-reorder
- Full-text message search
- User profile, avatar, bio, home server
- Custom slash commands (per-user and per-server)
- Accessibility presets: text size (compact/comfortable/large) and contrast modes (default/high/soft/red-green safe)
- **Light and dark mode** with system preference detection and user override

---

## Frontend architecture

### Before this session
The web client was a single monolithic file:

| File | Lines | Role |
|---|---|---|
| `src/App.tsx` | ~2,878 | All UI, state, and handlers |
| `src/styles.css` | ~1,336 | Hand-written CSS |

No component library, no preprocessor, no dark mode.

### After this session
Tailwind CSS, shadcn/ui patterns, and dark mode were introduced. `App.tsx` was broken into purpose-scoped components:

```
src/
├── lib/
│   ├── utils.ts          cn() helper (clsx + tailwind-merge)
│   └── chat.ts           Pure functions: extractUrls, initialsFromName,
│                         getYouTubeEmbedUrl, getMusicPreview, link preview types
├── components/
│   ├── ThemeProvider.tsx  System prefers-color-scheme + localStorage theme context
│   ├── AuthShell.tsx      Login / register / password-reset forms
│   ├── Rail.tsx           Left icon navigation rail (channels / DMs / servers tabs)
│   ├── SidebarPanel.tsx   Contextual sidebar: server list, channel list, DM list
│   ├── AccountMenu.tsx    Profile chip with dropdown (Profile/Settings/Accessibility/Logout)
│   ├── MessageList.tsx    Message bubbles, link previews, reactions, thread button
│   ├── ThreadPanel.tsx    Right-side thread viewer + reply composer + slash commands
│   └── ui/               shadcn-style primitives
│       ├── button.tsx     Button with variant/size CVA
│       ├── input.tsx      Controlled input with ring focus
│       ├── label.tsx      Radix Label
│       ├── badge.tsx      Inline badge chips
│       ├── avatar.tsx     Radix Avatar with image + initials fallback
│       └── separator.tsx  Horizontal/vertical rule
```

`App.tsx` now sits at ~2,333 lines (from ~2,878). Remaining in `App.tsx`: all state, data-fetching handlers, library workspace, account/settings views, lightbox, and the chat composer — candidates for future extraction passes.

---

## Design token system

Tailwind's `darkMode: ['class']` strategy. The `.dark` class on `<html>` is toggled by `ThemeProvider` based on system preference or user override (stored in `localStorage` under `tincan_theme`).

Two token layers coexist:

### shadcn semantic tokens (HSL, in `styles.css`)
Used by Tailwind utilities (`bg-primary`, `text-foreground`, `border-border`, etc.):

| Token | Light | Dark |
|---|---|---|
| `--background` | 55 100% 93% (warm cream) | 241 34% 10% (deep navy) |
| `--foreground` | 241 34% 25% (dark purple) | 240 20% 90% (light lavender) |
| `--primary` | 241 36% 60% (#7776bc) | 241 36% 65% |
| `--secondary` | 247 33% 84% (#cdc7e5) | 241 25% 18% |
| `--muted-foreground` | 244 22% 44% (#5b5787) | 240 15% 60% |
| `--destructive` | 9 100% 65% (#ff674d) | 9 80% 55% |

### Brand gradient tokens (raw CSS vars)
Used by the animated body background and panel frosted-glass surfaces:

| Token | Light | Dark |
|---|---|---|
| `--bg-0/1/2` | Cream, lavender, yellow | Navy blues |
| `--panel` | `rgba(255,255,255,0.78)` | `rgba(30,27,60,0.82)` |
| `--accent-brand` | `#7776bc` | `#9998d4` |
| `--border-brand` | `rgba(119,118,188,0.24)` | `rgba(153,152,212,0.22)` |

### Accessibility overrides
CSS classes on `.app-shell` override the brand tokens. These are unaffected by the dark/light switch and remain fully operational:

- `.contrast-high` — stronger text contrast
- `.contrast-soft` — reduced contrast
- `.contrast-rg-safe` — entirely different palette safe for red/green colorblindness
- `.size-compact / .size-comfortable / .size-large` — 10px / 14px / 18px base font

---

## Configuration files added

| File | Purpose |
|---|---|
| `apps/web/tailwind.config.ts` | Tailwind v3 config: `darkMode: ['class']`, shadcn color tokens, Manrope font, `@/*` path alias |
| `apps/web/postcss.config.js` | PostCSS with `tailwindcss` + `autoprefixer` plugins |
| `apps/web/tsconfig.json` | Added `paths: { "@/*": ["./src/*"] }` for `@/` imports |
| `apps/web/vite.config.ts` | Added `resolve.alias` for `@/` path |

---

## What's next

Remaining work in approximate priority order:

1. **Finish component extraction from `App.tsx`**
   - `LibraryWorkspace` (library grid, collection controls, metadata editor)
   - `AccountWorkspace` (profile form, settings, accessibility panel)
   - `ChatComposer` (message input, file upload, pending media chips)
   - `Lightbox` (image gallery overlay)

2. **Wire the dark mode toggle into Accessibility settings**
   - Add `theme` field to `UiPrefs`
   - Render a theme selector (Light / Dark / System) in the Accessibility panel
   - Call `useTheme().setTheme()` from there

3. **Apply Tailwind utilities to remaining legacy CSS classes**
   - As each component is extracted, replace `className="..."` CSS class references with Tailwind utility classes and remove the corresponding rules from `styles.css`
   - Target: retire `styles.css` entirely (or reduce to a thin global reset)

4. **Add remaining shadcn primitives as needed**
   - `Dialog` — for confirmation overlays, lightbox
   - `Tabs` — for Rail tab logic
   - `Select` — for dropdowns throughout
   - `Tooltip` — for icon-only buttons in the rail and chat header

5. **Responsive layout**
   - Replace media-query CSS with Tailwind responsive prefixes (`md:`, `lg:`)
   - Improve mobile: collapsible sidebar, sheet drawer for panels
