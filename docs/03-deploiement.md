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

## Vercel

`vercel.json` est à la racine et porte tout : commande de construction,
répertoire de sortie, en-têtes.

```bash
npx vercel link          # une fois, pour rattacher le dépôt au projet
npx vercel --prod        # déploie
```

Depuis l'interface, il n'y a rien à régler à la main : **Root Directory** reste
la racine du dépôt (les paquets de `packages/` sont compilés depuis leurs
sources par Vite), et `vercel.json` fournit le reste.

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

Vérifié : la vérification de bout en bout (`e2e/`) sert l'application avec
**ces en-têtes exactement**, dans un vrai Chromium, et la chaîne complète passe,
mode avion compris.

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

## Ce qu'un déploiement ne prouve pas

La section 6 du brief demande de vérifier sur de vrais téléphones que
`navigator.share({files})` ouvre bien WhatsApp — « pas seulement sur le tien ».
Un déploiement rend ça vérifiable ; il ne le vérifie pas.
