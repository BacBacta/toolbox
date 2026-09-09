import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Le JSX est celui de Preact, pas de React : 4 Ko de runtime au lieu de 40.
    // Le réglage vient des tsconfig (jsx: react-jsx, jsxImportSource: preact) —
    // le transformeur de Vitest les lit. Le redire ici ne ferait que diverger.
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.tsx',
      'apps/*/test/**/*.test.ts',
      'apps/*/test/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'packages/engine/src/**',
        'packages/legal-cm/src/**',
        'packages/render/src/**',
        'packages/ia/src/**',
        'apps/web/src/**',
      ],
      // Le service worker s'exécute dans une portée que Vitest ne fournit pas ;
      // sa logique de cache est testée à part, dans sw-strategie.ts.
      exclude: ['apps/web/src/sw.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
