# Motion — timing, easing, hover, scroll

4 patterns: [Animation Timing](#animation-timing) · [Easing Curves](#easing-curves) ·
[Card Hover Anatomy](#card-hover-anatomy) · [Scroll-Driven Animations](#scroll-driven-animations)

---

## Animation Timing

Same component, two timings: one reads premium, one reads broken. It is all milliseconds.

| Motion type | Duration | Curve |
|---|---|---|
| Tap / press feedback | **< 100ms** | any; anything slower reads as lag |
| Entrance | **200–300ms** | cubic ease-out |
| Exit | **~40% faster than its entrance** (250ms in → ~150ms out) | ease-in |
| Attention-grabbing (notifications) | 500–800ms | bounce / overshoot |
| Stagger between list items | **~50ms apart** | — |

- Entrances past ~300ms start to feel sluggish and in the way.
- **Symmetric in/out timing is the classic mistake** — a matched-length exit makes the UI feel like it is dragging.
- Stagger tuning matters: 30ms blurs items into one blob, 100ms makes the list crawl in.
- Match the curve to intent: ease-out for entrances; springs and bounce only for moments that genuinely need attention.

## Easing Curves

The curve maps how a value changes over time. Same distance, same duration, different curve — completely different feel. That shape is what the eye actually reads.

- **Linear** moves at constant speed and looks mechanical. Reserve it for continuous motion (spinners, marquees). Never for UI that starts and stops.
- **Ease-out** starts fast, decelerates into place. The safe default for anything entering the screen, because it mirrors how real objects settle.
- **Ease-in-out** for elements moving between two positions.
- **Spring** overshoots slightly then settles. Reads alive and premium — button presses, modals, playful confirmations. Keep stiffness moderate: a little overshoot sells it, too much wobble reads broken.
- **Reuse the same handful of curves everywhere.** Consistent easing is a large part of why an interface feels coherent rather than stitched together.
- Stagger list and card entrances a few frames apart so they cascade in instead of snapping on as one rigid block.

## Card Hover Anatomy

Four rules separate a card that feels alive from one that feels dead.

- **Lift with weight**: raise ~8px on hover and stretch the shadow with it over **~200ms ease-out**. Faster reads twitchy, slower reads stuck.
- **Claim the cursor**: a pulsing accent border or gradient sweep around the edge signals interactivity.
- **Cascade the actions**: reveal hidden buttons (favorite, cart, share) staggered **~60ms apart**, anchored to the bottom edge. A reveal adds an affordance — it must not create a new layout.
- **Push against the glass**: scale the image to **~1.05 inside an `overflow: hidden` frame** while the container stays fixed. The content presses outward instead of the card resizing.
- **The trap — keep the geometry.** Never scale the whole card: it shifts neighbours and breaks the grid. Animate the content, hold the footprint. Also never let action buttons stack over the title or spill outside the card.

## Scroll-Driven Animations

Modern CSS replaces the whole scroll-listener genre.

- `animation-timeline: scroll()` turns the scrollbar itself into an animation controller — no JavaScript, no IntersectionObserver, two lines of CSS.
- `animation-range` sets the exact trigger window, so an animation can fire on entry, on exit, or anywhere between.
- `view()` targets individual elements — each card animates as it enters the viewport, automatically.
- Parallax that once needed ~30 lines of JS is now layers moving at different speeds in pure CSS.
- Layer these on `position: sticky` for shrinking headers, reading-progress bars, and sidebars that transform on scroll.
- Don't hand-roll reveals with a scroll listener and `getBoundingClientRect()`, and don't pull in an animation library for effects the browser drives natively. (Do check browser support and provide a static fallback where it matters.)
