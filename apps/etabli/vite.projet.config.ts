import { mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

const SORTIE = 'functions/api/p'

/**
 * `GET` et `PUT /api/p/:lien`, assemblés en un fichier.
 *
 * Pages tire ses routes du **nom des fichiers** : `api/p/[lien].js` répond à
 * `/api/p/n'importe quoi` et donne le segment dans `params.lien`. Or Rollup
 * assainit les crochets d'un nom de sortie — le fichier sortirait `_lien_.js`,
 * qui ne répondrait qu'à `/api/p/_lien_`. Le dépôt aurait alors rendu 404
 * partout, et la construction, elle, aurait réussi. Même piège que la page de
 * lecture de l'atelier, même parade : on sort sous un nom neutre et on le remet
 * en place après coup.
 *
 * Ces fonctions vivent sous `apps/etabli/`, et surtout pas dans le `functions/`
 * de la racine : celui-là appartient à l'atelier, et les mélanger a déjà mis
 * les liaisons de l'atelier — dont la base des comptes — sur le projet de
 * l'Établi.
 */
export default defineConfig({
  ssr: { noExternal: true, target: 'webworker' },
  build: {
    ssr: 'src/worker-projet.ts',
    target: 'es2022',
    emptyOutDir: false,
    outDir: SORTIE,
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: 'projet.js', format: 'es', inlineDynamicImports: true },
    },
  },
  plugins: [
    {
      name: 'etabli-nom-de-route',
      closeBundle() {
        mkdirSync(SORTIE, { recursive: true })
        renameSync(join(SORTIE, 'projet.js'), join(SORTIE, '[lien].js'))
      },
    },
  ],
})
