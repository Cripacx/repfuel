# Module: Intent Discovery

**Purpose:** stop the interface from being shaped by the data model. A schema
has tables, columns and CRUD verbs. A user has a job, a context, and one mistake
they are afraid of making. Those produce different screens.

Run this **before writing any UI code**. It takes about 30 seconds and saves the
two or three rebuild cycles that normally follow generated UI.

## The questions

Ask **three to five**, never more. Prefer multiple choice over open text — it is
faster to answer and produces sharper answers. On a chat interface with tappable
options, use them.

**Always ask these three:**

1. **Who uses this day-to-day?**
   Not "users". A support agent doing 200 of these a day needs density and
   keyboard shortcuts. A customer doing it once a year needs guidance and
   forgiveness. This single answer changes almost every downstream decision.

2. **What is the one job they came here to do?**
   One. If the answer names three things, ask which one happens most. Everything
   else on the screen is secondary by definition.

3. **What is the worst mistake they could make here?**
   This is the highest-value question and the one generated UI never asks. The
   answer tells you what to demote, what to guard, and what needs an undo path.
   "Deleting the wrong account" and "sending to the wrong recipient" produce
   completely different layouts from the same database table.

**Ask when relevant:**

4. **Context of use** — desktop at a desk, phone one-handed, tablet in the field,
   under time pressure, with interruptions? Drives density, touch targets,
   whether bottom sheets beat modals.
5. **Frequency** — daily power use or once a quarter? Drives whether to optimize
   for speed (shortcuts, defaults, bulk actions) or for clarity (labels,
   explanations, confirmation).
6. **What happens immediately after?** The next step often belongs on this
   screen, and the flow's ending carries disproportionate weight in memory.
7. **What is already known about them?** Anything the system knows should be
   pre-filled, not asked.

## Skipping the questions

Two legitimate ways to skip:

- **Intent supplied up front.** If the request already states who it's for and
  what the job is, don't re-ask. Restate it as the brief and move on.
- **Explicitly waived** ("skip the questions", "just build it"). Then build with
  **stated assumptions**, written out at the top of the output and flagged for
  review, e.g. *"Assumed: internal support staff, daily use, desktop; the
  dangerous action is account deletion."* Never assume silently — a wrong
  assumption the user can see costs one sentence to fix; a hidden one costs a
  rebuild.

## Output: the locked brief

Emit this before building. It is short on purpose — it must be readable in five
seconds and correctable in one sentence.

```
BRIEF — [screen name]
Primary user:   [who, and how often]
Primary job:    [the one thing]
Danger:         [worst mistake] → [how the UI guards it]
Context:        [device, pressure, environment]
Success:        [what "this worked" looks like from their side]

Consequences for this screen:
- [decision 1, traced to an answer above]
- [decision 2]
- [decision 3]
```

Each consequence must be traceable to an answer. If a decision can't be traced,
it came from the schema or from habit — question it.

**Worked example**

> Brief: support staff, ~50 lookups/day, desktop, dual monitors. Job: find one
> account and check its status. Danger: deleting the wrong account.
>
> Consequences:
> - Search is the primary action on the page, not a filter buried in a dropdown
> - 5 columns (identity, status, last seen, plan, actions), not every field
> - Delete moves into a row overflow menu with typed confirmation; Edit stays inline
> - Keyboard: `/` focuses search, arrows move rows, Enter opens

Note what happened: the same table produced a different screen because the
danger answer demoted one action and the frequency answer promoted another.

## Then

Hand the brief to `modules/information-hierarchy.md` to rank what's on screen,
then `modules/state-completeness.md` before implementing.
