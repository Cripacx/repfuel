<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Swipe-to-delete-Zeile (Listen-Muster wie in iOS/Hevy): nach links ziehen
   * legt einen Löschen-Button frei. Der Inhalt folgt dem Finger 1:1, hinter
   * der Aktionsbreite mit Rubber-Band; Loslassen snappt offen/zu (Schwelle
   * oder Momentum). Ein Tap auf den offenen Inhalt schließt nur.
   *
   * Für Hover-Geräte rendert der Aufrufer zusätzlich eine sichtbare
   * Lösch-Schaltfläche im Inhalt — die Geste ist Ergänzung, kein einziger Weg.
   */
  let {
    onDelete,
    deleteLabel,
    children,
  }: {
    onDelete: () => void;
    deleteLabel: string;
    children: Snippet;
  } = $props();

  const ACTION_WIDTH = 88;
  const DRAG_THRESHOLD = 8;
  /** px/ms nach links, ab der ein kurzer Wisch trotzdem öffnet. */
  const FLING_VELOCITY = 0.35;

  let offset = $state(0);
  let dragging = $state(false);
  let suppressClick = false;

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let baseOffset = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let decided = false;

  function rubberBand(raw: number): number {
    if (raw > 0) return raw / 3;
    if (raw < -ACTION_WIDTH) return -ACTION_WIDTH + (raw + ACTION_WIDTH) / 3;
    return raw;
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastX = event.clientX;
    lastTime = event.timeStamp;
    baseOffset = offset;
    velocity = 0;
    decided = false;
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!dragging) {
      if (decided) return;
      if (Math.abs(dy) > DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        // Vertikale Absicht: Scrollen gewinnt, diese Geste ist raus.
        decided = true;
        pointerId = null;
        return;
      }
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        dragging = true;
        decided = true;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } else {
        return;
      }
    }

    const dt = event.timeStamp - lastTime;
    if (dt > 0) velocity = (event.clientX - lastX) / dt;
    lastX = event.clientX;
    lastTime = event.timeStamp;
    offset = rubberBand(baseOffset + dx);
  }

  function settle(): void {
    const open = offset < -ACTION_WIDTH / 2 || (offset < -DRAG_THRESHOLD && velocity < -FLING_VELOCITY);
    offset = open ? -ACTION_WIDTH : 0;
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (dragging) {
      dragging = false;
      suppressClick = true;
      settle();
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (dragging) {
      dragging = false;
      settle();
    }
  }

  function onClickCapture(event: MouseEvent): void {
    if (suppressClick) {
      // Der Klick am Ende eines Drags darf nicht navigieren.
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (offset !== 0) {
      // Offene Zeile: erster Tap schließt nur.
      event.preventDefault();
      event.stopPropagation();
      offset = 0;
    }
  }

  function handleDelete(): void {
    offset = 0;
    onDelete();
  }
</script>

<div class="swipe-row">
  <div class="swipe-row-action" class:revealed={offset < -DRAG_THRESHOLD} aria-hidden={offset === 0}>
    <button type="button" class="swipe-row-delete" tabindex={offset === 0 ? -1 : 0} onclick={handleDelete}>
      {deleteLabel}
    </button>
  </div>
  <!-- Reine Gesten-Fläche; Löschen bleibt über fokussierbare Buttons erreichbar. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="swipe-row-content"
    class:dragging
    style:transform={`translate3d(${offset}px, 0, 0)`}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerCancel}
    onclickcapture={onClickCapture}
  >
    {@render children()}
  </div>
</div>
