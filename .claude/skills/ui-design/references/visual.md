# Visual — layout, color, type, depth

18 patterns. Jump to what you need:

[Visual Hierarchy](#visual-hierarchy) · [Design Tokens](#design-tokens) ·
[Design System Kit](#design-system-kit) · [Grid System](#grid-system) ·
[Golden Ratio](#golden-ratio) · [Proximity Rule](#proximity-rule) ·
[Gestalt Laws](#gestalt-laws) · [Von Restorff Effect](#von-restorff-effect) ·
[Color Accessibility](#color-accessibility) · [Dark Mode](#dark-mode) ·
[Gradient Design](#gradient-design) · [Border Radius](#border-radius) ·
[Shadow Elevation](#shadow-elevation) · [Depth Layers](#depth-layers) ·
[Perfect Card](#perfect-card) · [Icon Design Rules](#icon-design-rules) ·
[Z-Index Mastery](#z-index-mastery) · [Charts That Lie](#charts-that-lie)

---

## Visual Hierarchy

Five levers decide what gets seen first. No single one carries a layout — they stack.

- **Size**: the primary element around 2× body text. That is the entry point.
- **Color**: spend it like currency. Neutral interface, one accent, reserved for the single most important action. Coloring everything flattens hierarchy into noise.
- **Contrast**: bold white heading against muted body; filled primary button beside a ghost secondary. Roles become obvious at a glance.
- **Whitespace**: a signal, not filler. Hero elements get room to breathe, secondary items stay compact. Padding reads as importance.
- **Weight**: build reading order without changing size — ~800 headings, 400 body, 300 captions.

Failure mode: everything at equal emphasis, so the eye has nowhere to land.

## Design Tokens

- Name by **meaning, not value**. `--color-primary` survives a rebrand; `--color-blue-500` becomes a lie the day blue turns teal.
- Three layers, each referencing the one above: **primitives** (raw values) → **semantic** (meaning) → **component** (usage). Change one primitive, it cascades everywhere instead of 47 hunted-down edits.
- Define a scale and snap to it. A stray 13px padding collapses to 12; 17px gap to 16. Consistency stops being a judgment call.
- Dark mode is **swapping a token set**, not inverting colors. Same components, aliased tokens, different feel.
- Tokens are the single source of truth for color, spacing and type. The design system is only as strong as they are.

## Design System Kit

The starter kit when nothing exists yet:

- **Color**: build a numbered scale (100–900) so every shade is systematic, then map it onto semantic names — brand, success, warning, error.
- **Type**: fixed sizes *and* weights. Identical size and weight everywhere means zero hierarchy.
- **Spacing**: 4px scale, space-1 = 4 through space-16 = 64.
- **Components**: standardize as variants (primary / secondary / ghost / destructive), sizes (sm / md / lg), and states (default / focus / error / disabled).
- **Motion**: tie easing to intent — ease-out entering, ease-in-out moving, ease-in leaving — with a duration scale from 100ms micro-interactions up to 500ms complex transitions.

## Grid System

- Start from **12 columns** — it divides cleanly into halves, thirds, quarters and sixths, so nearly any layout maps onto it.
- Use column **ratios** deliberately: 4:8 sidebar + content, 6:6 even split, 3:9 narrow nav beside a wide canvas.
- **Gutters set the mood**: 8px reads dense and technical, 24px balanced and clean, 40px editorial and premium.
- Responsive: drop columns per breakpoint — 12 desktop → 6 tablet → 4 large phone → 1 stacked.
- Break the grid **only once it is established**: a full-bleed hero or a pull quote pushed into the margin reads as intentional against order, and as sloppy without it.
- Shared column edges are what separate "designed" from "amateur".

## Golden Ratio

- 1.618 as a proportional generator, not a mystical rule. Layouts built on consistent proportion read as balanced rather than arbitrary.
- **Spacing scale**: multiply a base unit by 1.618 → 8, 13, 21, 34, 55.
- **Layout split**: roughly 62% / 38%, larger share to primary content.
- **Type scale**: 16 body → 26 subheading → 42 heading → 68 display.
- Round results to clean pixels your grid can use, and don't let the ratio fight an existing 8px system.

## Proximity Rule

- Close together reads as one group; spaced apart reads as separate. Distance alone communicates relationship.
- You rarely need borders, boxes or dividers — **spacing does the grouping**.
- The mechanism is contrast: gap *within* a group must be smaller than gap *between* groups. Equal spacing everywhere flattens everything into one block.
- Forms: ~12px between related fields, ~40px at section breaks, so "Personal" and "Payment" separate without a single line.
- Toolbars and nav: group by function (navigate / actions / system) instead of one evenly-spaced row.

## Gestalt Laws

The brain groups pre-attentively. Work with it and a layout feels organized instead of busy.

- **Closure** — the eye completes incomplete shapes, so icons still read with gaps in the outline.
- **Similarity** — shared color, shape or size reads as one group; recoloring rows splits a flat grid into Navigation / Content / Actions instantly.
- **Continuity** — the eye follows the smoothest path. Align related controls on a shared axis; scattered placement forces it to jump.
- **Figure-Ground** — dimming and blurring the background pushes a modal forward as the figure. A dialog without it competes with the page instead of standing out.
- **Common Region** — a shared border or container groups elements that sit far apart. Wrap settings in a card when proximity alone can't reach.

## Von Restorff Effect

The isolation effect: what differs gets noticed and remembered.

- It only works against a **uniform baseline**. Three identical pricing cards give the eye nowhere to go.
- Pricing: scale up the target plan, badge it ("Most popular"), and quiet the alternatives — the choice steers itself.
- One CTA lifted by color, scale and glow while nav links recede pulls attention reliably.
- Forms: emphasize the primary action, mute secondaries.
- **Limit emphasis to one element per view.** Two or three competing highlights cancel the effect entirely.
- Differentiate with more than color — combine scale, elevation and glow so it holds for color-blind users too.

## Color Accessibility

- Contrast is a **ratio, not a color**. The same off-white reads crisp on a dark panel and vanishes on a light one — the background decides.
- Thresholds: **4.5:1 body text, 3:1 large text**. Below 3:1 text is effectively invisible.
- Most failures hide in "decorative" muted greys — nav links, card labels, secondary headings sitting at 1.5–2:1 because low contrast looks sleek.
- **Never encode meaning with color alone.** For the ~8% with color vision deficiency, red error and green success collapse into one muddy tone.
- Add a second signal to every color cue: an icon on error text, trend arrows on stats, patterns in charts.

## Dark Mode

- Dark mode is **not black mode**. Base on a near-black like **#121212**, so shadows and depth remain visible. Pure #000 flattens elevation.
- Signal elevation with **layered surfaces** — each step up gets a lighter grey (base → surface → elevated) where light mode would use a shadow.
- **Desaturate accents ~20%.** Full-saturation colors vibrate against dark backgrounds and read cheap.
- Never pure white text — #FFFFFF glares. Calibrate to a soft off-white.
- Build text hierarchy with **opacity tiers** (high / medium / disabled emphasis), not new colors.

## Gradient Design

- Cheap gradients travel too far around the hue wheel. Neighbouring hues blend cleanly; opposites create a muddy grey dead zone mid-transition. **Stay within ~60° of hue travel.**
- Keep lightness moving in one direction. Dark → light → dark reads as banding.
- Gradients work as **ambiance, not surface**: a soft radial glow behind content beats a full-bleed linear wash on top of it.
- Add 2–3% noise/grain to hide banding on cheap displays and add perceived texture. Test on a low-quality screen.
- Never place body text on the mid-transition zone — contrast there is unpredictable.

## Border Radius

- **Nested corners follow math: inner radius = outer radius − padding.** Concentric curves are what make a card read as intentional rather than subtly "off".
- Pull every value from one scale — 4 · 8 · 12 · 16 · 24 — instead of choosing per component.
- Scale radius with element size: tooltip ~4, input ~8, card ~12, modal ~16, panel ~24. Bigger surfaces earn bigger corners.
- Radius carries personality: small and sharp reads corporate, large and round reads friendly. Match the brand, and don't mix the two registers.

## Shadow Elevation

- Real depth comes from **stacking shadows**, not one blur: a tight contact shadow, a mid-distance shadow, and a wide soft ambient one.
- The tight contact shadow (~`0 1px 3px`) is what anchors an element to the surface instead of leaving it floating.
- A subtle **colored glow** — low-opacity blur in an accent hue — reads premium in a way plain black never does. Match it to product context (purple creative, blue fintech, green health).
- A 3D lift (`perspective` + small `rotateX` + `translateZ`) adds depth beyond a flat drop shadow.
- Elevation is a **hierarchy signal**: the most elevated element reads as the most important. Which is why the premium tier looks lifted and the basic one stays flat.

## Depth Layers

Three properties turn flat cards dimensional — no redesign, same layout, same colors.

- **Layered shadows**: tight (~2px), mid spread (~12px), large ambient (~32px), mimicking real light falloff.
- **Parallax scroll**: move layers at different speeds — background slow, midground medium, foreground fastest (roughly 1× / 2.5× / 5×).
- **Z-translation on hover**: lift toward the viewer with `translateZ` plus `scale(1.03)` and a soft glow. Keep it a few pixels and ~3% — more reads cartoonish.
- Depth also lives in **intensity**: brightening the border on hover reinforces the lift.

## Perfect Card

Four changes separate a card that looks free from one that looks expensive.

- **Padding** is the biggest tell: 12px cramped → ~40px, with ~24px radius.
- **Type hierarchy**: title to 600 weight and ~38px; body smaller and dropped to ~55% opacity so the eye lands on the title first.
- **Two stacked shadows**: one tight and darker for contrast, one wide and soft for ambient elevation. Plus a hairline border at ~12% opacity to define the edge against dark backgrounds.
- **Hover state**: ~8px lift, scale to ~1.02, deeper shadow — signals clickability and adds the final polish.

## Icon Design Rules

- **Optical sizing beats math**: circular and organic shapes need to sit 5–8% larger than squares to read the same size. Equal pixel boxes make round icons look small.
- **Grid alignment**: snap to a 24px grid (16px for dense UI). Sub-pixel drift blurs edges.
- **Stroke consistency** is the fastest quality tell: one weight — 2px — across the entire set. Mixed weights look like four libraries mashed together.
- **Fixed bounding box** for every icon, even when shapes differ, so toolbars stay legible.
- **Fill vs outline is a set-wide commitment**, not a per-icon choice. A random mix has no rule holding it together.

## Z-Index Mastery

- `z-index` does nothing on a `position: static` element. Give it `relative` (or absolute/fixed/sticky) first — this is the single most common cause of "my z-index isn't working".
- Every stacking context is its own universe: a child at `z-index: 9999` can never climb above its parent's siblings. If the parent lost, the child lost.
- A z-index arms race (9999 → 99999) is a symptom, not a fix. The real culprit is an unexpected stacking context up the tree — often created by `transform`, `filter`, `opacity < 1`, or `will-change`.
- `isolation: isolate` creates a clean stacking context in one line so a component's internal layers stop leaking.
- Use DevTools' Layers panel to see the actual 3D stack instead of guessing.

## Charts That Lie

- **Start every bar chart's y-axis at zero.** A truncated baseline turns +4% into a fake +400% — the most common way charts mislead.
- **Match chart type to the question**: bars compare values, lines show change over time, pie charts fall apart past ~5 slices. The question picks the form.
- **Aspect ratio rewrites the trend.** The same series looks flat squished and like a spike stretched. Balance so the average slope sits near 45°.
- **Maximize data-ink**: strip gridlines, drop shadows, 3D skew and boxed legends; label the line directly. Every remaining pixel should carry data.
- **Color is encoding, not decoration**: one hero color for the series that matters; categorical / sequential / diverging scales chosen to fit the data type.
- **Title with the takeaway, not the metric.** "Revenue flat since March" tells the story; "Quarterly revenue" makes the reader hunt for it.
