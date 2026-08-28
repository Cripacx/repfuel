# Feedback — speed, loading, errors, notifications, undo

9 patterns: [Doherty Threshold](#doherty-threshold) · [Loading States System](#loading-states-system) ·
[Skeleton Loading](#skeleton-loading) · [Optimistic UI](#optimistic-ui) · [Error States](#error-states) ·
[Notification System](#notification-system) · [Toast Notifications](#toast-notifications) ·
[Undo UX](#undo-ux) · [Zeigarnik Effect](#zeigarnik-effect)

---

## Doherty Threshold

**400ms** is the line. Respond faster and you hold attention; slower and users mentally disconnect.

- Under **200ms** feels instant. **200–400ms** is tolerable. **Over 400ms** starts breaking engagement.
- What matters is **perceived** speed, not raw speed. The real work may take longer as long as the interface reacts within the threshold.
- Three ways to buy time: skeletons (paint placeholder shapes the instant a screen opens), optimistic UI (update as if it succeeded), progress feedback (keep an unavoidable wait legible).
- Never leave a screen blank or frozen while data loads, and never wait for a server round-trip before giving any visual response.

## Loading States System

Loading is a **system**, matched to what you actually know about the wait. One default applied everywhere is the tell of a lazy UI.

| You know | Use | Threshold |
|---|---|---|
| The content's shape (cards, lists, articles) | **Skeleton** | wait > ~300ms |
| Nothing, but the wait is short | **Spinner** | < ~3s only |
| The percentage (uploads, installs, exports) | **Progress bar** | > ~3s |
| The action is reversible (like, save, reorder) | **Optimistic UI** | instant |
| The response resolves fast | **Nothing at all** | < ~300ms |

- Never stretch a spinner across a full-page load — an endless spinner with no context reads as frozen.
- Pair a progress bar with real meta (time remaining, speed) so the number earns trust.
- **A flash of a loading state feels more broken than a slight delay** — the eye registers flicker as a glitch, not as feedback.

## Skeleton Loading

- A spinner says "something is happening" and nothing about *what* or *how long*. That uncertainty is what makes waits feel slow.
- Skeletons preview the shape of incoming content — avatar circle, text bars, image block — so the brain starts parsing layout before data arrives.
- **The shimmer sweep matters**: a static skeleton reads as broken, an animated one as in progress.
- **Match the skeleton to real content dimensions.** A skeleton that jumps to a different layout on load is worse than a spinner.
- Keep skeletons under ~2s before showing partial content. Don't mix spinners and skeletons in the same view.
- For actions the user just performed, skip loading entirely and render optimistically.

## Optimistic UI

- Update the UI **the instant the user acts**, then sync with the server in the background. Don't block on the response.
- **Roll back cleanly on failure** — undo the like, restore the count, as if it never happened.
- The bet: trust the success case, which is almost always what happens, and handle the rare failure gracefully.
- **Only for reversible, low-stakes actions** — likes, toggles, bookmarks, reorders.
- **Never** for payments, transfers, bookings, or anything you can't safely undo. Never show a charge or confirmation before the server has cleared it.

## Error States

- **Match the surface to the type and severity.** Validation errors go inline under the field; a lost connection reads as a banner or toast; a server crash or permission block earns its own prominent space. The more an error interrupts, the more space it should occupy — and the reverse.
- **Every error needs an exit.** A dead-end "OK" leaves people stuck. Offer Retry, a link to support, or expandable technical detail for those who want it.
- **Write for humans**: "Error 500 — An error occurred" says nothing. Say what broke, why, and what to do next.
- **Prevent before you report**: live inline validation, criteria turning green as rules are met, stops most mistakes before submit.
- Keep field-level errors small, inline and anchored to the input they describe — not floating in a generic alert.
- Never interrupt a minor validation slip with a full-screen modal.

## Notification System

Not one component — **four surfaces at four volumes**. The event's severity picks the surface.

| Surface | For | Persistence |
|---|---|---|
| **Toast** | low priority ("new message") | auto-dismiss in seconds; offer undo |
| **Banner** | degraded service, warnings | stays until manually cleared |
| **Modal** | blocking failures ("card declined") | blocks until the user acts |
| **Badge** | passive unread counts | sits quietly until resolved |

- **Stack behavior separates good from broken**: several toasts can stack and breathe; several modals are a trainwreck. Blocking dialogs must never queue on top of each other.
- **Over-escalation backfires.** Route everything to the loudest surface and you get zero attention, because users learn to tune the noise out.

## Toast Notifications

- **Position deliberately**: bottom-right on desktop, top edge on mobile. The screen center is off-limits — it covers the content being worked on and blocks clicks.
- **Dismiss timing follows severity**: routine info ~4s, warnings ~7s, critical errors stay until acknowledged.
- **Cap the stack at 3 visible.** Newest enters at the bottom, older float up and out, the rest queue. Spring motion keeps the shuffle readable.
- **Always give a way out**: close button on desktop, swipe-to-dismiss on mobile, and **pause the timer on hover** so people can finish reading.
- Color-code by type (info / success / warning / error) but **never color alone** — pair each with an icon and accent border, since ~6% of users can't distinguish them.

## Undo UX

- **Undo beats confirmation.** "Are you sure?" punishes everyone for one person's mistake; undo punishes nobody. The action happens instantly and regret gets a second chance.
- **Soft delete**: the item leaves the screen, not the database. Set a deleted flag, keep it in trash ~30 days, then purge. Deletion is a state, not an event.
- **Reserve heavy friction for the genuinely irreversible** — type-to-confirm (like typing a repo name) where there is no way back.
- **One undo is a toast; a stack is a time machine.** An undo stack lets Cmd+Z walk back through every step in order.
- **Delayed send turns a delay into a feature** — holding an email ~10 seconds catches the typo, the wrong recipient, the reply-all.
- **Show the countdown**: a draining ring or bar tells users exactly how long the second chance lasts. And make the window long enough to actually react.

## Zeigarnik Effect

The mind holds unfinished tasks in active memory and drops completed ones. Open loops keep pulling attention back.

- A meter stuck at **80%** creates return pressure; a checklist at 100% gives no reason to come back.
- In onboarding, **deliberately leave one box unchecked** — the visible gap nudges people to return and finish setup.
- Profile-completion meters are the everyday version big platforms rely on.
- **It only fires for outcomes the user actually wants.** A fake "reading progress" bar on a marketing email creates zero pull.
- The mechanic is a loop: open it → let it pull → bring them back.
- Use it honestly. Manufacturing progress on chores nobody asked for is noise, and closing every loop at 100% removes the pull entirely.
