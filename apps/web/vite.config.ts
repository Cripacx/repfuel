import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

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
