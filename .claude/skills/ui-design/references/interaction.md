# Interaction — overlays, controls, data, gestures

14 patterns: [Modal Hierarchy](#modal-hierarchy) · [Bottom Sheets](#bottom-sheets) ·
[Dropdown Design](#dropdown-design) · [Tooltip Design](#tooltip-design) ·
[Accordion Disclosure](#accordion-disclosure) · [Command Palette](#command-palette) ·
[Search Experience System](#search-experience-system) · [Filter Chips](#filter-chips) ·
[Data Table](#data-table) · [Drag and Drop](#drag-and-drop) · [Swipe Actions](#swipe-actions) ·
[Star Rating](#star-rating) · [Color Picker UX](#color-picker-ux) · [Peak-End Rule](#peak-end-rule)

---

## Modal Hierarchy

Start with one question: **does it block the user?** If yes, modal. If no, choose by context.

| Overlay | Use for | Behavior |
|---|---|---|
| **Modal** | critical or destructive decisions ("Delete account?") | full scrim, centers a single decision, must be answered |
| **Bottom sheet** | mobile-first default | slides up, drag handle + snap points, page stays partly visible |
| **Drawer** | navigation | edge-anchored, dims only what it covers, app alive behind |
| **Popover** | lightweight menus, quick actions | anchored to its trigger, small (~200px), never blocking |

- **Match weight to intent.** Reaching for a modal where a popover would do adds friction to routine actions.
- Never use a full-screen scrim for a routine action, and never bury navigation inside a blocking overlay.

## Bottom Sheets

- Screens keep getting taller while thumbs stay the same length. The top of a phone display is a **dead zone** for one-handed use.
- Anchor menus and actions to the bottom, where the thumb rests — not the top-right corner most navs default to.
- Unlike a full modal, a sheet keeps the underlying page **visible**, so users never lose their place.
- **Snap points** let the sheet rest half-open or expand full height, matching how much content is needed.
- **Drag-to-dismiss**: a downward gesture maps to the sheet's direction and needs no tiny close target.
- Dim the background with a scrim and **lock body scroll** so only the sheet moves.

## Dropdown Design

- **Obviously clickable trigger**: ~48px touch target, visible caret, real hover state. Not a 30px box with a faint border.
- **Flip on edge** — open upward when there isn't room below, so the menu never clips off-screen.
- **Keyboard is not optional**: arrows move the highlight, Enter selects, Esc closes.
- Past **~10 items**, add a search field so users filter instead of scroll-hunting.
- **Open in ~150ms.** 50ms feels instant and cheap; 500ms drags.

## Tooltip Design

- **~300ms delay** before a hover tooltip appears, so it doesn't fire on every accidental cursor graze.
- **Anchor with an arrow.** A floating label above a row of icons leaves users guessing which one it describes.
- **Flip near viewport edges** instead of clipping.
- **Dismissible everywhere**: mouse leave, Escape, focus out, and a tap outside.
- Keep it **tight — around 300px max width, one sentence.** If it needs a documentation paragraph, it isn't a tooltip anymore.

## Accordion Disclosure

- **You cannot animate `height: auto`** — the transition just snaps. Use `display: grid` with `grid-template-rows` going `0fr → 1fr`, or measure `scrollHeight` and animate to a pixel value.
- **Drive the chevron rotation from the same timing curve as the panel.** Even ~10 frames of lag between them reads as broken.
- **Decide single vs multi-open**: an accordion opens one panel at a time (sequential steps); a disclosure lets many stay open (FAQ lists).
- **The header is a `<button>`, not a `<div>`**, with `aria-expanded` reflecting state and `aria-controls` pointing at the panel. That gets Enter/Space and the focus ring for free.
- When an item near the bottom expands, **anchor the tapped header** so the list doesn't jump under the user; stagger the revealed content in.

## Command Palette

⌘K is a system, not a search box.

- **Fuzzy matching**, not exact substring: "stg" should surface Settings, Storage and Staging. Exact matching returns nothing and feels broken.
- **Group results** into labeled sections (Recent, Actions, Pages) so a long flat list becomes scannable.
- **Fully keyboard-driven**: arrows move the highlight, Enter runs, Esc closes.
- **Never open to a blank void** — prefill recent or suggested commands so there is something to act on before typing.
- **Async commands** show an inline spinner and keep the palette open; don't freeze the screen.
- Support **nested commands** with a breadcrumb, where Esc walks back exactly one level.

## Search Experience System

Five parts most apps skip.

- **Placeholder copy is onboarding.** "Search" tells the user nothing; "Search by name, SKU, or brand" tells them everything that's searchable.
- **An empty field isn't empty** — load recent searches on focus so one tap refills the bar.
- **Rank autocomplete by clicks, not alphabet**, and tag each suggestion with a category badge. Three sharp results beat ten noisy ones.
- **Keyboard-driven throughout**: arrows through results, Enter selects, Escape closes — with the focus ring visible at every step.
- **Zero results is never a dead end**: offer popular searches, category jumps, or alternate spellings at exactly the moment users would otherwise bounce.

## Filter Chips

- **Three distinct visual states**: idle (surface + border), active (filled + check), disabled (dimmed, no results behind it). If active looks like idle, the filter reads as broken.
- **Make the combination logic legible**: OR within a group widens the net (more colors = more matches); AND across groups narrows it.
- **Update the result count on the same frame as the tap.** If the number doesn't move, users assume nothing happened and tap again.
- **Always ship a clear-all reset**, paired with the live count so the escape hatch is legible.
- **Overflow scrolls horizontally in one row** with a right-edge fade hinting at more. Wrapping into a multi-row wall pushes results below the fold.
- Pin active filters in a **sticky summary bar** so users can always see why the list shrank.

## Data Table

- **Sort is tri-state**, not a toggle: ascending → descending → back to original. A binary flip destroys natural order permanently.
- **Numbers must line up**: tabular figures, right-aligned numeric columns. Proportional left-aligned digits jitter and can't be compared at a glance.
- **Freeze what you navigate by**: sticky header on vertical scroll, frozen first column on horizontal scroll, each with a subtle shadow.
- **Density is a token**, not a guess: one control switching row heights (e.g. 36 / 48 / 60px). Zebra stripes help at comfortable spacing; collapse to a hairline as rows compact.
- **The whole row is the selection target** — full tint, accent left bar, plus the checkbox — not a tiny checkbox-only hit area.
- **Select-all morphs empty → indeterminate (dash) → checked** so partial selection reads at a glance.

## Drag and Drop

- **Confirm the lift with three cues at once**: slight scale-up, deeper shadow, small tilt. The item must feel like it left the surface.
- **Drop zones speak first** — reveal where the item will land *before* release. A drag should never feel like a guess.
- **Match the cue to scope**: an insertion line to slot between items, a filled highlight to land inside a whole column.
- **Snap** to the nearest valid slot on structured surfaces; reserve free positioning for canvases where any coordinate is valid.
- While dragging on a snapping surface, **expose valid targets** (dashed outlines) so the destination is never ambiguous.
- **Pair every drop with a ~5s undo toast.** A drag is easy to fumble; a wrong move should cost one click, not a redo.

## Swipe Actions

- Swipe is **invisible UI**. Without an affordance hint — a peek of the action on first scroll, an onboarding nudge — most users never discover it.
- **Destructive swipes need friction**: a full swipe that instantly deletes is a data-loss bug. Reveal the button on partial swipe and require a tap, or allow full-swipe with an undo toast.
- **Color-code by consequence** — neutral actions on surface tones, destructive on red — and keep the mapping identical across every list in the app.
- **Never the only path.** Every swipe action needs a visible fallback (long-press menu, detail-view button) for discoverability and accessibility.
- **Max two actions per side**, or users can't build muscle memory. Keep left/right semantics consistent app-wide.

## Star Rating

- **Preview on hover**: stars fill ahead of the cursor so users see the value before committing. A widget that only reacts on click hides the target until it's too late.
- **Keep preview state separate from the committed value.** When the pointer leaves without clicking, snap back to the saved rating.
- **Render fractional stars for averages** — 4.4 is four full stars plus a fifth clipped to 44%. Rounding up to five is a lie that inflates perceived quality.
- **Stagger the fill ~30ms per star**, left to right. Popping all five at once reads flat.
- Pair the input with a **summary view** — an average ring plus a distribution breakdown.

## Color Picker UX

- Treat it as a **decision tool**, not a gradient with a slider. Every pick cascades into the rest of the UI.
- **Offer OKLCH alongside hex.** Hex is for machines; OKLCH's lightness, chroma and hue let you change one number and get a predictable shade.
- **Give it memory**: recent swatches and saved palettes keep the last five picks one tap away.
- **Show a live contrast ratio at pick time**, not in review — a badge flipping red to green kills failing pairs before they ship.
- **Preview alpha over a checkerboard** on both light and dark backgrounds. Transparency lies on a white canvas.
- **Turn one pick into a system**: generate tints and shades from a single hue to produce ten tokens from one decision.

## Peak-End Rule

Users don't average an experience. They remember its **peak** and its **end**, and judge the whole from those two points.

- Two flows with identical average satisfaction are remembered completely differently based on how they finish.
- **Engineer at least one intentional peak** — a surprise upgrade, a free perk, a moment of delight. One delight outweighs five neutral steps.
- **The ending carries disproportionate weight.** A joyful last screen beats a flat confirmation for the same effort.
- The reverse also holds: a broken or error-filled final step tanks the memory of an otherwise smooth experience.
- **Audit the final interaction of every flow.** Stop spreading effort evenly across every step — concentrate it on the peak and the end.
