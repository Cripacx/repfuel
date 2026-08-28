# Workflow: UX Review of a diff

**Trigger:** "review my changes", "/ux-review", "check this before I merge", or
a pull request / diff shared for feedback.

Same reasoning as the audit, scoped to **what changed**. The value is catching
the things that only show up under review — a new state that was never designed,
a value invented instead of taken from tokens, a component variant that already
existed under another name.

## Scope

```bash
git diff --stat
git diff              # or: git diff main...HEAD for a branch
```

Review the UI-bearing changes: components, styles, templates, token files,
copy strings. Skip pure logic, tests and config unless they change behavior the
user can perceive (timings, error handling, request patterns).

If the diff is large, cover the highest-traffic surfaces first and say what was
not reviewed.

## What to check

**1 · New components — do they owe states?**
Every new interactive component: default, hover, focus, active, disabled,
loading, and where it takes input, error and success. Every new data surface:
loading, empty (which of the four kinds?), partial, error, offline. This is the
most common gap in a diff, because the happy path is the one being built.

**2 · New values — are they on-system?**
Scan the diff for raw hex, arbitrary spacing (`p-[13px]`), one-off radius,
inline shadows, hardcoded durations. Each is either the nearest token or a
declared extension in DESIGN.md. Nothing silently invented.

```bash
git diff -U0 | grep '^+' | grep -oE '#[0-9a-fA-F]{3,8}|\[[0-9]+px\]|duration-\[[^]]+\]'
```

**3 · Duplication — does this already exist?**
A new `Badge` when `Chip` exists, a second modal implementation, a third button
variant. Search the codebase for the concept, not the filename, before accepting
a new component.

**4 · Hierarchy changes**
Did an action get promoted or demoted? Is there still exactly one primary per
view? Did a destructive action move next to a routine one?

**5 · Feedback and timing**
New async calls: is there a pending state? Is it optimistic where it should be,
and — more importantly — *not* optimistic where it must not be (payments,
irreversible writes)? Do new destructive paths have the right guard tier?

**6 · Accessibility regressions**
New color pairs meeting 4.5:1 / 3:1. New interactive elements reachable by
keyboard with a visible focus ring. New icon-only buttons carrying labels. Any
`outline: none` without a replacement. Any new color-only signal.

**7 · Copy**
New button labels naming outcomes, new error messages naming the next step, new
empty states carrying a CTA.

## Output format

Keep it short — review comments compete with the reviewer's attention.

```
UX REVIEW — [branch/diff]
Scope: [files reviewed] · [anything skipped]

MUST FIX BEFORE MERGE
- [file:line] [issue] → [fix]

SHOULD FIX
- [file:line] [issue] → [fix]

CONSIDER
- [suggestion, with the tradeoff]

Looks good: [what's genuinely well done]
```

Anchor every finding to a file and line where possible. A review comment without
a location gets ignored.

## Tone

This is a colleague's review, not a gate. Say what's wrong, why it costs
something, and what to do — then let the author decide. Flag the things that
genuinely block (data loss, exclusion, broken states) as must-fix, and be honest
that the rest is preference where it is.
