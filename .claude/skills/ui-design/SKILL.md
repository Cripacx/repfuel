---
name: ui-design
description: >-
  Senior-designer reasoning for building and reviewing interfaces, plus 63 UI
  patterns with the exact numbers behind them — timings, contrast ratios, spacing
  scales, state models. Four workflows (design a screen, audit a UI, review a
  diff, restyle existing UI) and seven reasoning modules (intent discovery,
  information hierarchy, state completeness, form UX, feedback and affordance,
  design system, visual character). Use whenever building, styling, reviewing or
  critiquing any interface — web pages, React/Vue components, dashboards, admin
  panels, landing pages, forms, modals, tables, navigation, loading and error
  states, animations, dark mode, design systems. Also when something looks
  "cheap", "off" or "AI-generated" and should feel premium, for design reviews and
  accessibility passes, or when choosing between UI options (modal vs sheet,
  skeleton vs spinner, tabs vs sidebar). Consult it even for small styling tweaks
  — most cheap-looking UI is a few numbers being wrong.
---

# UI Design

Models build interfaces for the data model: a table gets a column per field,
every action gets equal weight, and the happy path is the only path that exists.
Senior designers build for **user intent**: who is here, what job did they come
for, and what is the worst mistake they could make.

This skill forces the second. It has three layers — pick the entry point that
matches the request.

## Layer 1 · Workflows (start here)

Read the workflow file and follow it end to end.

| Request | Workflow |
|---|---|
| "Build/design the X page", a new screen or component | `workflows/design.md` |
| "What's wrong with this?", a screenshot or file to critique | `workflows/audit.md` |
| "Review my changes before I merge", a diff or PR | `workflows/review.md` |
| "Make this look better/premium", "this looks AI-generated" | `workflows/restyle.md` |

A workflow calls the modules it needs, in order. That is the reliable path — it
means the intent questions get asked before the layout is chosen, and the states
get specced before implementation rather than never.

## Layer 2 · Modules (the reasoning)

Read a module directly when the request targets exactly one concern, or when a
workflow sends you there.

| Module | Answers |
|---|---|
| `modules/intent-discovery.md` | Who is this for, what job, what's the worst mistake? Produces the locked brief |
| `modules/information-hierarchy.md` | What's primary/secondary/tertiary, scanning pattern, density budget, grouping |
| `modules/state-completeness.md` | Loading, empty, partial, error, success, offline — all six, specced up front |
| `modules/form-ux.md` | Field cutting, grouping, labels, validation timing, smart defaults, disclosure |
| `modules/feedback-and-affordance.md` | Response under 100ms, destructive-action guard ladder, clickable looks clickable, keyboard |
| `modules/design-system.md` | Read the existing config, consolidate into DESIGN.md, then enforce it |
| `modules/visual-character.md` | One explicit decision per axis (type, color, space, finish) so it doesn't look default |

Template for the system file: `assets/DESIGN.template.md`.

## Layer 3 · Pattern references (the numbers)

63 patterns, grouped. Read the file that matches the components on screen — not
all of them.

| Working on | File | Patterns |
|---|---|---|
| Layout, color, type, spacing, shadows, dark mode, icons, charts | `references/visual.md` | 18 |
| Overlays, tables, search, drag & drop, gestures, chips, ⌘K | `references/interaction.md` | 14 |
| Inputs, validation, uploads, toggles, sliders, multi-step flows | `references/forms.md` | 10 |
| Loading, errors, toasts, undo, perceived speed | `references/feedback.md` | 9 |
| Hovers, entrances, easing, scroll effects | `references/motion.md` | 4 |
| Nav structure, tabs, pagination, keyboard focus | `references/navigation.md` | 4 |
| Copy, empty states, ordering, landing pages | `references/content.md` | 4 |

## The five failure modes

Most UI problems are one of these. Naming which one is happening picks the fix.

1. **Built for the schema** — the layout mirrors the database, not a task.
   → `modules/intent-discovery.md`
2. **Flat hierarchy** — everything equally emphasized, so nothing is.
   → `modules/information-hierarchy.md`
3. **Missing states** — designed for the happy path only.
   → `modules/state-completeness.md`
4. **Arbitrary values** — 7px here, 23px there, a third shade of blue.
   → `modules/design-system.md`
5. **Default aesthetic** — technically fine, instantly recognizable as generated.
   → `modules/visual-character.md`

## The numbers worth memorizing

Apply by default; deviate deliberately.

**Time**
- < 100ms — tap/press feedback, or the UI reads as laggy
- < 200ms — feels instant · ~150ms — menu open
- 200–300ms — entrance (ease-out); exit ~40% faster · ~250ms — toggle morph
- 300ms — hover-tooltip delay
- **400ms — the Doherty Threshold.** Something visible must happen before it
- < 300ms response → no loading state at all (a flashed skeleton reads as a glitch)
- \> 3s with a known percentage → progress bar, not a spinner
- 30–60ms — stagger between siblings in a cascade

**Space and shape**
- 4px spacing scale (4, 8, 12, 16, 24, 32, 48, 64) — never eyeballed
- Radius scale 4 · 8 · 12 · 16 · 24, scaled to element size
- Nested radius: `inner = outer − padding`
- 12-column grid; collapse 12 → 6 → 4 → 1 across breakpoints
- Gap *inside* a group visibly smaller than gap *between* groups (~12 vs ~40 in forms)
- Touch targets ≥ 44–48px

**Color and contrast**
- Body ≥ 4.5:1, large text ≥ 3:1, focus rings ≥ 3:1
- One accent per view, reserved for the single primary action
- Never encode meaning in color alone — pair with icon, label or shape
- Dark mode: base #121212 (not #000), off-white text (not #FFF), accents desaturated ~20%

**Structure**
- Six screen states: loading, empty, partial, error, success, offline
- Component states: default, hover, focus, active, disabled, loading (+ error, success)
- Destructive actions get a way back before they get a dialog
- Reversible actions go optimistic; irreversible ones never do

## Default token set

When no design system exists and no character has been decided yet, this is a
neutral starting point — but run `modules/visual-character.md` before it hardens,
or the result will look like every other generated interface.

```css
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;

  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --radius-xl: 16px; --radius-2xl: 24px;

  --text-xs: 12px; --text-sm: 14px; --text-base: 16px;
  --text-lg: 20px; --text-xl: 26px; --text-2xl: 34px; --text-3xl: 42px;
  --weight-body: 400; --weight-medium: 500; --weight-heading: 700;

  --dur-fast: 150ms; --dur-base: 250ms; --dur-slow: 400ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  --shadow-sm: 0 1px 2px rgb(0 0 0 / .06), 0 2px 6px rgb(0 0 0 / .04);
  --shadow-md: 0 1px 3px rgb(0 0 0 / .10), 0 8px 16px rgb(0 0 0 / .06),
               0 20px 32px rgb(0 0 0 / .04);
  --shadow-lg: 0 2px 4px rgb(0 0 0 / .12), 0 12px 24px rgb(0 0 0 / .10),
               0 32px 48px rgb(0 0 0 / .08);
}
```

## Build checklist

Run before calling any interface done.

- [ ] Every decision on screen traces back to the brief, not to the data model
- [ ] Exactly one primary action; destructive actions demoted and guarded
- [ ] Every value comes from a scale or token — no stray 13px, no raw hex inline
- [ ] All six screen states exist and are reachable; empty states are the right one of four
- [ ] Errors say what broke and what to do next, inline, with an icon — never just red
- [ ] Validation on blur, then live once a field has errored
- [ ] Loading pattern matches what's known; sub-300ms shows nothing
- [ ] Reversible actions optimistic; destructive ones offer undo before a dialog
- [ ] Overlay weight matches intent: blocking → modal, contextual → popover, mobile → sheet
- [ ] Keyboard works end to end: tab order matches visual order, arrows inside components, Esc closes, focus visible, trapped in dialogs
- [ ] Contrast checked on every pair, including "muted" secondary text
- [ ] Motion: ease-out in, faster out, nothing linear that starts and stops
- [ ] Hover states don't change layout geometry
- [ ] Mobile designed, not shrunk: thumb reach, sheets, full-screen pickers
- [ ] Lineup test: would this be identifiable among ten generated UIs for the same prompt?

## Working style

- **Ask before building, not after.** Three questions cost 30 seconds; a wrong
  layout costs a rebuild. On interfaces with tappable options, use them.
- **Show the brief and let it be corrected** before writing code.
- **Every finding gets a value.** "Improve the hierarchy" is not actionable;
  "padding 12px → 32px, body to 55% opacity" is.
- **Name the tradeoff** where a choice is taste rather than a rule.
- **Don't invent silently.** An off-system value is declared or flagged.

---

*Pattern layer condensed from the free designmotionhq UX pattern library
(designmotionhq.com/patterns). Workflows and modules written for this skill.*
