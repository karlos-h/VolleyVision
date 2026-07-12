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

### Mode tokens (light default, dark supported)

| Role | Light | Dark |
|---|---|---|
| Background | `white` | `navy-900` |
| Surface / card | `grey-50` | `#1A2745` (navy-800) |
| Text primary | `grey-900` | `white` |
| Text secondary | `grey-600` | `navy-300` |
| Primary action | `navy-700` | `gold-500` (navy is invisible on navy) |
| Accent | `gold-500` | `gold-500` |
| Border | `grey-200` | `#2A3A63` |

### Chart palette (in order)
1. `navy-700` 2. `gold-500` 3. `navy-500` 4. `info #2B7FD4` 5. `#7A5FB8` (violet) 6. `grey-400`
Positive/negative deltas always use `success`/`error`.

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
