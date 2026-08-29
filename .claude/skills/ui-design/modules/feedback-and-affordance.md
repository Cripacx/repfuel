# Module: Feedback & Affordance

**Purpose:** two questions the interface must answer without being asked —
*can I click this?* and *did that work?* Generated UI usually answers neither,
because both live in states and timings rather than in markup.

## 1. Every action acknowledges itself

| Delay | Requirement |
|---|---|
| **< 100ms** | Visual response to a tap/press/click. Below this it feels alive; above it feels laggy even when the work is instant |
| **< 400ms** | *Something* must have visibly changed — the Doherty Threshold. Past it, attention leaves |
| **> 400ms** | A designed loading state, chosen by what you know (see `references/feedback.md`) |

Practically, that means every interactive element has a **pressed/active state**
that fires on pointer-down, not on server response. The press feedback and the
result are two different things.

Choose the response strategy per action:

- **Reversible and low-stakes** (like, toggle, reorder, bookmark) → **optimistic**:
  update instantly, sync in the background, roll back cleanly on failure.
- **Irreversible or money** (payment, transfer, booking) → **never optimistic**.
  Pending state, then a real confirmation only after the server clears it.
- **Slow but known** → progress with real meta (percent, time remaining).
- **Slow and unknown** → spinner with context, never a bare full-page spinner.

## 2. Destructive actions: the confirmation ladder

Match the guard to the actual cost of the mistake. Over-guarding trains people
to click through dialogs without reading, which removes the guard entirely.

| Reversibility | Guard |
|---|---|
| Fully reversible (archive, hide, remove from list) | **No dialog.** Do it, show an undo toast with a visible countdown (~5s) |
| Recoverable within a window (delete a record) | **Soft delete**: do it immediately, undo toast, keep it in trash ~30 days |
| Irreversible but low blast radius | Confirmation dialog naming the specific object: "Delete invoice #4021?" — never "Are you sure?" |
| Irreversible and high blast radius (delete account, drop a workspace) | **Type-to-confirm**: the user types the name. Plus a plain-language list of what will be lost |

Rules regardless of tier:
- **Undo beats confirmation** wherever it's possible. A dialog punishes everyone
  for one person's mistake; undo punishes nobody.
- The confirming button carries the **verb, not "OK"**: "Delete 3 accounts".
- Destructive styling on the *confirm* button, never on the cancel; cancel is the
  safer default and gets focus.
- Destructive actions live in tier 3 — overflow menus, never beside routine
  actions at equal weight.

Detail: `references/feedback.md` → Undo UX, Error States.

## 3. Clickable looks clickable

Affordance failures are silent — nobody reports the button they never saw.

- **Interactive elements need at least two of**: fill or border, elevation,
  cursor change, hover state, iconography. Text-only actions need color plus a
  hover treatment at minimum.
- **Hover state on everything interactive.** No hover state reads as decoration.
- **Hit targets ≥ 44–48px** on touch, and the target extends past the visible
  glyph — a 4px slider rail or a 16px icon needs a padded hit area.
- **The whole row is the target** in lists and tables, not a 16px checkbox.
- **Don't make non-interactive things look interactive**: cards that lift on
  hover but do nothing, underlined text that isn't a link, disabled buttons that
  look enabled.
- Cursor is a real signal: `pointer` for actions, `not-allowed` for disabled,
  `grab`/`grabbing` for drag, `text` for editable.
- Hover motion must not change layout geometry — animate the content, hold the
  footprint (`references/motion.md` → Card Hover Anatomy).

## 4. Keyboard is an affordance too

- Tab order follows visual order (which means DOM order must follow visual order).
- Visible focus ring everywhere, distinct in color from the active/selected state.
- Component-level keys: arrows within menus, tabs, sliders and grids; Enter to
  commit; **Escape closes anything that opened**.
- Modals trap focus and return it to the trigger on close.
- One shortcut worth having by default: `/` or ⌘K to search.

## 5. Notification surface, matched to severity

Pick the quietest surface that does the job. Over-escalation gets everything
ignored.

- **Inline** — field errors, in-context status
- **Toast** — transient, low priority; ~4s info, ~7s warning, pause on hover, cap at 3
- **Banner** — persistent condition (degraded service, expiring plan)
- **Modal** — only when the user genuinely cannot continue
- **Badge** — passive counts

Never stack modals. Never put a toast in the screen center. Never rely on color
alone for type — icon plus label every time.

## Output

```
FEEDBACK SPEC — [screen]
Per action: [action] → [press feedback] → [strategy: optimistic/pending/progress] → [result surface]
Destructive: [action] → [ladder tier] → [exact guard + copy]
Affordance:  [how each interactive element reads as interactive] · hit targets
Keyboard:    [tab order note] · [component keys] · [shortcuts]
Notifications: [event → surface → persistence]
```
