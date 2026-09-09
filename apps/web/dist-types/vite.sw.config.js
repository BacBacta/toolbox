import { defineConfig } from 'vite';
/**
 * Le service worker se bâtit à part : ce n'est pas un module de l'application,
 * c'est un programme qui vit à côté d'elle, dans sa propre portée.
 *
 * Écrit à la main, sans Workbox — qui pèse plus que l'application (invariant
 * § 2.6, et le tableau de la section 3.2 du brief le dit explicitement).
 */
export default defineConfig({
    build: {
        target: 'es2020',
        emptyOutDir: false,
        rollupOptions: {
            input: 'src/sw.ts',
            output: { entryFileNames: 'sw.js', format: 'es' },
        },
    },
});
