/**
 * DesignSystemPage
 * src/components/DesignSystemPage.tsx
 *
 * Render when Rail tab === 'design'.
 * Covers: colors, typography, buttons, inputs, badges, avatar.
 */

import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/* ─── Layout helpers ─────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-2 m-0">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-5 min-h-8">
      <span className="text-[11px] font-mono text-muted-foreground w-44 shrink-0">{label}</span>
      <div className="flex items-center flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* ─── Color swatch ───────────────────────────────────────────────────────── */

function Swatch({
  cssVar,
  label,
  textOverlay,
}: {
  cssVar: string;
  label: string;
  textOverlay?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-16">
      <div
        className="w-16 h-10 rounded-md border border-border/60 flex items-center justify-center"
        style={{ background: `hsl(var(${cssVar}))` }}
      >
        {textOverlay && (
          <span className="text-[10px] font-semibold select-none" style={{ color: `hsl(var(${textOverlay}))` }}>
            Aa
          </span>
        )}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground text-center leading-tight break-all">
        {label}
      </span>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */

export function DesignSystemPage() {
  const [inputVal, setInputVal] = useState('');

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto px-8 py-10 flex flex-col gap-12">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight m-0">Design System</h1>
          <p className="text-sm text-muted-foreground m-0">
            Tincan UI tokens and components. Toggle light/dark in the rail to preview both modes.
          </p>
        </div>

        {/* ── Colors ────────────────────────────────────────────────────── */}
        <Section title="Colors">

          <div className="flex flex-col gap-6">

            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium m-0">Surfaces</p>
              <div className="flex flex-wrap gap-3">
                <Swatch cssVar="--background"  label="background"  textOverlay="--foreground" />
                <Swatch cssVar="--card"        label="card"        textOverlay="--card-foreground" />
                <Swatch cssVar="--muted"       label="muted"       textOverlay="--muted-foreground" />
                <Swatch cssVar="--accent"      label="accent"      textOverlay="--accent-foreground" />
                <Swatch cssVar="--popover"     label="popover"     textOverlay="--popover-foreground" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium m-0">Interactive</p>
              <div className="flex flex-wrap gap-3">
                <Swatch cssVar="--primary"     label="primary"     textOverlay="--primary-foreground" />
                <Swatch cssVar="--secondary"   label="secondary"   textOverlay="--secondary-foreground" />
                <Swatch cssVar="--destructive" label="destructive" textOverlay="--destructive-foreground" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium m-0">Structure</p>
              <div className="flex flex-wrap gap-3">
                <Swatch cssVar="--border"  label="border" />
                <Swatch cssVar="--input"   label="input" />
                <Swatch cssVar="--ring"    label="ring" />
              </div>
            </div>

          </div>

          {/* Token table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">CSS var</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tailwind</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Used for</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {([
                  ['--background',      'bg-background',         'Root page background'],
                  ['--foreground',      'text-foreground',       'Primary text'],
                  ['--card',            'bg-card',               'Raised surfaces, bubbles'],
                  ['--muted',           'bg-muted',              'Subtle fills, tags, code'],
                  ['--muted-foreground','text-muted-foreground', 'Secondary text, meta, timestamps'],
                  ['--border',          'border-border',         'All dividers and outlines'],
                  ['--primary',         'bg-primary',            'Default filled button'],
                  ['--secondary',       'bg-secondary',          'Outline-style button, unread badge'],
                  ['--destructive',     'bg-destructive',        'Error and danger states'],
                  ['--accent',          'bg-accent',             'Hover fill on interactive items'],
                  ['--ring',            'ring-ring',             'Focus ring'],
                ] as [string, string, string][]).map(([token, cls, note]) => (
                  <tr key={token} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{token}</td>
                    <td className="px-3 py-2 font-mono">{cls}</td>
                    <td className="px-3 py-2 text-muted-foreground">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </Section>

        <Separator />

        {/* ── Typography ────────────────────────────────────────────────── */}
        <Section title="Typography">

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-baseline justify-between">
            <span className="text-sm font-sans">IBM Plex Sans — 400 · 500 · 600</span>
            <span className="text-[11px] font-mono text-muted-foreground">font-sans</span>
          </div>

          <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden">
            {([
              { cls: 'text-2xl font-semibold tracking-tight', label: 'text-2xl semibold',  sample: 'Page Title',           note: 'Page / modal headings' },
              { cls: 'text-xl font-semibold tracking-tight',  label: 'text-xl semibold',   sample: 'Section Heading',      note: 'Section headings' },
              { cls: 'text-base font-semibold',               label: 'text-base semibold', sample: 'Card Heading',         note: 'Card, panel headings' },
              { cls: 'text-sm font-semibold',                 label: 'text-sm semibold',   sample: 'Author Name',          note: 'Author name, channel name' },
              { cls: 'text-sm',                               label: 'text-sm',            sample: 'Message body copy.',   note: 'All body text' },
              { cls: 'text-xs font-medium text-muted-foreground', label: 'text-xs medium',  sample: 'Section label',       note: 'Labels, section headers' },
              { cls: 'text-[11px] text-muted-foreground',    label: 'text-[11px]',        sample: '2 hours ago · @handle', note: 'Timestamps, captions' },
              { cls: 'text-[10px] font-mono text-muted-foreground', label: 'text-[10px] mono', sample: 'a3f9b2c1',        note: 'IDs, URLs, code' },
            ] as { cls: string; label: string; sample: string; note: string }[]).map(({ cls, label, sample, note }) => (
              <div key={label} className="flex items-center gap-4 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <span className={cn(cls, 'flex-1 min-w-0')}>{sample}</span>
                <span className="text-[10px] font-mono text-muted-foreground w-40 shrink-0 text-right hidden sm:block">{label}</span>
                <span className="text-[10px] text-muted-foreground w-44 shrink-0 text-right hidden md:block">{note}</span>
              </div>
            ))}
          </div>

        </Section>

        <Separator />

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <Section title="Buttons">

          <Row label="variant=default">
            <Button>Default</Button>
          </Row>
          <Row label="variant=secondary">
            <Button variant="secondary">Secondary</Button>
          </Row>
          <Row label="variant=ghost">
            <Button variant="ghost">Ghost</Button>
          </Row>
          <Row label="variant=outline">
            <Button variant="outline">Outline</Button>
          </Row>
          <Row label="variant=destructive">
            <Button variant="destructive">Destructive</Button>
          </Row>
          <Row label="variant=link">
            <Button variant="link">Link button</Button>
          </Row>

          <Separator className="my-1" />

          <Row label="size=lg">
            <Button size="lg">Large</Button>
          </Row>
          <Row label="size=default">
            <Button>Default</Button>
          </Row>
          <Row label="size=sm">
            <Button size="sm">Small</Button>
          </Row>
          <Row label="size=icon">
            <Button size="icon" aria-label="settings">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </Button>
          </Row>

          <Separator className="my-1" />

          <Row label="disabled">
            <Button disabled>Default</Button>
            <Button variant="secondary" disabled>Secondary</Button>
            <Button variant="ghost" disabled>Ghost</Button>
          </Row>

        </Section>

        <Separator />

        {/* ── Inputs ────────────────────────────────────────────────────── */}
        <Section title="Inputs">

          <Row label="Input default">
            <Input
              placeholder="Placeholder text…"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-64"
            />
          </Row>
          <Row label="Input disabled">
            <Input placeholder="Disabled" disabled className="w-64" />
          </Row>
          <Row label="Input + Button">
            <div className="flex gap-1.5">
              <Input placeholder="Search…" className="w-52" />
              <Button size="sm">Go</Button>
            </div>
          </Row>
          <Row label="select">
            <select className="rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48">
              <option>Pick an option</option>
              <option>Option A</option>
              <option>Option B</option>
            </select>
          </Row>
          <Row label="textarea">
            <textarea
              placeholder="Write something…"
              rows={3}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical w-64"
            />
          </Row>

        </Section>

        <Separator />

        {/* ── Badges ────────────────────────────────────────────────────── */}
        <Section title="Badges">

          <Row label="variant=default">
            <Badge>Default</Badge>
          </Row>
          <Row label="variant=secondary">
            <Badge variant="secondary">Secondary</Badge>
          </Row>
          <Row label="variant=outline">
            <Badge variant="outline">Outline</Badge>
          </Row>
          <Row label="variant=destructive">
            <Badge variant="destructive">Destructive</Badge>
          </Row>
          <Row label="unread count pill">
            <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 min-w-[1.25rem] text-center">3</Badge>
            <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 min-w-[1.25rem] text-center">12</Badge>
            <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 min-w-[1.25rem] text-center">99+</Badge>
          </Row>

        </Section>

        <Separator />

        {/* ── Avatar ────────────────────────────────────────────────────── */}
        <Section title="Avatar">

          <Row label="sizes">
            {([
              { size: 'h-10 w-10', label: '40' },
              { size: 'h-8 w-8',   label: '32' },
              { size: 'h-7 w-7',   label: '28' },
              { size: 'h-6 w-6',   label: '24' },
              { size: 'h-5 w-5',   label: '20' },
            ] as { size: string; label: string }[]).map(({ size, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Avatar className={size}>
                  <AvatarFallback className="text-[10px] font-semibold">AB</AvatarFallback>
                </Avatar>
                <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
              </div>
            ))}
          </Row>

        </Section>

        <div className="h-12" />
      </div>
    </div>
  );
}
