# Module: State Completeness

**Purpose:** generated UI designs the happy path and ships the rest as bugs.
Every screen and every component owes six states. Spec them **before**
implementing — retrofitting an empty state after the fact never happens.

## The six screen states

| State | Trigger | What it must do |
|---|---|---|
| **Loading** | request in flight | Match the pattern to what's known: shape → skeleton mirroring the real layout; percentage → progress bar; short unknown → spinner; **under ~300ms → nothing at all** |
| **Empty** | request succeeded, zero items | Never a blank area. Icon or illustration + human sentence + **one primary CTA** that is the next real step |
| **Partial** | some data, some missing or degraded | Render what arrived, mark what didn't inline (skeleton row, "—", "unavailable" chip). Never block the whole screen on one failed sub-request |
| **Error** | request failed | Say what broke, why, and what to do next. **Always an exit**: Retry, support link, or expandable technical detail. Never a dead-end "OK" |
| **Success** | action completed | Confirm where attention already is: inline for field-level, toast for transient, state change for the object itself. Pair with undo when reversible |
| **Offline** | no connection | Distinguish from a server error. Say connection, show what's cached, queue the action if you can, retry automatically on reconnect |

**Four kinds of empty, not one.** Shipping one generic screen for all four is
the usual shortcut:

1. **First run** — nothing created yet → teach. Ghost preview of what a real item
   looks like + "Create your first X".
2. **No results** — search found nothing → recover. Suggestions, popular
   searches, alternate spellings, a way to clear the query.
3. **Filtered out** — data exists but filters hide it → show the active filters
   and a one-tap **clear all** with the live count.
4. **Error-empty** — the fetch failed → this is the error state, not an empty
   state. Do not disguise a failure as "no data".

## Component-level states

Every interactive element also owes: **default · hover · focus · active ·
disabled · loading**, plus **error** and **success** where it accepts input.

- **Focus** is not optional and not the same as hover. Ring ≥ 3:1 contrast, 2px
  thick with 2px offset, `:focus-visible` so mouse clicks stay clean.
- **Disabled** must explain itself. A greyed button with no reason is a dead end
  — add a tooltip or helper line saying what would enable it. Never fake
  disabled with `opacity: 0.5`; that reads as loading.
- **Loading on a control** blocks input to prevent double submits and shows
  progress in place (spinner inside the button/knob), not a page overlay.

## Where states get forgotten

Check these specifically — they are the recurring gaps:

- Tables with no empty state → blank rows, or a header with nothing under it
- Search with no zero-results recovery → dead end
- Lists that never show a partial/failed item
- Avatars and images with no fallback (initials, placeholder) and no broken-src handling
- Long lists with no "loading more" state at the bottom
- Any form submit button with no pending state → double submissions
- Optimistic updates with no rollback path → the UI lies after a failure
- First paint with no skeleton → the screen looks broken for 400ms

## Output: the state spec

Emit this table per screen before writing code. It is also the test plan.

```
STATES — [screen]
Loading   → [skeleton 5 rows matching final layout | progress bar | none <300ms]
Empty     → [which of the four kinds] · [copy] · [CTA]
Partial   → [what renders, what's marked, how]
Error     → [message] · [recovery action] · [surface: inline/toast/modal]
Success   → [surface] · [undo? window]
Offline   → [message] · [cached content] · [queue/retry behavior]
```

Then implement all six. A state in the spec but not in the code is the bug this
module exists to prevent — so verify each one is reachable in the built
component before calling it done.

Timing thresholds and the loading-pattern decision table live in
`references/feedback.md`.
