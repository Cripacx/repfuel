# Workflow: Design a screen

**Trigger:** "design/build the X page", "/ux-design X", or any request to create
a new interface.

Produces a **brief, a wireframe and a spec before implementation**. The point is
that the expensive decisions get made in text, where a correction costs one
sentence, instead of in code, where it costs a rebuild.

## Sequence

**1 · Intent** → `modules/intent-discovery.md`
Ask 3–5 questions. Emit the locked brief. If the user supplied intent already,
skip to the brief. If they said "skip the questions", build with stated
assumptions flagged at the top.

*Stop here and let the user correct the brief before continuing.* This is the
one checkpoint worth waiting for — everything downstream inherits it.

**2 · Character and system** → `modules/visual-character.md`, `modules/design-system.md`
- Existing project: read the tokens that exist. Follow them. Only surface a gap
  if one genuinely blocks the screen.
- New project or no system: make the four axis decisions, then write DESIGN.md.
- Skip entirely if a DESIGN.md already exists — read it and comply.

**3 · Hierarchy** → `modules/information-hierarchy.md`
Rank actions into primary/secondary/tertiary, pick the scanning pattern, set the
density budget, define grouping. Name what got cut.

**4 · Wireframe**
Low-fidelity, in text or ASCII, before any styling. It should be readable in ten
seconds and show *placement and weight*, not visuals:

```
┌─────────────────────────────────────────────────┐
│ Users                          [+ Invite user]  │  ← primary action, top-right
├─────────────────────────────────────────────────┤
│ [🔍 Search by name, email, or ID............]   │  ← primary job, full width
│ [All ▾] [Plan ▾] [Status ▾]        142 results  │  ← filters + live count
├─────────────────────────────────────────────────┤
│ ▢ NAME / EMAIL      STATUS   LAST SEEN  PLAN  ⋯ │  ← 5 columns
│ ▢ Anna Weber        ●Active  2h ago     Pro   ⋯ │  ← whole row clickable
│ ▢ ...                                            │
├─────────────────────────────────────────────────┤
│ ← 1 2 3 … 12 →                                  │
└─────────────────────────────────────────────────┘
Overflow (⋯): View details · Reset password · Suspend · —— · Delete (typed confirm)
```

**5 · States** → `modules/state-completeness.md`
Spec all six before implementing. This is what stops "we'll add the empty state
later", which never happens.

**6 · Forms** → `modules/form-ux.md` (only if the screen collects input)

**7 · Feedback** → `modules/feedback-and-affordance.md`
Response strategy per action, the destructive guard ladder, affordances,
keyboard paths.

**8 · Implement**
Now write code. Pull concrete values from `references/` as needed — the pattern
files hold the numbers (timings, contrast, radius nesting, shadow stacks).
Every value comes from a token; anything off-system gets declared per
`modules/design-system.md`.

**9 · Self-check**
Run the build checklist in `SKILL.md`. Then re-read the brief: does each
decision on screen trace back to an answer in it? Anything that traces only to
the data model is the thing to fix.

## Output structure

```
BRIEF          [from step 1]
DECISIONS      [character + hierarchy, one line each with its reason]
WIREFRAME      [step 4]
STATES         [six-state table]
SPEC           [components, tokens used, interactions, keyboard]
→ then the implementation
```

## Scaling the workflow

- **Single component** (a button, a card): skip steps 2 and 4. Brief becomes one
  line, states and feedback still apply.
- **Full screen**: everything above.
- **Multi-screen flow**: run intent once for the flow, then hierarchy and states
  per screen, and add a flow-level pass — where is the deliberate peak, and what
  does the last screen feel like? (`references/interaction.md` → Peak-End Rule).
