<script lang="ts">
  /**
   * Quadratisches Vorschaubild einer Übung. Fällt bei fehlendem `mediaUrl` (custom
   * Übungen) oder Ladefehler (kaputte wger-URL) auf ein neutrales Hantel-Icon zurück,
   * statt ein leeres/kaputtes Bild zu zeigen. Wird überall eingebunden, wo Übungen in
   * Listen oder Abschnitts-Headern auftauchen (Picker, Routine-Editor, Workout-Logging).
   *
   * `alt` ist standardmäßig dekorativ (leer), weil der Übungsname an allen Einbaustellen
   * bereits als sichtbarer Text direkt daneben steht — bei Standalone-Nutzung ohne
   * begleitenden Text den Übungsnamen explizit übergeben.
   */
  let {
    mediaUrl,
    name,
    size = 44,
    alt = '',
  }: {
    mediaUrl: string | null;
    name: string;
    size?: number;
    alt?: string;
  } = $props();

  // Merkt sich nur die konkret fehlgeschlagene URL statt eines reinen Booleans, damit ein
  // Prop-Wechsel (Liste neu gerendert mit anderer Übung an derselben Stelle) automatisch
  // einen neuen Ladeversuch auslöst, ohne einen Effekt zum Zurücksetzen zu brauchen.
  let failedUrl = $state<string | null>(null);

  const showImage = $derived(mediaUrl !== null && mediaUrl !== failedUrl);
</script>

<span class="exercise-thumb" style={`--exercise-thumb-size: ${size}px;`}>
  {#if showImage}
    <img src={mediaUrl} {alt} loading="lazy" onerror={() => (failedUrl = mediaUrl)} />
  {:else}
    <svg
      class="exercise-thumb-fallback"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      role="img"
      aria-label={alt || name}
    >
      {#if !alt}
        <title>{name}</title>
      {/if}
      <path
        d="M6.5 8.5v7M4 9.5v5a1 1 0 0 0 1 1h1.5v-7H5a1 1 0 0 0-1 1ZM17.5 8.5v7M20 9.5v5a1 1 0 0 1-1 1h-1.5v-7H19a1 1 0 0 1 1 1ZM8.5 12h7"
      />
    </svg>
  {/if}
</span>

<style>
  .exercise-thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--exercise-thumb-size);
    height: var(--exercise-thumb-size);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
  }

  .exercise-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .exercise-thumb-fallback {
    width: 55%;
    height: 55%;
    color: var(--color-text-muted);
  }
</style>
