# RegPipeline — Design System

A compact, dark, data-intelligence aesthetic: near-black canvas, a single electric-blue accent,
generous negative space, and monospace for anything machine-generated. Implemented with Tailwind
(CDN) + a Material-3-derived token set in `public/index.html`; rendered by `public/app.js`.

## 1. Color

| Token | Hex | Use |
|---|---|---|
| `background` / canvas | `#080C14` → `#0b1323` | page background |
| `surface-container` | `#182030` | sidebar, header, cards |
| `glass-card` | `#101828` / border `#1C2C42` | primary card surface |
| **`primary`** (accent) | `#0073E6` / text `#abc7ff` | actions, focus, the one accent |
| `on-surface` | `#dbe2f9` | body text |
| `on-surface-variant` | `#c1c6d6` / muted `#8fa0bf` | secondary text |
| success | `#22c55e` (green-500) | healthy, approved |
| warning | `#eab308` (yellow-500) | delayed, schema change, stale |
| error | `#ff5470` / `#ffb4ab` | broken, HIGH impact, downtime |

**Rule:** exactly one accent (blue). Status is the only other color vocabulary — green/amber/red —
and it always means health, never decoration.

## 2. Typography

- **Inter** (400/600/700/800/900) for UI; **JetBrains Mono** for data, IDs, SQL, telemetry.
- Scale: `headline-lg` 32/40 (-0.02em), `headline-md` 24/32, `headline-sm` 20/28,
  `body-lg` 16/24, `body-md` 14/20, `body-sm` 12/18, `label-md` 12/16 (0.05em, uppercase).
- Monospace (`mono-data` 13/20) signals "this came from a machine" — connector states, sync IDs,
  `ALTER TABLE …`, audit entries.

## 3. Spacing & radius
- 4px base scale: `xs`4 · `sm`8 · `md`16 · `lg`24 · `xl`32; desktop gutter 32px, mobile 16px.
- Radius: cards `xl` (0.5rem) / `full` (0.75rem); pills fully rounded.
- Layout: fixed 256px sidebar + sticky header; content max-width 1400px; the signature
  `asymmetric-grid` is 2fr / 1fr (collapses to 1col < 1024px).

## 4. Components
- **Glass card** — `#101828` + `#1C2C42` border; hover lifts border to `primary` with a soft glow.
- **Status pill** — uppercase `label-md`, tinted bg at 10%, 1px border at 20–30% (HEALTHY / DELAYED / SCHEMA Δ).
- **Impact bar** — colored progress fill (HIGH 4/5, MED 2/5, LOW 1/5) keyed to status color.
- **Approval bar** — fixed bottom, primary-tinted top border, pulsing bolt; the only place a
  consequential action lives. Reject (ghost) + Approve (filled).
- **Judge Tour** — spotlight (`box-shadow: 0 0 0 9999px` dim) + a stepper card; the guided
  walkthrough for reviewers.
- **Toast** — bottom-center, surface-highest + primary border, auto-dismiss 5s.

## 5. Motion
- `fade-in` 0.4s (translateY 8px → 0) on view/card mount.
- `glow-pulse` 2s loop on live status dots and the approval bolt.
- `spin` 1s on the refresh/sync icon and loading skeletons; `animate-pulse` skeletons on first paint.
- Buttons: `active:scale-95`, `hover:brightness-110`. Nothing decorative moves — motion only marks
  *liveness* (a sync running) or *state change* (a view loading).

## 6. Voice
Terse, operational, audit-grade. "Intervention required," "Schema Change Detected," "1 HIGH-impact
DORA threshold change requires action by July 1." Numbers are concrete and sourced; nothing is
hand-wavy. The product should read like a compliance console, not a consumer app.
