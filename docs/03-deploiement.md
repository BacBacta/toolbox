# Déploiement

## Ce qui se déploie, et ce qui ne se déploie pas encore

Ce qui part sur l'hébergeur, c'est **la PWA** : des fichiers statiques, un
service worker, rien d'autre. Pas de serveur, pas de base, pas de secret.
L'état vit sur le téléphone.

La publication existe **côté serveur** : `POST /api/publier` dépose un
instantané dans KV, `GET /d/:lien` rend la page de lecture. Ce qui manque
encore, c'est le geste dans l'application — le bouton « Diffuser » produit
toujours la carte et le résumé et **n'écrit aucun lien**. Une adresse inventée
serait un lien mort envoyé par le trésorier à ses membres, sous son nom.

L'`og:image` attend R2, qui demande une activation manuelle dans le tableau de
bord Cloudflare. En attendant, l'aperçu WhatsApp porte le titre et la
description tirés de la carte, pas l'image.

## Cloudflare Pages — en ligne

| | |
|---|---|
| Production | **https://atelier237.pages.dev** — en ligne depuis le 9 septembre 2026 |
| Projet | `atelier237` |

`wrangler.toml` est à la racine et nomme le projet ; `apps/web/public/_headers`
porte les en-têtes, et Vite le copie tel quel dans `dist/`. Il n'y a rien à
régler dans l'interface.

```bash
pnpm build
npx wrangler pages deploy apps/web/dist --project-name atelier237
```

`wrangler` n'est pas une dépendance du dépôt : il ne sert qu'à mettre en ligne,
et `npx` le prend au vol. La première fois, il faut s'authentifier —
`npx wrangler login` ouvre un navigateur. Sans navigateur (intégration
continue, machine distante), c'est un jeton :

```bash
export CLOUDFLARE_API_TOKEN=…   # droits « Cloudflare Pages : Edit »
export CLOUDFLARE_ACCOUNT_ID=…
```

Le jeton se crée dans le tableau de bord Cloudflare, et **n'entre jamais dans
le dépôt**.

Les fonctions vivent dans `functions/` : `functions/api/ai.js` répond sur
`/api/ai`. Elles partent avec le même déploiement que les fichiers statiques —
c'est tout l'intérêt d'un seul projet.

### Pourquoi Cloudflare, et pas là où c'était déjà

L'atelier a d'abord tourné sur Vercel, parce que la PWA y était déployée en une
commande. Le brief, lui, avait choisi Cloudflare (§ 3.2), et pour une raison
qui n'est pas de goût : **R2 n'a pas de frais de sortie**. Or ce qu'on sert le
plus, ce sont les cartes PNG — l'aperçu WhatsApp *est* le tableau de bord, et
chaque carte partagée est une image téléchargée par le crawler puis par les
lecteurs. Facturer cette bande passante, c'est facturer l'usage normal du
produit.

Deux hébergeurs auraient voulu dire deux tableaux de bord, deux commandes de
mise en ligne et un domaine à faire pointer aux deux. La page de lecture, le
webhook de paiement et le proxy IA ont besoin des mêmes liaisons KV, R2 et D1 :
ils vivent au même endroit.

### Ce que le déménagement a coûté

Trois fichiers, et pas une décision.

- `packages/ia/src/fonction.ts` ne connaissait déjà pas son hébergeur : il
  fallait seulement lui passer ses réglages en argument au lieu de les lire
  dans `process.env`. **Un Worker n'a pas de `process`** — les lire au
  chargement du module aurait marché sur Vercel et rendu partout `undefined`
  ici, sans que rien n'échoue. Une garde du budget refuse désormais un
  `process.env` dans le paquet déployé.
- `packages/ia/src/worker.ts` est le nouvel adaptateur : trente lignes qui
  lisent un `Request` et rendent un `Response`. C'est tout ce que le proxy sait
  de Cloudflare.
- Les en-têtes sont passés de `vercel.json` à `_headers`. Ils ne sont plus
  recopiés dans les vérifications de bout en bout : `e2e/entetes.mjs` **lit le
  fichier qui part en ligne**. Deux copies d'une même règle divergent toujours,
  et celle qui compte est celle du serveur.

### La branche de production décide de tout, y compris des variables

Un projet Pages en envoi direct attache chaque déploiement à un **nom de
branche**, et n'en promeut qu'un en production : celui dont la branche est la
`production_branch` du projet. Les autres sont des préversions.

Ça compte parce que **les variables d'environnement sont posées par
environnement**. Une clef posée en production n'existe pas dans une préversion,
et la fonction y répond « pas encore ouvert » — exactement comme si la clef
n'avait jamais été posée. On cherche alors un problème de secret là où il n'y
en a pas.

C'est arrivé : `--production-branch main` à la création n'a pas tenu, la
`production_branch` valait la branche de travail, et trois déploiements
`--branch main` sont partis en préversion sans que rien ne le dise. La commande
répondait « Deployment complete », le domaine servait bien l'application — mais
c'était un déploiement plus ancien.

La `production_branch` a été remise à `main`, `main` existe dans le dépôt, et
la mise en ligne se fait avec `--branch main`. Les trois doivent rester
d'accord : c'est leur désaccord qui envoie un déploiement en préversion sans
le dire.

À vérifier d'un coup d'œil quand quelque chose ne prend pas :

```bash
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/atelier237" \
| node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const p=JSON.parse(d).result;
    console.log('branche de production :', p.production_branch);
    console.log('dernier déploiement   :', p.latest_deployment.environment);});"
```

`environment: preview` sur le dernier déploiement veut dire que le domaine sert
autre chose que ce qu'on vient d'envoyer.

### Deux embûches, dont une qui a cassé le mode avion

**Pages redirige `/index.html` vers `/` en 308.** Le service worker le
préchargeait : `addAll` suit la redirection, obtient une réponse marquée
`redirected`, et `Cache.put` la refuse. L'installation échouait en entier, sans
un mot dans la console — le déploiement, lui, réussissait. La coquille se range
désormais sous `/`, qui sert les mêmes octets et ne redirige pas, et le serveur
des vérifications de bout en bout **reproduit la redirection** : il servait le
fichier directement, et laissait donc passer exactement ce qui casse en
production.

C'est la deuxième fois que le préchargement se casse de cette façon. La
première, `index.html` figurait deux fois dans la liste et `addAll` rejetait sur
le doublon. Même symptôme, même silence : retenir que **toute panne
d'installation du service worker est muette**, et qu'elle ne se voit qu'en
ouvrant l'application hors ligne.

**Sans `--archive=tgz`, l'envoi Vercel des fichiers un par un échouait** en
cours de route. `wrangler` envoie une archive par défaut ; le problème ne se
repose pas.

### Les en-têtes, et pourquoi ils comptent

| Chemin | Cache | Raison |
|---|---|---|
| `/assets/*` | un an, `immutable` | Les noms portent une empreinte : un fichier donné ne change jamais. |
| `/sw.js` | `max-age=0, must-revalidate` | Un service worker mis en cache, c'est une application figée dans une version qu'on ne peut plus corriger. |
| `/precache.json` | `max-age=0, must-revalidate` | Il liste les empreintes du moment ; périmé, il ferait précharger des fichiers disparus. |
| `/index.html` | `max-age=0, must-revalidate` | Il pointe vers les empreintes courantes. |

La **CSP** est stricte parce qu'elle peut l'être : l'application ne charge rien
de l'extérieur — aucune police web, aucune bibliothèque de graphiques, aucune
balise tierce. `default-src 'self'`, et `object-src`, `base-uri`, `form-action`
et `frame-ancestors` fermés. C'est l'invariant § 2.1 tenu jusqu'au serveur.

La vérification de bout en bout (`e2e/`) sert l'application avec **ces en-têtes
exactement** — elle les lit dans `_headers` — dans un vrai Chromium, et la
chaîne complète passe, mode avion compris.

## Les comptes, les crédits et le paiement

| | |
|---|---|
| `GET /api/compte` | plan, crédits, échéance |
| `POST /api/compte/code` | un code de récupération, montré **une fois** |
| `POST /api/compte/reprendre` | rattache cet appareil au compte d'un code |
| `POST /api/pay/demarrer` | ouvre un paiement, rend un identifiant de suivi |
| `GET /api/pay/:id` | où il en est |
| `POST /api/pay/rappel` | le fournisseur, **signature vérifiée** |
| D1 | liaison `COMPTES`, base `atelier237-comptes` |

Le schéma vit dans `packages/comptes/migrations/`. Il s'applique à la main —
`wrangler d1 execute COMPTES --remote --file=…` — parce qu'une migration
automatique au déploiement voudrait dire qu'un déploiement raté peut casser la
base des comptes.

**Personne ne s'inscrit.** L'appareil tire un jeton de cent vingt-huit bits au
premier lancement et le garde ; le serveur ne le voit qu'au premier appel qui
coûte quelque chose, et lui ouvre un compte à ce moment-là. Il ne range jamais
le jeton, seulement son empreinte : une copie de la base ne distribue pas
d'identités. Le numéro de téléphone n'apparaît qu'au premier paiement.

**Deux plans.** Un essai de cinq compositions, puis **deux mille francs**
— le prix du § 1 — pour trente jours et quarante compositions. Un abonnement échu ne fait rien perdre : les
outils vivent sur le téléphone et les publications restent en ligne, seule
s'arrête la composition. Payer en avance prolonge au lieu de remplacer.

**Le crédit se réserve avant l'appel**, avec la condition dans la requête SQL
et non autour d'elle : deux requêtes simultanées d'un compte à qui il en reste
un passeraient toutes deux un contrôle fait en JavaScript. Un appel qui
n'atteint jamais le modèle rend son crédit.

**Le code de récupération fait seize lettres** dans l'alphabet des liens, se
dit au téléphone et n'est montré qu'une fois. Le brief demandait argon2 ; cette
exigence répond à un mot de passe choisi par quelqu'un, quelques dizaines de
bits qu'un dérivateur lent rend coûteux à essayer. Un code tiré par la machine
sur quatre-vingts bits n'a pas ce défaut, et un SHA-256 n'ajoute aucune
dépendance au plafond du § 8.

### Le fournisseur de paiement

`A237_PAIEMENT_SECRET` signe les rappels, et **sans lui `/api/pay` ne s'ouvre
pas** : on ne saurait pas distinguer le fournisseur de n'importe qui. Il se
pose comme la clef du modèle, avec `wrangler pages secret put`, et n'entre
jamais dans le dépôt.

**Un secret posé ne rejoint pas le déploiement en cours.** Pages attache ses
variables au projet et les applique **à la construction** : après un
`secret put`, il faut redéployer, sinon les fonctions continuent de tourner
avec l'environnement d'avant. Le symptôme est trompeur — `/api/pay` répond 503
« le paiement n'est pas encore ouvert » exactement comme si le secret manquait.
C'est le même piège que celui de la branche de production, et il se
diagnostique de la même façon : par le comportement du déploiement, pas par
l'état de la configuration.

Le seul fournisseur d'aujourd'hui n'encaisse rien. Ouvrir un compte marchand
CamPay ou Fapshi demande des pièces et du délai (§ 7, phase 0), et rien de ce
qui s'écrit autour du paiement n'avait besoin d'attendre ça. Il **signe
vraiment** ses rappels, en HMAC-SHA256 du corps exact : un faux qui répondrait
« oui » à tout n'éprouverait pas la seule chose qui compte ici.

Ce qu'il reste à faire le jour où un vrai fournisseur arrive : écrire un
`Fournisseur` de plus — `demarrer` et `lireRappel` —, poser son secret, et le
choisir dans `fournisseurChoisi`. Rien d'autre ne bouge : le rejeu, le montant
partiel, la transaction et l'idempotence sont déjà éprouvés.

### Deux verrous contre le rejeu

`UNIQUE(fournisseur, reference)` dans la base, et un paiement qui n'est plus en
attente ne se retranche pas. Il en faut deux : les fournisseurs réessaient
quand ils n'ont pas vu notre 200, et sans le second, trois rappels identiques
donneraient quatre-vingt-dix jours. Le montant se revérifie même signé — un
fournisseur peut accepter un versement partiel.

Un rappel qu'on ne reconnaît pas reçoit **200 et non 404** : un fournisseur qui
reçoit une erreur réessaie en boucle.

## Le PDF

| | |
|---|---|
| `GET /p/:lien` | le document, en PDF |
| Browser Run | liaison `NAVIGATEUR` |

Le brief prévoyait un service Playwright sur un petit VPS (§ 7, phase 5).
Cloudflare rend le même service par une liaison — `quickAction('pdf', …)` —
sans second hébergeur à tenir, à mettre à jour et à surveiller, et **sans aucun
paquet** : ni `puppeteer`, ni jeton d'API. Le support sur Pages n'est pas
documenté ; il a été éprouvé en production plutôt que supposé.

Le rendu se fait **une fois, sur le serveur**, et c'est tout l'intérêt : le
fichier porte ses glyphes, et la machine qui l'ouvre n'a plus rien à décider.
Un `window.print()` sur le téléphone du client donnerait autant de PDF
différents que de navigateurs. Mesuré sur les sept écrits A4 : une page,
210 × 297 mm, trois polices embarquées.

La police est **nommée** et non devinée. À l'écran, `system-ui` est le bon
choix — c'est la police que le téléphone a déjà. Sur le serveur, `system-ui`
est ce que l'image du jour contient, et le jour où elle change, tous les devis
changeraient d'allure sans que personne ait rien demandé.

### Le débit, qui décide du plan

Le plan gratuit admet **une impression toutes les dix secondes pour tout le
compte**, et dix minutes de navigateur par jour — deux à trois cents feuilles.
C'est assez pour commencer, et ce n'est pas assez pour deux clients qui
impriment en même temps : le second reçoit « L'impression est occupée ».

Le plan payant (5 $/mois) monte à trente par seconde et dix heures par mois
incluses, puis 0,09 $ l'heure — environ **0,05 F CFA la feuille**.

`quickAction` **avale le 429** : il rend une poignée d'octets qui ne sont pas
un PDF, sans lever d'exception. C'est la vérification de la signature `%PDF-`,
et elle seule, qui distingue une limitation d'un fichier valable. Sans elle, le
Worker renvoyait ces octets étiquetés `application/pdf`.

## Ce qui reste à vérifier à la main

Le navigateur de l'environnement de développement ne peut pas atteindre
l'internet public : le proxy de session coupe ses connexions, pour n'importe
quel hôte. Les scénarios de `e2e/` tournent donc contre un serveur local — le
vrai Worker et son KV, mais servi ici. La production, elle, se vérifie par
requêtes : ses en-têtes, le contenu de son paquet, et la chaîne de publication
jouée de bout en bout par `fetch` — dépôt, lecture, refus.

Ce qui reste, et qui compte plus que tout le reste :

1. **Ouvrir l'adresse sur un vrai téléphone Android**, l'installer depuis
   Chrome, couper les données, et rouvrir. C'est le critère d'arrêt de la
   phase 1, et aucune machine de développement ne le remplace.
2. **Vérifier que `navigator.share({files})` ouvre bien WhatsApp** — la
   section 6 du brief insiste : sur les téléphones que les utilisateurs ont
   vraiment, pas seulement sur le tien.
3. **Recevoir un lien dans WhatsApp et l'ouvrir**, dans le navigateur intégré
   de WhatsApp et non dans Chrome : c'est là que la page publiée sera lue, et
   c'est le seul endroit qui dira si l'aperçu s'affiche vraiment.
4. **Faire imprimer un devis chez un imprimeur de quartier.** C'est la seconde
   moitié du critère de la phase 5, et elle ne se vérifie pas d'ici : le PDF
   est identique partout — une page, A4, polices embarquées, tout se mesure —
   mais qu'il sorte sans surprise d'une machine de Douala demande du papier.

## La publication

| | |
|---|---|
| `POST /api/publier` | dépose `{ lien, instantane }` dans KV |
| `GET /d/:lien` | rend la page de lecture, sans un script |
| `PUT /c/:lien.png` | dépose la carte, dessinée sur le téléphone |
| `GET /c/:lien.png` | la sert, immuable pour un an |
| KV | liaison `INSTANTANES` |
| R2 | liaison `CARTES`, seau `atelier237-cartes` |

Le lien fait **douze caractères** en base32 sans `I`, `1`, `O`, `0` ni `U` :
il se lit à voix haute au téléphone et se recopie sur un cahier. Le prototype
en proposait quatre — un million de combinaisons, énumérable en une soirée, sur
des documents qui portent un nom de client et des montants.

**Deux outils ne se publient pas** : l'ardoise, qui porte des noms et des
dettes (§ 2.5), et le call-box, qui dit la recette du jour. Le refus est dans
le serveur et non seulement dans l'écran : un bouton grisé se contourne, une
adresse publique ne se reprend pas.

La page de lecture rend **le vrai document** pour les sept écrits A4 — c'est
tout l'intérêt du lien, ouvrir un devis plutôt que recevoir une image qu'on ne
peut ni chercher ni copier. Les registres rendent leur carte : on ne rejoue pas
un écran à boutons en lecture seule.

Un **outil composé par le modèle** n'a pas de squelette : sa configuration
voyage avec lui, dans l'instantané, et c'est elle qui dit comment le dessiner.
Les deux fabriques qui la remontent en squelette vivent dans le moteur
(`squeletteDeRegistre`, `squeletteDeCalcul`), d'où l'écran et le serveur les
tirent toutes les deux. Tant qu'elles n'étaient que du côté de l'écran, le
serveur ne trouvait rien à dessiner et la page répondait 200 avec « Ce lien ne
mène à rien » : **l'outil payé était le seul qu'on ne pouvait pas partager.**

### Ce que le dépôt refuse

`/api/publier` est une adresse publique : ce qui écrit dedans n'est pas
seulement le client d'aujourd'hui, mais aussi une version plus ancienne, une
file d'attente qui rejoue, ou n'importe qui avec `curl`. Chaque refus a sa
raison, que l'écran peut afficher.

| | | |
|---|---|---|
| 400 | `lien-invalide` | la forme du lien, avant de toucher au stockage |
| 400 | `instantane-absent` | le corps n'est pas un dépôt |
| 400 | `squelette-inconnu` | publié par une version que ce serveur ne connaît pas |
| 400 | `instantane-illisible` | l'état ne se dessine pas — voir plus bas |
| 403 | `non-publiable` | l'ardoise et le call-box, avec le pourquoi |
| 409 | `version-perimee` | le serveur détient plus récent, **et le dit** |

`version-perimee` porte `versionServeur` : sans elle, un téléphone dont la
file rejoue une vieille publication perd son travail en silence. Et **zéro est
une version** — un outil qu'on vient de créer est en version 0, ce qui est le
cas le plus courant puisqu'on diffuse souvent juste après avoir créé.

`instantane-illisible` est le dernier contrôle, et il coûte un rendu : le
serveur **essaie de dessiner** avant d'accepter. C'est la seule vérification
qui ne puisse pas diverger du rendu, puisque c'est le rendu ; un schéma recopié
côté serveur finirait par ne plus dire la même chose que l'écran. Le refus
appartient à la publication parce que l'envoyeur est là pour l'entendre — sans
lui, le rendu jetait à la lecture et c'est le destinataire qui découvrait la
page d'erreur de l'hébergeur, devant un lien qu'on lui avait donné.

Le contrôle ferme la porte devant ; il ne réécrit pas ce qui est déjà dans KV.
La page de lecture ne jette donc plus non plus : un dépôt qu'elle ne sait pas
dessiner donne une page qui le dit, **distincte de l'introuvable** — le lien
est bon, ce n'est pas la peine d'aller le revérifier.

### Le poids de la page

La feuille de style est **inlinée** — une feuille séparée serait une requête de
plus sur une connexion qui hoquette — mais sans ses commentaires : ils faisaient
vingt-neuf pour cent de la page, six kilo-octets que le destinataire d'un devis
télécharge sans jamais les lire. Une page de devis fait **quinze kilo-octets,
moins de quatre comprimée**. Rien à charger après le premier octet : la page est
finie quand elle arrive.

### La file d'attente

Le réseau ne sert qu'à publier, payer et appeler le modèle — trois choses qui
peuvent attendre (§ 2.7). « Diffuser » sans réseau dépose donc la demande dans
une file, et la carte part quand même, sans adresse : l'écran dit pourquoi.

`viderLaFile` la vide **au lancement et au retour du réseau**, sans rien
afficher : la publication est une conséquence de « Diffuser », pas une tâche
que l'utilisateur suit. Ce qui change, c'est que l'outil a désormais son
adresse.

Elle rejoue **l'état d'aujourd'hui**, et non celui du jour où la publication a
été mise en attente : quelqu'un qui a continué de travailler hors ligne veut
voir partir son carnet tel qu'il est. L'entrée de file ne dit donc qu'une
chose — cet outil attend d'être publié. Un verrou empêche les deux
déclencheurs de se marcher dessus, les entrées d'un même outil sont regroupées,
et un refus ou un conflit retire l'entrée au lieu de la rejouer sans fin :
réessayer n'y changerait rien.

### La carte et l'aperçu

La carte est **dessinée sur le téléphone** et téléversée telle quelle (§ 1,
point 6). Le serveur n'a ni police, ni canvas, ni la moindre raison d'apprendre
à dessiner : il range un octet et le rend. Elle part **après** le dépôt, jamais
avec lui — une image en base64 dans du JSON coûte un tiers de sa taille en
plus, et la page de lecture fonctionne sans elle.

`og:image` n'est annoncée **que si la carte existe** : la page demande à R2 si
elle est là. Une `og:image` qui rend 404 fait un aperçu cassé, ce qui est pire
qu'un aperçu sobre — il donne l'air d'un lien douteux.

Le seau n'est pas ouvert au monde : les cartes passent par une route de ce
domaine, ce qui garde l'aperçu et la page sur la même origine. Et seule une
vraie image y entre : on vérifie la **signature** du fichier et non l'en-tête
annoncé, qui est déclaratif. Sans ce contrôle, l'adresse deviendrait un
hébergement de fichiers sous notre nom.

### Trois pièges du rendu serveur

**Le nom du fichier est la route.** `functions/d/[lien].js` répond à
`/d/n'importe quoi`. Rollup assainit les crochets d'un nom de sortie : le
fichier sortait `_lien_.js`, qui ne répond qu'à `/d/_lien_`. Toutes les pages
auraient rendu 404, et la construction aurait réussi. Une garde du budget exige
le nom exact, et refuse tout fichier de `functions/` qui ne soit pas une route
attendue — un fragment partagé déposé dans `functions/assets/` deviendrait une
route `/assets/…` qui masquerait les vrais fichiers de l'application.

**Un `https://` écrit en dur.** L'adresse absolue sert à `og:url` et
`og:image`, que WhatsApp suit telles quelles. Bâtie sur un schéma supposé, elle
est fausse partout où le schéma diffère — à commencer par le serveur local, où
l'on éprouve justement la chaîne complète. L'origine vient de la requête.

**`min(1, calc((100vw - 32px) / 793.7))` est invalide.** Diviser une longueur
par un nombre rend une longueur, et `min` refuse de mélanger un nombre et une
longueur : la déclaration est ignorée sans un mot, l'échelle retombe à 1, et le
document sort à sa taille réelle — coupé par le cadre sur un téléphone. Le
diviseur porte son unité : `793.7px`.

## Où poser les variables — deux familles à ne pas confondre

Il y a deux sortes de variables, elles ne vivent pas au même endroit, et les
mélanger est la façon la plus simple de mettre une clef dans un dépôt.

**Les identifiants de mise en ligne** — `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`. Elles ne servent qu'à *déployer* ; l'application ne
les lit jamais et Cloudflare ne les stocke pas pour elle. Elles vivent là où la
commande de déploiement s'exécute, et nulle part ailleurs.

| D'où tu déploies | Ce qu'il faut |
|---|---|
| Ton ordinateur | **Rien.** `npx wrangler login` ouvre un navigateur et retient l'autorisation. C'est le chemin le plus simple, et aucun jeton ne circule. |
| Une machine sans navigateur | Les deux variables, exportées dans le terminal le temps de la commande. |
| GitHub Actions | Les deux, en *secrets du dépôt* — jamais dans un fichier du dépôt. |

**Les réglages de l'application** — les `A237_*`. Elles se posent dans le
projet Pages, et c'est délibéré : `A237_MODELE` doit pouvoir changer **sans
redéployer**, le jour où les prix bougent ou qu'un modèle plus fidèle au schéma
apparaît. Les mettre dans `wrangler.toml` les figerait dans une construction.

Dans le tableau de bord : *Workers & Pages* → le projet `atelier237` →
*Settings* → les variables d'environnement. Deux détails qui se paient cher :

- **Production et Preview sont deux jeux séparés.** Une variable posée pour la
  production ne s'applique pas aux déploiements de préversion, et le proxy y
  répondra « pas encore ouvert » sans que rien ne semble cassé.
- **`A237_CLEF_IA` se pose comme secret**, pas comme variable : un secret ne se
  relit pas dans l'interface une fois posé. En ligne de commande :
  `npx wrangler pages secret put A237_CLEF_IA --project-name atelier237`.

## Ouvrir la composition par le modèle

Cinq variables, posées comme la section précédente le dit : la clef en secret,
les quatre autres en variables du projet.

| Variable | Rôle | Défaut |
|---|---|---|
| `A237_CLEF_IA` | La clef du fournisseur. | — |
| `A237_IA_OUVERTE` | `1` ouvre le service. **Rien d'autre ne l'ouvre.** | fermé |
| `A237_FOURNISSEUR` | `openrouter` ou `gemini`. | `openrouter` |
| `A237_MODELE` | L'identifiant du modèle chez le fournisseur. | `google/gemini-2.5-flash-lite` |
| `A237_TAUX_FCFA` | Taux FCFA par dollar, pour le journal des coûts. | `600` |

Deux gestes et non un : poser la clef n'ouvre pas le robinet. Tant que les
comptes de D1 n'existent pas, il n'y a pas de quota, et un proxy ouvert sans
quota est un service payant offert à qui passe.

### Choisir le modèle

Le brief pose un **budget** — moins d'un franc la génération (§ 8) — et non une
marque. Pour une génération d'étage 2 (~1 500 jetons en entrée, ~500 en
sortie), au taux de 600 F le dollar, avec les prix relevés sur OpenRouter le
9 septembre 2026 :

| Modèle | Entrée / sortie par million | Une génération |
|---|---|---|
| `google/gemini-2.5-flash-lite` | 0,10 $ / 0,40 $ | **0,21 F** |
| `google/gemini-3.1-flash-lite` | 0,25 $ / 1,50 $ | 0,68 F |
| `google/gemini-3.5-flash-lite` | 0,30 $ / 2,50 $ | 1,02 F — hors budget |

Le défaut suit le brief. Le 3.1 tient encore le budget avec un tiers de marge,
et une reprise coûte un tour de plus : un modèle qui se trompe moins peut
revenir moins cher qu'un modèle moins cher. Ça se mesure — le coût réel de
chaque appel est journalisé, et c'est celui qu'OpenRouter facture, pas notre
estimation.

Changer de modèle ne demande pas de redéploiement : la variable suffit.

### Dix générations réelles, mesurées le 9 septembre 2026

Le critère d'arrêt de la phase 4 (§ 8). Modèle `google/gemini-2.5-flash-lite`
via OpenRouter, taux 600 F le dollar.

| | |
|---|---|
| Réussites | **10 / 10** |
| Coût moyen | **0,121 FCFA** par génération |
| Budget du brief | < 1 FCFA — tenu, avec huit fois de marge |
| Latence médiane | 1,16 s |

Le coût affiché est celui qu'**OpenRouter facture**, pas une estimation : il
remonte dans `usage.cost` et l'emporte sur notre table de prix.

Deux échecs sur les premières séries venaient de règles à nous, pas du modèle :
une clef en `nom_poule` refusée sans raison, et l'exigence qu'une première
colonne soit du texte — qui rendait « combien d'œufs par jour et combien
vendus » inexprimable. Les deux ont été levées.

Une deuxième série, après avoir donné au modèle le droit de refuser : toujours
10/10, 0,137 FCFA de moyenne. L'invite est plus longue de deux schémas, d'où
les seize millièmes de franc supplémentaires — et un refus coûte 0,08 F, moins
qu'un registre, parce qu'il est plus court à écrire.

Ce qui manque encore au critère : le chemin « plus de crédits » (402), qui
suppose les comptes de D1.

### Consommation à l'appel

La clef OpenRouter est du prépayé : chaque génération débite son solde, et la
facturation vient du routeur, pas d'une estimation (`usage.cost`).

Trois conséquences dans le code.

Le **402** d'OpenRouter — plus de crédit — est traduit en 402 par le proxy et
non en panne. L'écran dit de recharger, sans proposer de réessayer, et rappelle
que les outils déjà créés continuent de marcher : l'étage 1 ne coûte rien et
couvre l'essentiel.

Le **coût de chaque composition s'affiche** sur l'outil qu'elle vient d'ouvrir.

Le **plafond se règle chez OpenRouter**, pas ici : une limite de crédit posée
sur la clef borne la dépense, quoi qu'il arrive côté application. C'est le seul
garde-fou disponible tant que les comptes de D1 n'existent pas — il est global
et non par utilisateur, donc le premier venu peut l'épuiser pour tout le monde.
Raison de plus pour le poser bas.
