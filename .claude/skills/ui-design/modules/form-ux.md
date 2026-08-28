# Module: Form UX

**Purpose:** forms are where drop-off is measurable. Five decisions carry most
of it: what you ask, how it's grouped, where the labels sit, when you validate,
and what you pre-fill.

## 1. Cut fields first

The cheapest improvement is asking for less.

- For every field: **what breaks if we don't ask this now?** If the answer is
  "nothing, we'd just like to know", move it to later or to a profile page.
- Anything the system can derive — country from IP, city from postal code,
  company from email domain — is derived, not asked.
- Optional fields are usually just noise. Either it matters or it goes. If some
  must stay, **mark optional, not required** — the optional ones are fewer.

## 2. Group and size

- **3 fields read effortlessly. 12 in a row trigger scroll fatigue.**
- Group by **meaning, not count**: Personal · Shipping · Payment · Review.
  Splits at an arbitrary number feel random.
- Group boundaries are made with spacing: ~12px between related fields, ~40px at
  section breaks. No dividers needed.
- **Field width signals expected length.** A postal code in a full-width input
  is a small lie. Size inputs to their content.

**When to make it a stepper** (see `references/forms.md` → Stepper Wizard):
more than ~7 fields, or fields that fall into genuinely different contexts.
Then: progress indicator, validate inside each step, block Next while invalid,
and **persist state on every step change** — Back and refresh must not wipe
entered data.

## 3. Labels and helper text

- **Label above the field, always visible.** A placeholder-as-label vanishes the
  moment typing starts, leaving the user unable to check their own work.
- Placeholders show **format examples**, not names: `MM/YY`, `you@company.com`.
- Helper text below the field, before the error appears — explain the rule
  *up front* rather than punishing after ("At least 12 characters" beats a red
  message after submit).
- Label copy names the thing in the user's words, not the column name.
  Not `user_ref`, not "Identifier" — "Order number".

## 4. Validation strategy

The timing rule, in order of preference:

1. **On blur** — validate when focus leaves the field. Late enough that they've
   finished, early enough to fix before submit.
2. **Live once errored** — after a field has failed, revalidate on every
   keystroke so the message clears the instant it's correct.
3. **Live from the start** — only for rule checklists (password strength,
   username availability), where watching criteria turn green is the point.
4. **On submit** — only as a final backstop for things you can't check locally.

Never fire red errors on the first keystroke, and never hold every error until
submit and reveal a wall.

Error copy: **what's wrong + how to fix it**, inline, anchored to the field,
with color **and** icon **and** text. Border-only red is invisible to roughly
12% of users. Confirm correct fields too — a green check is feedback.

Full detail: `references/forms.md` → Form Field States, Form Validation Timing.

## 5. Smart defaults

- Pre-fill everything you already know. Every pre-filled field is a field the
  user doesn't type.
- Default to the **most common choice**, not to blank — but make it obviously
  changeable, and never pre-select something with cost or consent attached.
- Correct input types and autocomplete: `inputmode="numeric"`,
  `autocomplete="one-time-code"`, `autocomplete="street-address"`. On mobile
  this decides which keyboard appears.
- **Never block paste.** Password managers and copied codes matter more than
  the theoretical typo.
- Formatting: mask as they type (card numbers in groups of four), keep the caret
  in place, strip separators on paste, **show formatted, store raw**.

## 6. Progressive disclosure

- Show the common path; hide the rest behind a clear affordance ("Add a second
  address", "Advanced options"). Hidden ≠ gone, but hidden must be discoverable.
- Conditional fields appear **only when their condition is met**, and appear
  with a short height/fade transition so the layout change is legible rather
  than a jump.
- Don't disclose progressively to hide a bloated form — cut it first (step 1).

## 7. Submit and after

- The submit button names the outcome, not the mechanic: "Create my account",
  "Send invoice" — not "Submit".
- On click: immediate pending state, disabled to prevent doubles, and feedback
  within 400ms.
- Never clear a form on error. Ever.
- On success, say what happens next and give the next action — the ending
  carries disproportionate weight.

## Output

```
FORM SPEC — [name]
Fields kept:      [list] · Cut/deferred: [list]
Groups:           [group → fields] · spacing [in-group / between]
Layout:           [single screen | n steps]
Labels:           above · helper: [per field where needed]
Validation:       blur → live-after-error · [special: strength meter, availability]
Defaults:         [pre-filled from] · [defaulted choices]
Disclosure:       [what's hidden behind what]
Submit:           [label] · pending state · post-success next step
```
