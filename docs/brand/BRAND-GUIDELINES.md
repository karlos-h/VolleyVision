# VolleyVision — Brand Guidelines
**Version 1.0 · 12 July 2026**
Reference this file for all UI, copy, and design work across VolleyVision.

Colour inspiration: Canterbury Hornby Volleyball Club (navy + white). Typography is our own — chosen for the app, not borrowed from the club.

---

## 1. Brand Voice

**Personality:** Analytical at its core, energetic at the right moments. VolleyVision is a serious stats tool that still feels like it belongs courtside — precise with data, motivating with people.

**Three voice traits:**

1. **Precise** — Numbers are never vague. Say "Kill efficiency up 12% over 5 matches", not "You're doing great lately".
2. **Motivating** — Frame stats as progress and opportunity, not judgement. Errors are "areas to attack next", not failures.
3. **Direct** — Short sentences. Volleyball vocabulary (kill, dig, ace, side-out, rally) used naturally, never over-explained to this audience.

**Tone by context:**

| Context | Tone | Example |
|---|---|---|
| Dashboards / stats | Neutral, precise | "Serve receive: 2.1 avg rating this season" |
| Insights / trends | Energetic, motivating | "Your ace rate doubled this month. Keep serving aggressive." |
| Empty states | Encouraging, action-first | "No matches yet — record your first match to unlock your stats." |
| Errors | Calm, plain, helpful | "Couldn't save that event. Check your connection and try again." |
| Onboarding / marketing | Punchy, athlete-first | "Track every touch. Own every rally." |

**Do:** active voice, second person ("your kill rate"), specific numbers, volleyball terms.
**Don't:** exclamation marks in stats contexts, jargon like "leverage/utilize", hype without data, blame framing ("you failed 6 serves" → "6 serve errors — down from 9 last match").

**Tagline direction:** "See the game. Raise your game." / "Track every touch."

---

## 2. Colour Scheme

### Core palette

| Token | Hex | Use |
|---|---|---|
| `navy-900` | `#111C36` | Dark-mode background, darkest text |
| `navy-700` | `#1E2D50` | **Primary brand colour** (Hornby navy) — headers, primary buttons, nav |
| `navy-500` | `#33477A` | Hover states, secondary elements, chart series 2 |
| `navy-300` | `#8FA0C4` | Muted text on navy, disabled states, gridline accents |
| `navy-100` | `#E4E9F4` | Light tints, selected-row backgrounds, badges |
| `gold-500` | `#FFB81C` | **Accent** — CTAs, highlights, active states, key chart series |
| `gold-600` | `#E09E00` | Accent hover / pressed |
| `gold-200` | `#FFE099` | Accent tint backgrounds |
| `white` | `#FFFFFF` | Light-mode background, text on navy |

### Neutrals

| Token | Hex | Use |
|---|---|---|
| `grey-900` | `#1A1D23` | Primary text (light mode) |
| `grey-600` | `#5A6270` | Secondary text |
| `grey-400` | `#9AA1AD` | Placeholder, disabled text |
| `grey-200` | `#E2E5EA` | Borders, dividers |
| `grey-50` | `#F6F7F9` | Page background (light mode), card wells |

### Semantic

| Token | Hex | Use |
|---|---|---|
| `success` | `#2E9E5B` | Kills, aces, positive trends |
| `error` | `#D64545` | Errors (skill + system), negative trends |
| `warning` | `#E8890C` | Cautions, incomplete data (distinct from gold — warmer/orange) |
| `info` | `#2B7FD4` | Informational banners, neutral stats |

### Mode tokens (light default, dark = future phase)

Light mode is what ships today. Surfaces are **layered** — the app canvas sits
*behind* chrome and cards, both of which are white and separated from the canvas
by a `grey-200` border. Don't collapse this into a single "background/surface"
pair: the canvas-vs-card distinction is what gives the dashboard its depth.

| Role | Light | Dark (future) |
|---|---|---|
| App canvas (scrollable area behind cards) | `grey-50` | `navy-900` |
| Chrome (sidebar, topbar controls) | `white` | `#0C1428` |
| Card (KPI tiles, chart + list panels) | `white` | `#1A2745` (navy-800) |
| Recessed fill (chips, wells, hover surfaces) | `grey-50` | `navy-700` |
| Card / chrome border | `grey-200` | `#2A3A63` |
| Text primary | `grey-900` | `white` |
| Text secondary | `grey-600` | `navy-300` |
| Text muted / placeholder | `grey-400` | `#5A668C` |
| Brand navy (logo, links, active nav text/icons) | `navy-700` | `white` |
| Active nav item background | `navy-100` | `gold-500 @ 10%` |
| Active nav item left accent bar | `gold-500` | `gold-500` |
| Avatar chip | `navy-500` fill, `gold-500` 2px border | same |
| Primary action | `gold-500` fill, `navy-900` text | same |
| Secondary action | `navy-700` fill, `white` text | `navy-700` fill, `white` text |
| Positive / negative delta badge | `success` / `error` on a 15% tint of itself | `success.dark` / `error.dark` |

**Theme-invariant:** gold accent, the semantic colours (`success` / `error` /
`warning` / `info`), and all typography are the same in both modes. Only the
**navy/grey surface and text roles flip.** The one nuance is the semantic pair:
light mode uses the `success` / `error` DEFAULT tones, and dark mode uses the
`.dark` variants (`#4CBF7F` / `#E86A6A`), which are brightened for contrast on a
navy surface and lose contrast on white. Never use the `-dark` variants in
light-mode UI.

**Exception — the tracking screen** (`/track/:matchId`) stays dark in both modes.
Courtside legibility beats theme consistency, so it pins explicit `navy-*` /
`white` classes rather than inheriting the shared surface tokens.

### Chart palette (in order)
1. `gold-500` 2. `navy-500` 3. `info #2B7FD4` 4. `#7A5FB8` (violet) 5. `grey-400` 6. `navy-300`
The primary series is gold so the headline metric reads first. Positive/negative
deltas always use `success`/`error`.

Charts must import these from `frontend/src/lib/chartColors.ts` — never hardcode
a hex in chart code. That file is the single switch that re-themes every chart,
court diagram, and heat map at once.

### Usage rules
- Gold is an accent, not a theme: ≤10% of any screen. One gold CTA per view.
- Never place gold text on white or navy-300 — fails contrast. Gold works as fills/backgrounds with `navy-900` text on it.
- Text on `navy-700`: white or `navy-100` only.
- 60/30/10 rule: ~60% background neutrals, ~30% navy, ~10% gold + semantic.

---

## 3. Typography

| Role | Font | Weights | Notes |
|---|---|---|---|
| Display / headings | **Barlow Semi Condensed** | 600, 700 | Athletic, condensed sports feel without being a jersey font. Uppercase for hero/marketing only. |
| Body / UI | **Inter** | 400, 500, 600 | Workhorse for labels, tables, paragraphs. |
| Stats / numbers | **Inter** with `font-variant-numeric: tabular-nums` | 600, 700 | Tabular figures so columns of stats align. |

Both are free on Google Fonts.

### Type scale (rem, 16px base)

| Token | Size / line | Font | Use |
|---|---|---|---|
| `display` | 2.5 / 1.1 | Barlow SC 700 | Hero, big stat numbers |
| `h1` | 1.75 / 1.2 | Barlow SC 700 | Page titles |
| `h2` | 1.375 / 1.25 | Barlow SC 600 | Section headers, card titles |
| `h3` | 1.125 / 1.3 | Inter 600 | Sub-sections, table headers |
| `body` | 1 / 1.5 | Inter 400 | Default text |
| `small` | 0.875 / 1.4 | Inter 400/500 | Secondary info, captions |
| `stat-lg` | 2 / 1.1 | Inter 700 tabular | KPI numbers on dashboards |
| `stat-sm` | 1 / 1.2 | Inter 600 tabular | Inline stats, table cells |

Rules: sentence case everywhere except hero/marketing headlines; no italics for emphasis (use weight or navy colour); minimum 0.875rem for any data users must read.

---

## 4. Quick reference (CSS variables)

```css
:root {
  --vv-navy-900:#111C36; --vv-navy-700:#1E2D50; --vv-navy-500:#33477A;
  --vv-navy-300:#8FA0C4; --vv-navy-100:#E4E9F4;
  --vv-gold-600:#E09E00; --vv-gold-500:#FFB81C; --vv-gold-200:#FFE099;
  --vv-grey-900:#1A1D23; --vv-grey-600:#5A6270; --vv-grey-400:#9AA1AD;
  --vv-grey-200:#E2E5EA; --vv-grey-50:#F6F7F9;
  --vv-success:#2E9E5B; --vv-error:#D64545; --vv-warning:#E8890C; --vv-info:#2B7FD4;
  --vv-font-display:'Barlow Semi Condensed',sans-serif;
  --vv-font-body:'Inter',sans-serif;
}
```
