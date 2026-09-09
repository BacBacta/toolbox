# Vérification de bout en bout

`fumee.mjs` ouvre l'application **construite** dans un vrai Chromium, sur un
écran de 360 × 740 avec le tactile, et vérifie la chaîne complète : recherche
par mots-clés, création d'un carnet de njangi, ajout de membres, versement,
dessin de la carte, lien de relance `wa.me`, service worker, et **mode avion**.

## Pourquoi elle existe, alors qu'il y a 700 tests unitaires

Elle a trouvé un bogue qu'aucun d'eux ne pouvait voir : `precache.json`
contenait `/index.html` deux fois, `cache.addAll` rejette sur les doublons, et
l'installation du service worker échouait **sans un mot**. L'application
marchait parfaitement — sauf hors ligne, c'est-à-dire là où elle doit marcher.

happy-dom ne fournit ni canvas, ni service worker, ni cache : ce que cette
vérification couvre, aucun test unitaire ne le couvrira jamais.

## L'exécuter

Playwright n'est pas une dépendance du dépôt — la suite complète arrive en
phase 2, avec le Worker et la page de lecture. En attendant :

```bash
pnpm build
mkdir -p /tmp/e2e && cd /tmp/e2e && npm install playwright-core --no-save
cd /tmp/e2e && node /chemin/vers/atelier237/e2e/fumee.mjs
```

Le navigateur est celui de l'environnement (`/opt/pw-browsers`) ; le chemin est
en dur en haut du script, à ajuster selon la machine.

## Ce qu'elle ne remplace pas

Un vrai téléphone. La section 6 du brief demande de vérifier que
`navigator.share({files})` ouvre bien WhatsApp **sur les téléphones que les
utilisateurs ont vraiment**, pas seulement sur le sien. Chromium sur un poste de
développement n'en dit rien.
