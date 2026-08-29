# Module: Information Hierarchy

**Purpose:** decide what the screen is *for* before deciding what it *contains*.
Generated UI weights everything equally because the schema weights everything
equally. Rank instead.

## 1. Rank every action

Sort every action on the screen into exactly three tiers. Write the list out —
the act of forcing a ranking is the work.

| Tier | Definition | Treatment |
|---|---|---|
| **Primary** | The job from the brief. **Exactly one per view.** | Filled button, accent color, largest, positioned where the eye lands first |
| **Secondary** | Supports the job, used regularly | Outline or ghost button, neutral color, same size or smaller |
| **Tertiary** | Rare, administrative, or dangerous | Icon button, overflow menu (⋯), or a link in a detail view |

Rules that follow from the ranking:

- **Two primaries means no primary.** If two actions both feel essential, the
  brief is unresolved — go back and ask which one the user came for.
- **Destructive actions are never tier-1 and never adjacent to a routine action.**
  Delete beside Edit at the same weight is the single most common generated-UI
  failure. Move it to overflow, and see `feedback-and-affordance.md` for the
  confirmation ladder.
- **Frequency beats importance for placement.** The thing done 50 times a day
  gets the best position, even if a rarer action feels more "important".
- Anything nobody in the brief needs gets **cut**, not shrunk.

## 2. Choose the scanning pattern

The eye follows a predictable path. Put the ranked items on it.

- **Z-pattern** — sparse, marketing, or single-decision screens. Logo top-left,
  primary action top-right or bottom-right.
- **F-pattern** — text-heavy and list screens. The first two words of each row
  carry the weight; front-load identity, don't start every row with a checkbox
  and an avatar and then the name.
- **Layer cake** — scannable content with headings: users read headings, skip
  bodies. Headings must be self-sufficient.
- **Spotlight** — one dominant element, everything else quiet. Correct for
  single-decision screens (pricing, confirmation, onboarding step).

Cross-check with `references/visual.md` → Visual Hierarchy: size ≈ 2× for the
focal element, one accent color, weight and whitespace doing the rest.

## 3. Set density with a budget

Density is a decision, not a leftover. Give it a number.

**Column budget for tables and lists:** start at **five**. Each column must
answer a question the user actually asks at this stage:

1. **Identity** — which record is this? (usually two lines: name + secondary id)
2. **Status** — is it OK? (pill with icon + label, never color alone)
3. **The time field that matters** — last seen, updated, due
4. **The one attribute they filter or compare on** — plan, owner, amount
5. **Actions** — right-aligned, primary inline, rest in overflow

Everything else goes to the detail view. A twelfth column is not thoroughness,
it is a schema dump. If a stakeholder insists on more, make it a **column
picker** with this set as the default, not the default itself.

**Row density**: expose it as one token-driven control (36 / 48 / 60px) rather
than guessing — see `references/interaction.md` → Data Table.

**Form density**: 3 fields read effortlessly, 12 in a row trigger scroll
fatigue. Past ~7, group into sections or steps — `modules/form-ux.md`.

## 4. Group by meaning

Grouping is done with **spacing before borders**: gaps inside a group must be
visibly tighter than gaps between groups (~12px vs ~40px in forms). Reach for a
card or divider only when items are far apart and proximity can't reach them.
Detail in `references/visual.md` → Proximity Rule, Gestalt Laws.

## 5. Order for recall

First and last positions are remembered; the middle is not. Put the strongest
item first and the strongest closing item last — nav logo leads, primary CTA
closes; landing page opens with the value proposition and ends with proof. See
`references/content.md` → Serial Position.

## Output

```
HIERARCHY — [screen]
Primary action:    [one]
Secondary:         [list]
Tertiary/overflow: [list, incl. destructive]
Cut:               [what was removed and why]
Scanning pattern:  [Z / F / layer cake / spotlight]
Density:           [n columns, listed] · [row height] · [what moved to detail view]
Grouping:          [groups and the spacing that separates them]
```
