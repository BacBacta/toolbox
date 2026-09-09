import { defineConfig } from 'vite'

/**
 * Le proxy IA, assemblé en un seul fichier JavaScript pour `api/ai.js`.
 *
 * Vercel compile lui-même le TypeScript qu'il trouve dans `api/`, avec sa
 * propre résolution de modules : elle ne suit pas les liens d'un espace de
 * travail pnpm, et la fonction plantait au démarrage sans que la construction
 * échoue. On ne lui donne donc plus que du JavaScript, tout inclus, sans un
 * seul import à résoudre — la même solution que pour le service worker, et
 * pour la même raison.
 *
 * **`ssr` n'est pas un détail.** En mode navigateur, Vite remplace
 * `process.env` par un objet vide : la fonction se serait déployée sans jamais
 * pouvoir lire sa clef, et aurait répondu « pas encore ouvert » pour toujours,
 * sans que rien n'échoue. Le mode SSR vise Node et laisse `process` tranquille.
 *
 * `noExternal: true` fait entrer les paquets de l'espace de travail dans le
 * fichier ; `preserveEntrySignatures` garde l'export par défaut, que Rollup
 * élaguait — un fichier de quarante octets s'était déployé sans que personne
 * ne s'en aperçoive.
 */
export default defineConfig({
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'src/fonction.ts',
    target: 'node20',
    emptyOutDir: false,
    outDir: '../../api',
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: 'ai.js', format: 'es' },
    },
  },
})
