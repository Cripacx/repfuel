# Navigation — structure, tabs, paging, focus

4 patterns: [Navigation Patterns](#navigation-patterns) · [Tabs System](#tabs-system) ·
[Pagination](#pagination) · [Focus States](#focus-states)

---

## Navigation Patterns

Five patterns, one system. Choose by **platform and depth**, not taste.

- **Bottom tabs** — the mobile default: 3–5 top destinations, always visible, within thumb reach. Burying those same links in a hamburger drops engagement by roughly 40%.
- **Persistent sidebar** — the desktop answer for hierarchical content with 5+ sections. Collapsing it by default kills discoverability.
- **Hamburger** — secondary navigation, never primary. Acceptable on mobile; hiding the menu on desktop drops engagement by roughly 56%.
- **Command palette (⌘K)** — a search-driven accelerator for power users. Pair it with visible nav; new users don't know it exists, so it must never be the only path to a feature.
- **Breadcrumbs** — only earn their space when the hierarchy runs deeper than 2 levels. On flat structures they are noise, not orientation.

## Tabs System

Tabs are a system, not a widget.

- **The active indicator slides, never teleports.** Drive it with a spring and match its timing to the content fade — slow in, fast out.
- **Overflow scrolls horizontally, never wraps to a second line.** Add edge fades to hint at what's off-screen, plus chevron buttons on desktop.
- **Keyboard**: arrows move between tabs, Home jumps to first, End to last, Tab exits to the next focusable group.
- **The focus ring and the active state must never share a color** — otherwise keyboard users can't tell where they *are* from what's *selected*.
- **Content never hard-cuts on switch**: fade out, pause ~80ms, fade in, and match panel heights so nothing shifts.
- **Mobile isn't a shrunk desktop**: segmented control under 5 tabs, bottom sheet over 5. Never a scaled-down desktop bar.

## Pagination

- **Offset pagination drifts** when data changes — insert a row at the top and every page shifts, so the same item can appear twice or be skipped.
- **Cursor pagination stays stable**: it anchors to a specific row rather than a numeric position. Use it wherever rows are inserted or deleted often.
- **Three patterns, three jobs**: numbered (jump to any page), load-more (on-demand appends), infinite scroll (continuous feeds).
- **Never render every page link.** Truncate to first, last, current and immediate neighbors, with an ellipsis for the gaps.
- **Keep the page in the URL** (`?page=500`) so refreshes stay put and the view is shareable.
- **Restore scroll position** when users return from a detail view instead of dumping them back at the top.

## Focus States

- **`outline: none` is not a style choice** — removing the default focus ring without a replacement ships an accessibility failure.
- A proper ring needs three things: **2px thickness, 2px offset, and enough contrast** to stay visible on light and dark backgrounds.
- **`:focus-visible`** distinguishes mouse from keyboard — a click gets no ring, a Tab press does. Keyboard users get orientation without cluttering the pointer experience.
- **Focus follows DOM order, not visual layout.** Reorder columns with CSS and Tab starts teleporting across the page. Keep visual and DOM order in sync.
- **Trap focus inside modals**: Tab cycles within the dialog and wraps; Escape closes and returns focus to the element that opened it. Never let a modal leak focus to the page behind it or drop focus on close.
- **A skip link** jumps past dozens of nav links in one keypress. Make it the first element on the page, invisible until focused.
