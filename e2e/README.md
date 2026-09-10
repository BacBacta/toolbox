# Vérification de bout en bout

Sept scripts, sept choses qu'aucun test unitaire ne peut voir.

`fumee.mjs` ouvre l'application **construite** dans un vrai Chromium, sur un
écran de 360 × 740 avec le tactile, et vérifie la chaîne complète : recherche
par mots-clés, création d'un carnet de njangi, ajout de membres, versement,
dessin de la carte, lien de relance `wa.me`, service worker, et **mode avion**.

`agent.mjs` suit une **conversation** du premier mot tapé jusqu'au lien reçu :
le flux traverse le réseau coupé à des endroits quelconques, l'aperçu se
redessine à chaque morceau, la configuration traverse le stockage, du code
écrit à la main la dessine, et elle repart au serveur pour devenir une page.
Il éprouve surtout ce que la conversation apporte et qu'un bouton n'avait pas :
un **deuxième tour** qui modifie l'outil déjà fait, avec son laissez-passer,
sans reprendre de crédit. Et le refus, qui se dit dans la fenêtre sans y
proposer d'ouvrir quoi que ce soit. Il lui faut le Worker et son KV.

`formulaire.mjs` suit le seul parcours du produit où **deux personnes**
interviennent : celle qui fabrique le formulaire et le partage, et celle qui le
remplit sans avoir jamais ouvert l'application, sans compte, et — c'est le
point — **avec le JavaScript coupé**. Le navigateur poste un `<form>` tout
seul ; c'est la seule façon que ça marche dans le navigateur intégré de
WhatsApp, sur un téléphone d'entrée de gamme. Il vérifie aussi ce qui n'arrive
pas : le robot qui remplit le champ piège, le doublon envoyé coup sur coup, et
l'appareil qui essaie de lire les réponses d'un autre. Il lui faut le Worker,
son KV et sa base D1 — migrations comprises.

`hors-ligne.mjs` joue la boucle du § 2.7 en entier : on coupe le réseau, on
crée un outil, on demande à le diffuser, et on regarde la file partir **toute
seule** quand le réseau revient. Il lui faut le Worker et son KV, donc un vrai
serveur : `wrangler pages dev`.

`comptes.mjs` joue un compte, un abonnement et un rappel rejoué, en requêtes et
sans navigateur. Le § 7 fait de l'idempotence le critère d'arrêt de la phase 3 ;
les essais unitaires le prouvent sur la logique et sur la base, celui-ci sur la
chaîne entière — le Worker, sa liaison D1, la vérification de signature, et le
compte tel que l'écran le lit ensuite.

`pdf.mjs` lit le fichier produit, et non le fait qu'il en sorte un. Une page
de 210 × 297 mm qui **porte ses polices** n'a plus rien à décider au moment de
l'ouverture : c'est la moitié du critère de la phase 5 qui se mesure. L'autre
moitié — « un imprimeur de quartier l'imprime sans surprise » — demande du
papier.

`mise-a-jour.mjs` joue le scénario de la **deuxième** mise en ligne : il
construit une version, l'installe dans le navigateur, construit une version
modifiée, la met en ligne, et vérifie que l'utilisateur qui rouvre
l'application voit la nouvelle — sans rien faire, et sans perdre le mode
avion.

## Pourquoi elles existent, alors qu'il y a 1 525 tests unitaires

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

`compose.mjs` a trouvé le pire des trois, et c'est le dernier maillon qui l'a
révélé : la configuration d'un outil composé voyage avec lui au lieu de vivre
dans un squelette, et le serveur, qui ne connaissait que les squelettes, ne
trouvait rien à dessiner derrière le lien. La page répondait **200 avec « Ce
lien ne mène à rien »** — le destinataire allait vérifier une adresse qui était
juste, et l'envoyeur ne savait pas qu'il y avait un problème, puisque sa
publication avait répondu 200. **L'outil payé était le seul qu'on ne pouvait pas
partager.** Les deux fabriques vivent depuis dans le moteur, d'où l'écran et le
serveur les tirent toutes les deux ; le statut ne suffisait pas à voir le
défaut, il fallait lire la page.

`hors-ligne.mjs` en a trouvé un troisième, du même genre : `creerOutil` pose
`version: 0`, et le serveur exigeait une version supérieure ou égale à 1.
Publier un outil **qu'on vient de créer** — le cas normal, puisqu'on diffuse
souvent juste après avoir créé — recevait un 409, la file abandonnait l'entrée,
et l'utilisateur n'apprenait rien. Les mille cinq cent vingt-cinq tests
passaient : ils composent leurs propres états, où la version n'est jamais zéro.

Le même script garde un piège que rien d'autre ne voit : le service worker
servait la coquille de l'application pour `/d/…`. Le destinataire d'un lien,
s'il avait l'application installée, voyait l'accueil au lieu du document — et
l'envoyeur n'en savait rien. D'où la vérification sur « Document en lecture
seule », une chaîne que seule la page publiée porte.

happy-dom ne fournit ni canvas, ni service worker, ni cache : ce que ces
vérifications couvrent, aucun test unitaire ne le couvrira jamais.

## L'exécuter

Playwright n'est pas une dépendance du dépôt : le § 8 plafonne les dépendances
de production, et ces scripts se lancent à la main, depuis un dossier où
`playwright-core` est installé.

```bash
mkdir -p /tmp/e2e && cd /tmp/e2e && npm install playwright-core --no-save
export PLAYWRIGHT=/tmp/e2e/node_modules/playwright-core/index.mjs

pnpm build
node e2e/fumee.mjs

# mise-a-jour.mjs construit lui-même, deux fois : il se lance depuis le dépôt.
node e2e/mise-a-jour.mjs

# compose.mjs et hors-ligne.mjs ont besoin du Worker et de son KV : un serveur,
# dans un autre terminal, puis les scripts. BASE change l'adresse si le port
# est déjà pris.
wrangler pages dev --port 8798 --ip 127.0.0.1
node e2e/compose.mjs
node e2e/hors-ligne.mjs

# comptes.mjs a besoin en plus du secret de paiement et de la base migrée.
printf 'A237_PAIEMENT_SECRET=secret-local-essai\n' > .dev.vars
wrangler d1 execute COMPTES --local --file=packages/comptes/migrations/0001-comptes.sql
WRANGLER=/chemin/vers/wrangler node e2e/comptes.mjs

# pdf.mjs a besoin de Browser Run, qui n'existe pas en développement local :
# il vise la production par défaut. `quickAction` demande `--remote` sinon.
node e2e/pdf.mjs
```

Chacun sort en code 1 s'il échoue : ils s'enchaînent avec `&&`.

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
