import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
/**
 * Le service worker se bâtit à part : ce n'est pas un module de l'application,
 * c'est un programme qui vit à côté d'elle, dans sa propre portée.
 *
 * Écrit à la main, sans Workbox — qui pèse plus que l'application (invariant
 * § 2.6, et le tableau de la section 3.2 du brief le dit explicitement).
 */
/**
 * L'empreinte de la construction, injectée dans le service worker.
 *
 * Le navigateur ne réinstalle un service worker que si son fichier a changé
 * d'un octet. Avec une version écrite en dur, `sw.js` était identique d'une
 * construction à l'autre : aucune réinstallation, donc aucune purge du cache,
 * donc la coquille d'il y a trois semaines servie indéfiniment — et comme
 * c'est elle qui nomme tous les autres fichiers, l'application ne pouvait
 * plus jamais se mettre à jour chez quelqu'un qui l'avait ouverte une fois.
 *
 * `precache.json` liste les fichiers émis, dont le nom porte déjà l'empreinte
 * de leur contenu. Le hacher change donc dès qu'un octet de l'application
 * change, et ne change pas quand rien n'a bougé : pas de réinstallation
 * gratuite, pas de mise à jour manquée.
 */
function empreinteDuBuild() {
    const liste = fileURLToPath(new URL('./dist/precache.json', import.meta.url));
    let contenu;
    try {
        contenu = readFileSync(liste, 'utf8');
    }
    catch {
        // Se rabattre sur une constante ramènerait exactement le défaut qu'on
        // corrige ici, et sans un mot. On s'arrête.
        throw new Error('dist/precache.json est absent : construis l’application avant le service worker.');
    }
    return createHash('sha256').update(contenu).digest('hex').slice(0, 12);
}
export default defineConfig({
    define: { __EMPREINTE__: JSON.stringify(empreinteDuBuild()) },
    build: {
        target: 'es2020',
        emptyOutDir: false,
        rollupOptions: {
            input: 'src/sw.ts',
            output: { entryFileNames: 'sw.js', format: 'es' },
        },
    },
});
