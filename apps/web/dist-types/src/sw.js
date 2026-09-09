/// <reference lib="webworker" />
import { cachesAPurger, fichiersAPrecacher, nomCache, strategiePour } from './sw-strategie.js';
const VERSION = '1';
const CACHE = nomCache(VERSION);
const COQUILLE = '/index.html';
self.addEventListener('install', (evenement) => {
    evenement.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        const reponse = await fetch('/precache.json', { cache: 'no-cache' });
        const fichiers = (await reponse.json());
        // Redédoublonné ici aussi : un precache.json écrit par une version plus
        // ancienne de la construction ferait échouer l'installation sans un mot.
        await cache.addAll(fichiersAPrecacher(fichiers));
        await self.skipWaiting();
    })());
});
self.addEventListener('activate', (evenement) => {
    evenement.waitUntil((async () => {
        const noms = await caches.keys();
        await Promise.all(cachesAPurger(noms, CACHE).map((n) => caches.delete(n)));
        await self.clients.claim();
    })());
});
self.addEventListener('fetch', (evenement) => {
    const requete = evenement.request;
    const strategie = strategiePour({
        methode: requete.method,
        mode: requete.mode,
        url: requete.url,
        destination: requete.destination,
    }, self.location.origin);
    if (strategie === 'reseau')
        return;
    evenement.respondWith((async () => {
        const cache = await caches.open(CACHE);
        if (strategie === 'coquille') {
            const coquille = await cache.match(COQUILLE);
            if (coquille !== undefined)
                return coquille;
            return fetch(requete);
        }
        const enCache = await cache.match(requete);
        const duReseau = fetch(requete)
            .then(async (reponse) => {
            if (reponse.ok)
                await cache.put(requete, reponse.clone());
            return reponse;
        })
            .catch(() => undefined);
        if (enCache !== undefined)
            return enCache;
        const reponse = await duReseau;
        if (reponse !== undefined)
            return reponse;
        throw new Error('hors ligne et absent du cache');
    })());
});
