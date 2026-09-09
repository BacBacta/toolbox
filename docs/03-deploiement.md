# Déploiement

## Ce qui se déploie, et ce qui ne se déploie pas encore

Ce qui part sur l'hébergeur, c'est **la PWA** : des fichiers statiques, un
service worker, rien d'autre. Pas de serveur, pas de base, pas de secret.
L'état vit sur le téléphone.

La publication — lien court, `og:image`, page de lecture sans script, carte dans
R2, instantané dans KV — **n'existe pas encore**. C'est la phase 2. Tant qu'elle
n'existe pas, le bouton « Diffuser » produit la carte et le résumé, et
**n'écrit aucun lien** : ni sur l'image, ni dans les relances. Une adresse
inventée serait un lien mort envoyé par le trésorier à ses membres, sous son nom.

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

## Ce qui reste à vérifier à la main

Le navigateur de l'environnement de développement ne peut pas atteindre
l'internet public : le proxy de session coupe toutes ses connexions, pour
n'importe quel hôte. La production a donc été vérifiée par ses en-têtes et par
le contenu de son paquet, pas en la pilotant depuis un navigateur d'ici.

Ce qui reste, et qui compte plus que tout le reste :

1. **Ouvrir l'adresse sur un vrai téléphone Android**, l'installer depuis
   Chrome, couper les données, et rouvrir. C'est le critère d'arrêt de la
   phase 1, et aucune machine de développement ne le remplace.
2. **Vérifier que `navigator.share({files})` ouvre bien WhatsApp** — la
   section 6 du brief insiste : sur les téléphones que les utilisateurs ont
   vraiment, pas seulement sur le tien.
3. Se rappeler que **la publication n'existe pas encore** : la carte se partage,
   mais le lien viendra avec la phase 2.

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
