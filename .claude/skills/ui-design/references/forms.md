# Forms — inputs, validation, controls

10 patterns: [Form Field States](#form-field-states) · [Form Validation Timing](#form-validation-timing) ·
[Stepper Wizard](#stepper-wizard) · [Input Masking](#input-masking) · [OTP Input](#otp-input) ·
[Password Field UX](#password-field-ux) · [File Upload UX](#file-upload-ux) ·
[Date Pickers](#date-pickers) · [Range Sliders](#range-sliders) · [Toggle Anatomy](#toggle-anatomy)

---

## Form Field States

A text field has **six states** — default, focus, error, success, disabled, loading. Each needs an explicit design; a forgotten one becomes a production bug.

- **Default**: label *above* the field, helper text below. A placeholder-as-label vanishes the moment someone types.
- **Focus**: a focus ring of at least **3:1 contrast**. A soft blue glow looks pretty and fails accessibility.
- **Error**: **color + icon + message together.** Border-only red is invisible to roughly 12% of users. Name what is wrong and how to fix it.
- **Success**: confirm *inside the field*, where attention already is. A toast steals focus and disappears before it is read.
- **Disabled**: grayscale fill with a not-allowed cursor. Faking it with `opacity: 0.5` reads as loading instead.
- **Loading**: in-field spinner, input blocked, to prevent double submits.

## Form Validation Timing

- **On submit is too late** — ten fields filled, then a wall of errors.
- **On every keystroke is too early** — flagging a field before the word is finished.
- **The sweet spot is on blur**: validate when focus leaves the field, so feedback lands after they're done but before they submit.
- **Once a field has errored, switch that field to live validation** so the message clears the instant it is corrected.
- Success is feedback too: a green check confirms a field is right, not only flags what's wrong.

## Stepper Wizard

- **Chunk** long forms. Three fields read effortlessly; twelve in a row trigger scroll fatigue.
- **Group by context, not by count** — Personal, Shipping, Payment, Review. Splits made on an arbitrary number feel random; each step should earn its own screen.
- **Always show progress** — one indicator, whether a bar, numbered dots, or step labels, so the end feels reachable.
- **Validate inside each step** and block Next while a field is invalid. A bad email on step one must never surface on step four.
- Prefer inline errors over final-screen rejection.
- **Persist state on every step change.** Back navigation and a page refresh must preserve entered data — lose the form once and you lose the user.

## Input Masking

- **Group digits in fixed chunks** — a space every four characters turns 16 unreadable digits into scannable blocks.
- **The leading digit names the brand** (4 Visa, 5 Mastercard, 3 Amex) — surface the card mark inline as they type.
- **Keep the caret** right after the character just typed when a separator is auto-inserted. Jumping it to the end breaks editing and is disorienting.
- **Validate on blur, not on keystroke.** "Invalid card" mid-entry reads as premature.
- **Strip junk on paste**: clean dashes and spaces and reformat to your grouping rather than rejecting the value.
- **Show formatted, store raw.** Persist unformatted digits; the grouping is a view.

## OTP Input

Six boxes are a view of one value, not six values.

- Model it as **one string**: `useState("847291")`, not an array of six. The boxes render from a single source of truth.
- **Paste is the primary path**: on paste into any box, strip non-digits (`value.replace(/\D/g, "")`) and distribute across all six at once.
- **Auto-advance** focus as each digit lands; **backspace on an empty box** jumps back and clears the previous one, so correcting a typo never traps the cursor.
- Mobile: `inputmode="numeric"` and `autocomplete="one-time-code"` so the OS offers the SMS code as one-tap autofill.
- **Throttle resend behind a visible ~30s countdown.** Without it, impatient users spam the button into `429 Too Many Requests` and a temporary ban.
- Instant submit feedback: wrong code shakes, clears and refocuses; correct code locks each box green with a check.

## Password Field UX

- Strength is **entropy, not a checkbox tally** — a longer passphrase beats a mandatory symbol.
- Show the **requirements checklist as they type**, ticking each rule green. Never reveal the rules only after a failed attempt.
- A **live strength meter** coaches in real time; post-submit errors only punish.
- Add an **eye toggle** to unmask — masked dots cause silent typos users can't catch.
- **Never block paste.** Password managers fill longer, stronger passwords than anyone types.
- The strongest pattern: **offer a generated password**, one tap to a unique, saved credential.

## File Upload UX

Upload is a system of states, not a bare file input.

- **Dropzone answers before the drop**: border, glow and copy all shift on drag-over, so the target is never a dead zone.
- **Honest progress**: percent complete and estimated time remaining, so the user can decide to wait or walk away. A spinner hides the truth.
- **Inline retry** when an upload dies at 90% — keep the file loaded and resume in one tap. Never force re-selection.
- **Visual proof**: thumbnail, type and size, not just a filename.
- **Per-item queue**: in a multi-file upload each item gets its own progress and its own retry; one failure never blocks the other nine.

## Date Pickers

- **Presets cover ~90% of cases**: Today, Yesterday, Last 7 days, Last 30 days, Last quarter — one click each. Custom range is the exception, not the default path.
- For custom ranges make selection legible: **hover paints a live preview**, first click locks the start, second locks the end, and the edges stay **draggable** to refine without starting over.
- **Show two months side by side** so a range can cross the month boundary naturally. Three on large screens. Never make someone click "next" four times to reach a nearby date.
- **Full keyboard**: arrows move across the grid, typing the date directly works, Enter confirms, Escape closes, PageUp jumps a month, Shift+PageUp a year.
- **Mobile is not a shrunken popover**: full-screen sheet, vertical scroll, today anchored at the top, large confirm button within thumb reach.

## Range Sliders

Dragging is imprecise — a finger cannot reliably land on 47 rather than 48. Design around that.

- **Fill the track.** The filled length *is* the value, readable at a glance. A bare track forces users to eyeball the thumb.
- **Make the whole row draggable.** A 4px hairline is a moving target; expand the hit area.
- **Snap to steps** with visible ticks when clean values matter — free dragging lands on 47.3, and nobody wants 47.3.
- **Float the value in a tooltip** above the thumb while dragging, where the eye already is.
- Two-thumb ranges get a filled band between the handles.
- **Keyboard**: arrows step by one, Home and End jump to the extremes.

## Toggle Anatomy

- **Proportions**: rail twice the knob's diameter, knob padded by its own radius so it sits centered in both states.
- **It morphs, it doesn't snap**: animate the flip over **~250ms ease-out**.
- **Four properties change at once** during the flip — rail color, knob position (`translateX`), knob shadow, and the state label. All together, not in sequence.
- **Accessibility**: Space toggles when focused, a visible focus ring shows keyboard position, `aria-checked` announces state.
- **Async toggles go optimistic**: flip immediately, spin a loader inside the knob while pending, and roll back with a shake plus error toast if the server fails. An un-spun switch during a request looks stuck.
