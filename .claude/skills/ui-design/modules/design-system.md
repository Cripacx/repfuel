# Module: Design System

**Purpose:** stop drift. Screen 1 picks a blue and 24px of padding, screen 2
picks a slightly different blue, screen 3 invents a third button style. Nothing
is individually wrong and the product looks assembled by four people.

The fix is a written system at the project root — `DESIGN.md` — that is read
before building and checked after. **Consolidate what exists before proposing
anything new.**

## Step 1: Read what's already there

Never propose tokens before inspecting the project. Whatever the codebase
already encodes *is* the system; DESIGN.md consolidates it rather than competing
with it.

Look, in this order:

1. `tailwind.config.{js,ts}` / `@theme` blocks in CSS — the declared theme:
   colors, spacing, radius, fonts, shadows
2. Global CSS: `:root` custom properties, `globals.css`, `theme.css`,
   `variables.scss`
3. Component library config — shadcn `components.json`, MUI theme, Chakra theme,
   `styled-components` theme files
4. **The most reused component** (usually Button, then Card). What it actually
   does is the de-facto system, even when it contradicts the config
5. Existing design docs, Storybook, Figma exports if present

Then measure reality, not intent:

```bash
# Which raw values actually appear in the code?
grep -rhoE '#[0-9a-fA-F]{3,8}' src/ | sort | uniq -c | sort -rn | head -30
grep -rhoE '\b(p|m|gap|space)-\[?[0-9]+(px|rem)?\]?' src/ | sort | uniq -c | sort -rn | head -30
grep -rhoE 'rounded-\[?[a-z0-9]+\]?' src/ | sort | uniq -c | sort -rn | head -20
```

The frequency counts tell you what the system already is. A value used 40 times
is a token; a value used once is drift.

## Step 2: Ask only about genuine gaps

**Five questions maximum**, and only where the codebase gives no answer. Typical
real gaps: brand personality (corporate ↔ friendly, drives radius and type),
dark mode required or not, density target, target platform, accessibility bar
(AA vs AAA). If the code answers it, don't ask it.

## Step 3: Write DESIGN.md

Use `assets/DESIGN.template.md` as the structure. Two non-negotiables:

- **Every value carries the reason it exists.** A token list without reasons
  gets ignored because nobody can tell an intentional value from a copied one.
  `--space-6: 24px  /* default card padding; section gaps use --space-10 */`
- **Semantic names, not literal ones.** `--color-primary`, not `--color-blue-500`.
  Literal names become lies the day blue turns teal.

Three layers, each referencing the one above: **primitives** (raw values) →
**semantic** (roles) → **component** (usage). One primitive edit then cascades
instead of 47 hunted-down values.

Cover, in this order: Foundations (color, type, spacing, radius, elevation,
motion) → Components (variants, sizes, states) → Voice (how copy sounds) →
Extensions log.

## Step 4: Enforce

After DESIGN.md exists, the rule is simple:

> An off-system value is either a **declared extension** or it is **flagged**.
> It is never invented silently.

When building and no token fits:

1. Check again — usually one does, one step up or down the scale.
2. If the gap is real, **add it to DESIGN.md with its reason** and say so in the
   response: *"Added `--space-14: 56px` — needed for the hero's optical
   centering; documented in DESIGN.md."*
3. If it's a one-off that shouldn't become a token, say that too and explain why
   it's an exception.

**Drift audit** — run this on request or before a release:

```
DRIFT REPORT
Off-system colors:   [value → count → files → nearest token]
Off-system spacing:  [value → count → nearest token]
Off-system radius:   [...]
Component variants outside the documented set: [...]
Verdict per item:    [snap to token | promote to token | keep as documented exception]
```

Fix by snapping to the nearest token in the same direction — a stray 13px goes
to 12, 17px to 16 — and only promote to a new token when a value earns it by
recurring for a real reason.

## Step 5: Keep it alive

- DESIGN.md changes are part of the change that needed them, not a later cleanup.
- New components declare which tokens they use and which states they implement.
- When the brand changes, edit primitives only. If a rebrand requires touching
  components, the layering was wrong.

## Interaction with visual-character

`design-system` decides **consistency** — that every screen uses the same
values. `visual-character` decides **what those values are** so they don't come
out as the model's default aesthetic. Run `visual-character` first on a new
project, then write DESIGN.md around its decisions. On an existing project, run
`design-system` first to read reality, then `visual-character` on the gaps.
