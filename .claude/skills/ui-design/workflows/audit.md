# Workflow: UX Audit

**Trigger:** "audit this", "review this UI", "/ux-audit", a screenshot or a
component file with "what's wrong with this?"

Produces a **severity-ranked list of specific fixes**, not adjectives. The test
for every finding: could a developer act on it without asking a follow-up
question? "Improve the visual hierarchy" fails. "Card padding is 12px — go to
32px and drop body text to 55% opacity so the title wins" passes.

## Input

Works from a screenshot, a URL, a component file, or a described screen. With a
file, read the code — computed values beat guessing. With a screenshot, name
what you can measure and say when you're estimating.

If a `DESIGN.md` exists, audit against it too: off-system values are findings.

## Passes, in order

Run all seven. Order matters — it is roughly descending perceived impact.

**1 · Intent fit.** Can you tell from the screen who it's for and what the one
job is? If the layout mirrors the data model rather than a task, that is finding
number one and it outranks everything below it.

**2 · Hierarchy.** What does the eye hit first, and is that the intended target?
Count the primary actions (should be exactly one). Check destructive actions'
placement and weight. Check column/field count against the density budget.

**3 · States.** Which of the six are missing — loading, empty, partial, error,
success, offline? Which of the four empty kinds are collapsed into one? Are
disabled states explained? Do focus states exist?

**4 · Feedback and timing.** Does every action acknowledge itself under 100ms?
Is anything blocking that could be optimistic? Anything optimistic that
shouldn't be? Is the loading pattern matched to what's known? Do destructive
actions have the right guard tier?

**5 · Accessibility.** Contrast on every text/background pair including muted
secondary text (4.5:1 body, 3:1 large). Color-only signals. Focus visibility and
order. Touch targets. Labels on inputs and icon buttons. Keyboard reachability.

**6 · Consistency.** Off-scale values (13px, 17px, stray hex), duplicate
component variants, mixed icon styles or stroke weights, inconsistent radius
nesting, mixed easing.

**7 · Craft.** Shadow layering, radius math (`inner = outer − padding`), motion
curves and durations, microcopy (buttons naming rewards not mechanics; errors
naming next steps), empty-state copy.

## Severity model

| Level | Definition |
|---|---|
| **Blocker** | Users can't complete the job, lose data, or are excluded. Missing error recovery, unguarded destructive action, keyboard-unreachable control, contrast under 3:1 on essential text |
| **Major** | Job completable but materially harder or riskier. Wrong primary action, missing empty/loading state, validation only on submit, destructive action beside a routine one |
| **Minor** | Noticeable friction or inconsistency. Off-scale spacing, missing hover state, tooltip with no delay, unclear microcopy |
| **Polish** | Perceived-quality gap only. Flat single shadow, linear easing, radius nesting off, unstaggered list entrance |

Rank within each level by effort — cheapest first, so the list is shippable
top-down.

## Output format

```
UX AUDIT — [target]
Read: [what was inspected] · Assumed intent: [inferred user + job, flagged if guessed]

BLOCKERS (n)
1. [Location] — [what's wrong]
   Why: [what it costs the user]
   Fix: [specific change, with values]

MAJOR (n)
...

MINOR (n)
...

POLISH (n)
...

If you only do three things: [the three highest impact-to-effort items]
```

Always end with the "only do three things" line. Long audits get skimmed; the
short list gets shipped.

## Calibration

- **10–25 findings** for a full screen. Fewer means the passes were skipped;
  many more means minor and polish items are being padded.
- Don't invent findings to fill a level. "No blockers found" is a valid and
  useful result.
- Note what is genuinely good, briefly, at the end — it tells the reader the
  audit was actually looked at, and it protects the parts that shouldn't change.
- Where a finding is a matter of taste rather than a rule, say so and give the
  tradeoff instead of an instruction.
