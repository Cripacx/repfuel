# DESIGN.md — [Product name]

> The written design system for this project. Read before building a screen;
> update in the same change that needed the update. Every value carries the
> reason it exists — a token without a reason gets ignored.
>
> Rule: an off-system value is either a **declared extension below** or it gets
> **flagged**. Never invented silently.

Last updated: [date] · Character decided: [date]

---

## 0 · Character

The four axis decisions everything else follows from.

| Axis | Decision | Because |
|---|---|---|
| Type | [choice, scale ratio, weight strategy] | [reason] |
| Color | [choice, saturation, where accent appears] | [reason] |
| Space | [density register, container width] | [reason] |
| Finish | [surface treatment, radius register, motion register] | [reason] |

Consciously avoided: [defaults rejected, e.g. violet gradient, uniform padding]

---

## 1 · Foundations

### Color

**Primitives** — raw values, never used directly in components.

```css
--gray-50 … --gray-900   /* [scale source / how generated] */
--brand-50 … --brand-900
```

**Semantic** — what components reference.

| Token | Value | Used for |
|---|---|---|
| `--color-bg` | | page background |
| `--color-surface` | | cards, panels |
| `--color-surface-raised` | | elevated surfaces, popovers |
| `--color-border` | | hairlines, dividers |
| `--color-text` | | body copy |
| `--color-text-muted` | | secondary copy — **must clear 4.5:1** |
| `--color-primary` | | the one accent; the single primary action per view |
| `--color-success` / `--color-warning` / `--color-error` | | status, always paired with an icon |

Dark mode: [same semantic names, different primitive mapping — list the swaps]

Contrast floors: body 4.5:1 · large text 3:1 · focus ring 3:1. Never color alone.

### Type

| Token | Size / weight / line-height | Used for |
|---|---|---|
| `--text-display` | | hero only |
| `--text-h1` … `--text-h3` | | headings |
| `--text-body` | | default |
| `--text-sm` / `--text-xs` | | metadata, captions |

Families: [heading font] / [body font] / [mono, if used, for what]
Scale ratio: [x] because [reason]

### Space

4px base scale: `--space-1: 4` … `--space-16: 64`.

| Context | Token | Value |
|---|---|---|
| Inside a group (related fields, list items) | | |
| Between groups / sections | | |
| Card padding | | |
| Page container | | max-width [x] |

### Radius

Scale: [list]. Element mapping: tooltip [x] · input [x] · card [x] · modal [x] · panel [x].
Nesting rule: `inner = outer − padding`.

### Elevation

| Level | Shadow | Used for |
|---|---|---|
| 0 | none | flush surfaces |
| 1 | [layered stack] | cards |
| 2 | [layered stack] | dropdowns, popovers |
| 3 | [layered stack] | modals |

Dark mode uses lighter surfaces instead of shadows: [list the surface steps].

### Motion

| Token | Value | Used for |
|---|---|---|
| `--dur-fast` | 150ms | menus, hovers |
| `--dur-base` | 250ms | entrances |
| `--dur-slow` | 400ms | large transitions |
| `--ease-out` | | entrances |
| `--ease-in-out` | | movement |
| `--ease-spring` | | presses, confirmations |

Exits run ~40% faster than their entrance. Respect `prefers-reduced-motion`.

---

## 2 · Components

For each: variants, sizes, states implemented, tokens used.

### Button
Variants: primary · secondary · ghost · destructive
Sizes: sm / md / lg — heights [x]
States: default · hover · focus · active · disabled · loading
Rules: one primary per view · destructive never adjacent to a routine action · label names the outcome

### Input
[same structure — see modules/form-ux.md for the state list]

### Card
### Modal / Sheet / Popover
[which one for which weight of interaction]

### Table
Columns default: [n] · density tokens: [36/48/60] · sort: tri-state

### [others]

---

## 3 · Voice

- Buttons name the reward, not the mechanic
- Errors: what broke + what to do next
- Empty states: one sentence + one CTA
- Tone: [e.g. plain, warm, no exclamation marks, no "oops"]
- Terminology: [the words this product uses — and the ones it doesn't]

---

## 4 · Extensions log

Values added after the initial system, each with its reason. If this list grows
fast, the foundations are too narrow — fix the scale rather than the list.

| Date | Token / value | Why it was needed |
|---|---|---|
| | | |

---

## 5 · Known exceptions

Deliberate one-offs that should **not** become tokens, with the reason they're
allowed to exist.

| Location | Value | Why it's an exception |
|---|---|---|
| | | |
