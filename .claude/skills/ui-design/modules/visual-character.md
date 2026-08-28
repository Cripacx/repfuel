# Module: Visual Character

**Purpose:** every model has a statistically safest aesthetic. Left alone it
produces the same interface every time — Inter, a violet-to-blue gradient,
`rounded-xl`, a soft shadow, generous padding, three feature cards. It isn't
ugly. It is *recognizable*, and users read it as machine-made without being able
to name why.

The fix is not a house style. It is forcing **one explicit decision per axis**,
made for a stated reason. This module deliberately ships with **no default
aesthetic** — the output should look like the product, not like this skill.

## The four axes

Decide each one. Write the choice and the reason. "Whatever looks good" is not
a decision, it is the default in disguise.

### Axis 1 — Type

| Option | Reads as | Mechanics |
|---|---|---|
| **Neutral grotesk** (Inter, Helvetica-likes) | safe, invisible, default | this is the fallback — choosing it must be deliberate |
| **Geometric sans** (Poppins, Futura-likes) | friendly, consumer, round | pair with generous radius |
| **Humanist / editorial serif** for headings | authority, craft, considered | serif headline + sans body is the highest-contrast cheap win |
| **Mono accents** | technical, precise, developer | mono for numbers, labels, metadata; not body |
| **Condensed / display** for headlines | loud, editorial, confident | needs real size contrast to work |

Then decide the **scale contrast**: tight (1.2 ratio, dense/utility) or dramatic
(1.5+, editorial). And the **weight strategy**: heavy headings against light
body, or uniform mid-weight with size doing the work.

### Axis 2 — Color

| Option | Reads as |
|---|---|
| **Monochrome + one accent** | disciplined, premium, editorial |
| **Duotone** (two related hues) | branded, energetic |
| **Warm neutral base** (stone/sand rather than blue-grey) | human, calm, non-corporate |
| **Cool neutral base** | technical, product, precise |
| **Dark-first** | focus, developer tools, media |
| **High-chroma accent on near-black** | bold, modern, opinionated |

Decide also: **saturation level** (muted vs vivid — muted almost always reads
more expensive) and **where the accent is allowed to appear** (one action per
view is the discipline that makes it work).

Avoid by default: the violet→blue gradient, pure `#000`/`#FFF` pairs,
equal-weight rainbow status colors.

### Axis 3 — Space

| Option | Reads as |
|---|---|
| **Dense** (4px rhythm, 8–12px paddings) | tool, dashboard, professional, high-frequency use |
| **Balanced** (16–24px) | product default |
| **Editorial** (32–64px, large section gaps) | premium, marketing, low-frequency |

Decide also: **container width** (narrow 640–768px reads editorial; wide
1280px+ reads application) and **whether the grid gets broken** — a full-bleed
element or margin intrusion, deliberately, once established.

### Axis 4 — Finish

The surface treatment. This is where "AI default" lives most visibly.

| Option | Mechanics |
|---|---|
| **Flat** | no shadows; hierarchy from color and spacing alone. Hardest to do well, cleanest when it works |
| **Soft depth** | layered shadows (2/12/32px), hairline borders ~12% opacity |
| **Hard-edged** | 1–2px solid borders, 0 or 4px radius, no shadow. Reads brutalist/technical |
| **Glass** | backdrop-blur + translucency. Needs a busy background to justify it |
| **Tactile** | pronounced elevation, spring motion, visible press states |

Decide also: **radius register** (0–4 corporate/sharp · 8–12 product default ·
16–24 friendly/soft) and **motion register** (crisp ease-out only · spring and
overshoot · minimal, near-static).

## The lineup test

After deciding, apply the check that matters:

> Generate ten AI interfaces for this same prompt and line them up. **Would this
> one be identifiable?**

If not, at least one axis is still on its default. The usual culprits, in order:
finish (default soft shadow + `rounded-xl`), then type (default neutral sans at
default weights), then color (default blue/violet accent).

One axis pushed hard is usually enough. Pushing all four at once produces a
different problem — a screen that is distinctive and unusable. Pick the axis
that carries the brand and let the other three be quietly consistent.

## Constraints that survive any choice

Character is not license. These hold regardless of the axes:

- Contrast ratios: 4.5:1 body, 3:1 large text and focus rings
- Focus rings visible on every background the character produces
- Never encode meaning by color alone
- Touch targets ≥ 44px, even in a dense register
- Motion respects `prefers-reduced-motion`

## Output

```
VISUAL CHARACTER — [product]
Type:    [choice] · scale [tight/dramatic] · weights [strategy]  → because [reason]
Color:   [choice] · saturation [muted/vivid] · accent used for [what] → because [reason]
Space:   [density] · container [width] · grid break [where] → because [reason]
Finish:  [choice] · radius [register] · motion [register] → because [reason]

Lineup test: [identifiable? which axis carries it?]
Rejected defaults: [what was consciously avoided]
```

Feed these decisions into `modules/design-system.md`, which turns them into
tokens in DESIGN.md. A character decision that never becomes a token evaporates
by the third screen.
