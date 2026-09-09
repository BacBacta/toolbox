/// <reference lib="webworker" />
import { cachesAPurger, fichiersAPrecacher, nomCache, strategiePour } from './sw-strategie.js'

/**
 * Le service worker, écrit à la main.
 *
 * Workbox pèse plus que l'application (BRIEF.md § 3.2) ; ce qu'il fait de plus
 * ne sert à rien ici. Toute la logique de décision est dans `sw-strategie.ts`,
 * testée ; ce fichier n'est que la plomberie que Vitest ne peut pas exécuter.
 *
 * `precache.json` est écrit à la construction par un greffon de `vite.config.ts`
 * et liste toute l'application, fragments d'outils compris. C'est ce qui permet
 * d'ouvrir n'importe quel outil en mode avion après une seule visite.
 */

declare const self: ServiceWorkerGlobalScope

const VERSION = '1'
const CACHE = nomCache(VERSION)
const COQUILLE = '/index.html'

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const reponse = await fetch('/precache.json', { cache: 'no-cache' })
      const fichiers = (await reponse.json()) as string[]
      // Redédoublonné ici aussi : un precache.json écrit par une version plus
      // ancienne de la construction ferait échouer l'installation sans un mot.
      await cache.addAll(fichiersAPrecacher(fichiers))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    (async () => {
      const noms = await caches.keys()
      await Promise.all(cachesAPurger(noms, CACHE).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request
  const strategie = strategiePour(
    {
      methode: requete.method,
      mode: requete.mode,
      url: requete.url,
      destination: requete.destination,
    },
    self.location.origin,
  )
  if (strategie === 'reseau') return

  evenement.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)

      if (strategie === 'coquille') {
        const coquille = await cache.match(COQUILLE)
        if (coquille !== undefined) return coquille
        return fetch(requete)
      }

      const enCache = await cache.match(requete)
      const duReseau = fetch(requete)
        .then(async (reponse) => {
          if (reponse.ok) await cache.put(requete, reponse.clone())
          return reponse
        })
        .catch(() => undefined)

      if (enCache !== undefined) return enCache
      const reponse = await duReseau
      if (reponse !== undefined) return reponse
      throw new Error('hors ligne et absent du cache')
    })(),
  )
})
