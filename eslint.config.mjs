// @ts-check
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

/**
 * Server-Module (Modular Monolith). Module dürfen andere Module ausschließlich
 * über deren öffentliche `index.ts` importieren — hier per Lint-Regel erzwungen.
 * Neue Module müssen in diese Liste aufgenommen werden.
 */
const SERVER_MODULES = ['auth', 'admin', 'workout', 'health', 'nutrition', 'sync', 'ai', 'stats'];

const moduleBoundaryZones = SERVER_MODULES.map((mod) => ({
  target: `./apps/server/src/modules/${mod}`,
  from: './apps/server/src/modules',
  // Erlaubt: öffentliche index.ts anderer Module sowie deren schema.ts
  // (Drizzle-FK-Referenzen sind Datenbank-Verweise, keine Logik-Kopplung).
  except: [
    `./${mod}`,
    ...SERVER_MODULES.filter((other) => other !== mod).flatMap((other) => [
      `./${other}/index.ts`,
      `./${other}/schema.ts`,
    ]),
  ],
  message:
    'Module kommunizieren nur über die öffentliche index.ts anderer Module, nie über deren Interna.',
}));

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/node_modules/**',
      '**/drizzle/**',
      'apps/web/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: { project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'import/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: moduleBoundaryZones },
      ],
    },
  },
  {
    // Tests dürfen Fakes/Interna anderer Module nutzen — Boundaries gelten für Laufzeitcode.
    files: ['**/__tests__/**', '**/*.test.ts'],
    rules: {
      'import/no-restricted-paths': 'off',
    },
  },
);
