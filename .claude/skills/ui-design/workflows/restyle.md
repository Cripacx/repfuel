# Workflow: Restyle an existing UI

**Trigger:** "make this look better/premium", "this looks AI-generated",
"/restyle [path]", "restyle this component to match our system".

**Visual only.** Logic, component structure, data flow and copy *meaning* stay
exactly where they were. If a structural problem shows up, name it as a finding
and leave it alone — that is the audit workflow's job, not this one.

## Step 1: Diagnose axis by axis

Read the file (or the screenshot) and report what it currently does on each
axis, and — the important column — **whether that was a decision or a default**.

A default is a value that appears because it is the safest common choice, not
because anything on this screen required it. `Inter / rounded-xl / shadow-md /
blue-600 / p-6` together is the signature.

```
DIAGNOSIS — [target]
        Currently                          Decision or default?
Type    Inter 400/600, 16→24, ratio 1.25   default
Color   blue-600 accent, slate neutrals    default
Space   p-6 everywhere, gap-4              default (uniform padding = no hierarchy)
Finish  rounded-xl, single shadow-md       default
```

Then state the verdict in one line: *"Four axes on default — this is the
canonical generated-UI look."* or *"Type and color are decided; space and finish
are default."*

## Step 2: Establish the target

- **DESIGN.md exists** → that is the target. Read it, map current values to its
  tokens, and list the mismatches.
- **No DESIGN.md** → run `modules/visual-character.md` to make the four axis
  decisions, then `modules/design-system.md` to write DESIGN.md. Do this once;
  every later restyle then has a target and the screens converge instead of each
  getting its own treatment.

## Step 3: Apply, highest-impact first

Order matters — the first three usually carry most of the perceived change:

1. **Space** — padding, section gaps, container width. Uniform padding
   everywhere is the loudest default. Give the focal element more room than its
   neighbors; tighten within groups, open between them.
2. **Type** — real scale contrast and weight contrast. Push the title, drop body
   to a lower opacity or weight so the eye has an order. A single serif or
   condensed heading font is the cheapest identity change available.
3. **Finish** — replace the single flat shadow with the layered stack (tight +
   mid + ambient), fix radius nesting (`inner = outer − padding`), add the
   hairline border where the character calls for it.
4. **Color** — swap to the decided palette; enforce one accent for the single
   primary action; check the contrast ratios after, not before.
5. **Motion** — ease-out entrances, exits ~40% faster, hover lifts that don't
   change layout geometry, no linear easing on anything that starts and stops.

Pull the concrete numbers from `references/visual.md` and `references/motion.md`.

## Guardrails

- Do not rename props, change component APIs, reorder DOM, or alter conditionals.
- Do not change what copy *says*. Tightening `text-sm` to a token is styling;
  rewriting a button label is not this workflow.
- Do not remove states. If the original had a loading skeleton, the restyle has
  a loading skeleton.
- Keep DOM order intact — reordering with CSS breaks tab order.
- Re-check contrast after the color pass. A restyle that improves the look and
  drops body text to 3:1 is a regression.

## Step 4: Before / after

Hand back something readable in seconds, not a diff dump.

```
RESTYLE — [target]

           Before              After               Why
Space      p-6 uniform         p-10 card,          Focal element earns room;
                               gap-3 in-group,     grouping now reads without
                               gap-10 between      dividers
Type       16/24, both 400     16 body @70%,       Title wins the hierarchy
                               34 title @600
Finish     shadow-md,          3-layer shadow,     Depth reads physical; corners
           rounded-xl          radius 16 outer /   are concentric
                               8 inner
Color      blue-600 on 4       one accent on the   Single focal action; secondary
           elements            primary CTA only    actions recede
Motion     none                200ms ease-out      Card reads as interactive
                               hover, 8px lift

Unchanged: component API, DOM order, all states, copy meaning.
Contrast after: body 7.1:1 · muted 4.8:1 · focus ring 3.4:1 — all pass.
Lineup test: [identifiable? which axis carries it?]
```

Then the restyled code.

## When the answer is "don't"

If the UI is already on-system and the axes are decided, say so. A restyle that
changes values just to show work is drift with better intentions.
