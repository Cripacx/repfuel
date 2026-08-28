<script lang="ts">
  import { EXERCISE_MEDIA_ATTRIBUTION_URL } from '@repfuel/shared';
  import { m } from '$lib/i18n/index.js';

  /**
   * Bewegungsablauf einer Übung im aktiven Workout. Ruhezustand ist das Standbild;
   * erst auf Tap wird die Animation geladen und läuft. Das hält die Logging-Ansicht
   * ruhig (mehrere Abschnitte gleichzeitig sichtbar) und spart Daten im Studio —
   * die GIFs sind ~100 KB pro Übung, das Standbild ~6 KB.
   *
   * Rendert nichts, wenn keine Medien vorliegen (eigene Übungen, wger-Altbestand
   * ohne Bild) — bewusst kein Platzhalter, der Platz ohne Information belegt.
   *
   * Das Bild ist dekorativ (alt=""): der Übungsname steht als Überschrift direkt
   * darüber. Der Zustand steckt im Button (Beschriftung + aria-pressed).
   *
   * Die Medien gehören Gym visual; die Attribution ist Lizenzbedingung und darf
   * nicht entfernt werden (siehe apps/server/src/modules/workout/seed/README.md).
   * Native Auflösung ist 180×180, deshalb wird nicht hochskaliert.
   */
  let {
    mediaUrl,
    gifUrl,
  }: {
    mediaUrl: string | null;
    gifUrl: string | null;
  } = $props();

  let playing = $state(false);

  // Beim Wechsel auf eine andere Übung (gleiche Position, neue Props) zurück auf
  // das Standbild, damit nicht die Animation der Vorgänger-Übung stehen bleibt.
  $effect(() => {
    void gifUrl;
    playing = false;
  });
</script>

{#if mediaUrl && gifUrl}
  <figure class="exercise-animation">
    <button
      type="button"
      class="exercise-animation-frame"
      onclick={() => (playing = !playing)}
      aria-pressed={playing}
    >
      <img
        src={playing ? gifUrl : mediaUrl}
        alt=""
        width="180"
        height="180"
        loading="lazy"
        decoding="async"
      />
      <span class="exercise-animation-hint">
        {playing ? m().exercises.animationPause : m().exercises.animationPlay}
      </span>
    </button>
    <figcaption>
      <a href={EXERCISE_MEDIA_ATTRIBUTION_URL} target="_blank" rel="external noreferrer noopener">
        © Gym visual
      </a>
    </figcaption>
  </figure>
{/if}

<style>
  .exercise-animation {
    margin: 0 0 var(--space-3);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }

  /* Der Rahmen ist der Play/Pause-Schalter — Button statt div, damit Tastatur und
     Screenreader denselben Zustand bekommen wie der Tap. */
  .exercise-animation-frame {
    position: relative;
    display: block;
    /* 180px ist die native Auflösung der Medien; größer wäre hochskaliert. */
    width: 180px;
    max-width: 100%;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--surface-2);
    cursor: pointer;
    transition: border-color var(--dur-fast) var(--ease-out);
  }

  .exercise-animation-frame:hover {
    border-color: var(--border-strong);
  }

  .exercise-animation-frame img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    object-fit: cover;
  }

  /* Liegt über dem Bild statt daneben: die Fläche ist der Schalter, der Hinweis
     benennt nur, was ein Tap tut. */
  .exercise-animation-hint {
    position: absolute;
    inset: auto 0 0;
    padding: var(--space-2);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text);
    text-align: center;
    background: linear-gradient(to top, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0));
  }

  .exercise-animation figcaption {
    font-size: var(--text-xs);
    color: var(--text-faint);
  }

  .exercise-animation figcaption a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .exercise-animation figcaption a:hover {
    color: var(--text-muted);
  }
</style>
