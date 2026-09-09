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

## Vercel — en ligne

| | |
|---|---|
| Production | **https://atelier237.vercel.app** |
| Projet | `atelier237`, équipe `lebbuilder16-5581s-projects` |

`vercel.json` est à la racine et porte tout : commande de construction,
répertoire de sortie, en-têtes. Il n'y a rien à régler dans l'interface —
**Root Directory** reste la racine du dépôt, les paquets de `packages/` étant
compilés depuis leurs sources par Vite.

```bash
vercel deploy --prod --yes --archive=tgz
```

### Le dépôt n'est pas connecté

`vercel link` n'a pas pu rattacher `BacBacta/toolbox` : le compte Vercel n'a
pas d'accès en écriture au dépôt GitHub. Conséquence à connaître : **il n'y a
pas de déploiement automatique à chaque poussée**. Chaque mise en ligne se fait
à la main avec la commande ci-dessus. Pour l'automatiser, il faut connecter le
dépôt depuis un compte qui a les droits, dans les réglages du projet Vercel.

### Deux embûches rencontrées, et leur cause

- Le CLI Vercel emploie le `fetch` natif de Node, qui **ignore `HTTPS_PROXY`**.
  Derrière un proxy, il obtient un code d'appareil puis échoue en silence à
  l'interrogation. `NODE_USE_ENV_PROXY=1` le règle (Node ≥ 22.21).
- Sans `--archive=tgz`, l'envoi des fichiers un par un a échoué en cours de
  route. L'archive n'envoie qu'un flux, et passe.

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

Vérifié de deux façons :

- La vérification de bout en bout (`e2e/`) sert l'application avec **ces
  en-têtes exactement**, dans un vrai Chromium, et la chaîne complète passe,
  mode avion compris.
- Les en-têtes de la production ont été relevés un par un : `/assets/*`
  immuable pour un an, `sw.js` et `precache.json` à revalider, CSP appliquée
  partout, `Service-Worker-Allowed: /` sur le service worker.

Et le paquet déployé a été inspecté : aucune adresse `atl.cm` codée en dur, la
clause du lien est bien conditionnelle, et `precache.json` liste dix fichiers
**sans doublon** — la condition qui rend l'installation du service worker
possible.

## Un point d'architecture à trancher

**Le brief a choisi Cloudflare** (§ 3.2), et pas par hasard : la page de lecture,
le webhook de paiement et le proxy IA sont censés vivre au même endroit que
KV, R2 et D1 — et R2 est retenu parce qu'il n'a **pas de frais de sortie**, ce
qui est décisif quand on sert des images.

Héberger la PWA sur Vercel ne contredit aucun invariant : ce ne sont que des
fichiers statiques, et c'est réversible en une commande. Mais à la phase 2, il
faudra choisir :

- **rester chez Cloudflare pour le reste** — deux hébergeurs, deux tableaux de
  bord, un domaine à faire pointer aux deux ;
- **tout mettre chez Vercel** — ce qui revient à rejuger la section 3.2 : les
  équivalents de KV, R2 et D1 n'y ont ni la même forme, ni le même prix de
  sortie ;
- **basculer la PWA sur Cloudflare Pages** — même sortie statique, un seul
  endroit. Les en-têtes ci-dessus s'y écrivent dans un fichier `_headers` plutôt
  que dans `vercel.json`.

Rien de tout ça n'est urgent aujourd'hui. Ça le devient le jour où on écrit le
Worker.

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
