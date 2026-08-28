<script lang="ts" module>
  /**
   * Zentrales Icon-Set: ein Strichgewicht (1.75), ein 24er-Raster, runde
   * Kappen — überall dieselbe Zeichensprache statt Emoji/Textglyphen.
   * Jedes Icon ist ein einzelner Pfad (M-Subpfade), damit die Komponente
   * trivial bleibt.
   */
  export const ICON_PATHS = {
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    close: 'M6 6l12 12M18 6 6 18',
    'chevron-left': 'm14.5 6-6 6 6 6',
    'chevron-right': 'm9.5 6 6 6-6 6',
    'chevron-down': 'm6 9.5 6 6 6-6',
    'arrow-up': 'M12 19V5m-6.5 6.5L12 5l6.5 6.5',
    'arrow-down': 'M12 5v14m6.5-6.5L12 19l-6.5-6.5',
    edit: 'm15 5.5 3.5 3.5M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1Z',
    trash:
      'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12M10 11v5M14 11v5',
    dumbbell:
      'M6.5 8.5v7M4 9.5v5a1 1 0 0 0 1 1h1.5v-7H5a1 1 0 0 0-1 1ZM17.5 8.5v7M20 9.5v5a1 1 0 0 1-1 1h-1.5v-7H19a1 1 0 0 1 1 1ZM8.5 12h7',
    clipboard:
      'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM16 5.5h2a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1h2M9.5 11h5M9.5 15h5',
    book: 'M4.5 5A1.5 1.5 0 0 1 6 3.5h13.5v15H6A1.5 1.5 0 0 0 4.5 20ZM4.5 20V5M19.5 18.5v2H6',
    scale:
      'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8.5 9.5a5 5 0 0 1 7 0M12 11.5 13.5 9',
    target:
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Z',
    utensils: 'M6 4v4.5a2 2 0 0 0 4 0V4M8 4v16M16 12c-1.7 0-3-1.8-3-4s1.3-4 3-4v16',
    search: 'M10.5 4.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12ZM15 15l5 5',
    barcode: 'M4 5.5v13M8 5.5v13M11 5.5v13M14.5 5.5v13M17 5.5v13M20 5.5v13',
    bolt: 'M13 3 5 13.5h6L11 21l8-10.5h-6L13 3Z',
    clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 8v4.5l3 2',
    calendar: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM4 10h16M8 4v4M16 4v4',
    info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 11v5M12 7.5v.01',
  } as const;

  export type IconName = keyof typeof ICON_PATHS;
</script>

<script lang="ts">
  /** Dekorativ: der umgebende Button/Link trägt das Label (aria-label/Text). */
  let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={ICON_PATHS[name]} />
</svg>
