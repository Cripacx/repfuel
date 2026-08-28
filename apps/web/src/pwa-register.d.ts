// `vite-plugin-pwa/client` (das die echten Typen liefert) ist nur eine transitive
// Abhängigkeit von `@vite-pwa/sveltekit` und in pnpms strikter node_modules-Struktur
// von hier aus nicht auflösbar — daher die schmale Deklaration selbst, statt eine
// weitere Dependency nur für Typen zu ziehen.
//
// Wichtig: diese Datei darf kein Top-Level `import`/`export` haben. Ein neues
// ambientes Modul (statt einer Augmentation eines bestehenden) lässt sich laut
// TypeScript nur aus einer globalen Skript-Datei heraus deklarieren — in einer
// Modul-Datei (z. B. `app.d.ts`, das mit `export {}` endet) würde dieselbe
// Deklaration als (wirkungslose) Augmentation eines nicht existierenden Moduls
// behandelt und `import('virtual:pwa-register')` bliebe unauflösbar.
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>;
}
