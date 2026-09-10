import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
export default defineConfig({
    plugins: [preact()],
    build: {
        // Chrome sur Android d'entrée de gamme, comme l'atelier.
        target: 'es2020',
        modulePreload: { polyfill: false },
        cssCodeSplit: true,
        assetsInlineLimit: 2048,
    },
});
