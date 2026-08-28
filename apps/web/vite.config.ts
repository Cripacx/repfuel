import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Runes-Modus fürs gesamte Projekt erzwingen (Svelte 4-Kompat ist irrelevant, alles ist neu).
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },
      adapter: adapter({ fallback: 'index.html' }),
    }),
    SvelteKitPWA({
      // SPA-Modus (adapter-static, `fallback: 'index.html'`) — die Fallback-Seite muss
      // ins Precache-Manifest, damit Navigation offline funktioniert. `adapterFallback`
      // muss hier explizit stehen (nicht nur `spa: true`): das Projekt hat kein
      // svelte.config.js, aus dem @vite-pwa/sveltekit den Adapter-Namen sonst läse.
      kit: { spa: true, adapterFallback: 'index.html' },
      registerType: 'autoUpdate',
      // Manuelle Registrierung nur im Browser (kein SSR, siehe `+layout.svelte`) —
      // kein Auto-Inject-Script in app.html.
      injectRegister: false,
      manifest: {
        name: 'repfuel',
        short_name: 'repfuel',
        description: 'Selbst gehostetes Workout- & Ernährungs-Tracking.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#121417',
        theme_color: '#121417',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App-Shell precachen (Standard-Workbox-Glob von vite-pwa reicht — Build-Output).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Navigation offline aus dem Cache — außer API-Requests, die beantwortet der
        // Dexie-Fallback in den Seiten selbst, nicht der Service Worker (siehe
        // `src/lib/offline/`). Ohne Denylist würde der SW jede fehlgeschlagene
        // /api/*-Navigation ebenfalls auf index.html umleiten.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // API-Antworten nie im SW cachen (kein `runtimeCaching` für /api/*) — die
        // Offline-Sync-Queue ist die einzige Daten-Fallback-Quelle.
        runtimeCaching: [],
      },
      devOptions: {
        // Im Dev-Modus keinen SW registrieren — vermeidet stale Caches während der
        // Entwicklung; die Dexie-/Sync-Logik lässt sich unabhängig davon testen.
        enabled: false,
      },
    }),
  ],
  server: {
    proxy: {
      // Backend läuft in Dev separat auf :8080 (siehe IMPLEMENTIERUNGSPROMPT.md).
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    expect: { requireAssertions: true },
  },
});
