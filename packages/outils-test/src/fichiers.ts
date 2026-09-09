import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Tous les fichiers TypeScript sous un dossier, récursivement. */
export function fichiersSources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    return /\.tsx?$/.test(chemin) ? [chemin] : []
  })
}
