import { defineConfig } from 'vitest/config'

/**
 * `?raw` sur une feuille de style, sous Vitest, rendait la chaîne vide.
 *
 * Vite traite le CSS à part, et en mode test il n'en reste rien. Le serveur
 * inline sa feuille dans la page publiée : les essais mesuraient donc des pages
 * **sans style** — la garde du § 8 sur le poids de la page de lecture annonçait
 * 2,6 Ko là où la production en fait 15. Elle ne gardait rien.
 *
 * On lit le fichier, explicitement. Un comportement implicite qui a menti une
 * fois ne mérite pas qu'on le laisse décider une seconde.
 */
export default defineConfig({
  test: {
    /*
     * Sans ça, `?raw` sur une feuille de style rend la chaîne vide.
     *
     * Vitest court-circuite le CSS par défaut — c'est le bon choix quand on
     * teste des composants, dont le style n'entre pas dans les assertions. Le
     * serveur, lui, **inline sa feuille dans la page publiée** : sans elle, les
     * essais mesuraient des pages sans style, et la garde du § 8 sur le poids
     * de la page annonçait 2,6 Ko là où la production en fait 15.
     */
    css: true,
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
      /*
       * Toute la source, y compris le serveur.
       *
       * `packages/serveur` et `packages/comptes` en étaient absents : la
       * publication, la page de lecture, le PDF, les comptes et le paiement
       * n'étaient donc comptés nulle part, et le chiffre annoncé ne parlait que
       * de la moitié du dépôt.
       */
      include: [
        'packages/engine/src/**',
        'packages/legal-cm/src/**',
        'packages/render/src/**',
        'packages/ia/src/**',
        'packages/serveur/src/**',
        'packages/comptes/src/**',
        'packages/etabli/src/**',
        'apps/web/src/**',
        'apps/etabli/src/**',
      ],
      // Le service worker s'exécute dans une portée que Vitest ne fournit pas ;
      // sa logique de cache est testée à part, dans sw-strategie.ts.
      exclude: ['apps/web/src/sw.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
