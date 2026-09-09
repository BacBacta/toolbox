# Vérification de bout en bout

Deux scripts, deux choses qu'aucun test unitaire ne peut voir.

`fumee.mjs` ouvre l'application **construite** dans un vrai Chromium, sur un
écran de 360 × 740 avec le tactile, et vérifie la chaîne complète : recherche
par mots-clés, création d'un carnet de njangi, ajout de membres, versement,
dessin de la carte, lien de relance `wa.me`, service worker, et **mode avion**.

`compose.mjs` ouvre un registre **composé par le modèle** dans un vrai
navigateur : la configuration vient du réseau, traverse le stockage, et c'est
`RegistreListe` — écrit à la main — qui la dessine. La réponse est une vraie
sortie de production capturée telle quelle, pas une réponse inventée : sa
première colonne est de type `nombre`, ce qui a longtemps été interdit.

`mise-a-jour.mjs` joue le scénario de la **deuxième** mise en ligne : il
construit une version, l'installe dans le navigateur, construit une version
modifiée, la met en ligne, et vérifie que l'utilisateur qui rouvre
l'application voit la nouvelle — sans rien faire, et sans perdre le mode
avion.

## Pourquoi elles existent, alors qu'il y a 939 tests unitaires

`fumee.mjs` a trouvé un bogue qu'aucun d'eux ne pouvait voir : `precache.json`
contenait `/index.html` deux fois, `cache.addAll` rejette sur les doublons, et
l'installation du service worker échouait **sans un mot**. L'application
marchait parfaitement — sauf hors ligne, c'est-à-dire là où elle doit marcher.

`mise-a-jour.mjs` en a trouvé un pire, et c'est un utilisateur qui l'a signalé
le premier : le service worker portait une version écrite en dur, donc `sw.js`
était identique d'une construction à l'autre. Le navigateur ne le réinstallait
jamais, ne purgeait jamais son cache, et servait indéfiniment la coquille d'une
version précédente — celle qui nomme tous les autres fichiers. **L'application
ne pouvait plus se mettre à jour chez quiconque l'avait ouverte une fois.** Les
neuf cent trente-neuf tests passaient : ils ne construisent qu'une seule fois.

Le même script a ensuite rattrapé un correctif trop zélé. Rafraîchir la
coquille dans le cache courant y laissait une coquille neuve réclamant des
fichiers que ce cache n'avait pas : le mode avion tombait. La mise à jour se
fait donc là où elle est atomique — la réinstallation du service worker.

happy-dom ne fournit ni canvas, ni service worker, ni cache : ce que ces
vérifications couvrent, aucun test unitaire ne le couvrira jamais.

## L'exécuter

Playwright n'est pas une dépendance du dépôt — la suite complète arrive en
phase 2, avec le Worker et la page de lecture. En attendant :

```bash
pnpm build
PLAYWRIGHT=/tmp/e2e/node_modules/playwright-core/index.mjs node e2e/compose.mjs
mkdir -p /tmp/e2e && cd /tmp/e2e && npm install playwright-core --no-save
cd /tmp/e2e && node /chemin/vers/atelier237/e2e/fumee.mjs

# mise-a-jour.mjs construit lui-même, deux fois : il se lance depuis le dépôt.
PLAYWRIGHT=/tmp/e2e/node_modules/playwright-core/index.mjs node e2e/mise-a-jour.mjs
```

Le navigateur est celui de l'environnement (`/opt/pw-browsers`) ; son chemin se
passe par `CHROME`, sinon celui de cet environnement est pris par défaut.

`mise-a-jour.mjs` écrit dans `apps/web/src/app.css` le temps de l'essai et le
restaure avec `git checkout` : ne pas le lancer avec des changements non
enregistrés dans ce fichier.

## Ce qu'elle ne remplace pas

Un vrai téléphone. La section 6 du brief demande de vérifier que
`navigator.share({files})` ouvre bien WhatsApp **sur les téléphones que les
utilisateurs ont vraiment**, pas seulement sur le sien. Chromium sur un poste de
développement n'en dit rien.
