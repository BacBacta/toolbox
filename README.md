# Atelier 237

Générateur d'outils de gestion pour le Cameroun : documents A4 conformes au droit
camerounais et registres interactifs, utilisables hors ligne sur Android d'entrée
de gamme, diffusés dans WhatsApp.

- **La spécification, c'est [`BRIEF.md`](BRIEF.md).** Les invariants de la section 2
  ne se négocient pas. Toute proposition qui les contredit est mauvaise, même si
  elle est techniquement plus élégante.
- **Le prototype de référence** est dans [`reference/atelier-prototype.html`](reference/atelier-prototype.html).
  C'est une spécification exécutable, pas une base de code : on le porte, on ne le
  copie pas. Il ne doit jamais être importé par du code de production.
- Les notes de lecture et les décisions ouvertes sont dans [`docs/`](docs/).

## État

**Phases 0 à 5 faites.** Le catalogue est complet, la publication et le paiement
sont en ligne, le modèle compose, et les documents A4 sortent en PDF. Reste la
phase 6 : le terrain.

Ce que le modèle sait composer — **quatre formes**, et le choix entre elles se
fait sur la demande, pas sur un menu :

| Ce qu'on demande | Ce qu'on reçoit |
|---|---|
| « je veux suivre mes livraisons » | un **registre** : des colonnes, un total, une carte à partager |
| « ma marge sur chaque vente » | une **calculatrice** : quelques champs, une formule déclarée |
| « je veux un site internet » | une **page** publiée derrière un lien, sans un octet de script — et avec un menu quand il y a plusieurs sujets, ce qui est tout ce qu'« un site » ajoute à « une page » |
| « une invitation pour mon mariage » | la même page, **datée** : elle dit d'elle-même « dans 3 jours », et s'éteint quand c'est passé |
| « savoir qui vient et ce qu'il apporte » | un **formulaire** qui reçoit : un vrai `<form method="post">`, rempli sans JavaScript, dont les réponses reviennent dans l'application |

Le formulaire est la seule chose du produit qui accepte une écriture venue de
l'extérieur. Trois choses tiennent la porte ouverte sans la laisser fracturer —
un champ piège dans la page, un délai entre deux envois du même endroit, un
plafond par formulaire — et aucune ne demande rien au visiteur.

| Paquet | Ce qu'il fait |
|---|---|
| `packages/engine` | le cœur pur : montants, dates de Douala, validateur de schéma, **dix-sept squelettes**, et les contrats de ce que le modèle a le droit de composer |
| `packages/legal-cm` | TVA 19,25 %, mentions obligatoires, formes NIU et RCCM |
| `packages/render` | la feuille A4, les sept écrits, les registres, la vitrine, le formulaire public, la carte partagée en canvas |
| `packages/serveur` | la page de lecture, le dépôt, le PDF, et la seule route qui reçoit |
| `packages/comptes` | les comptes, le quota, le paiement, les réponses reçues — tout ce qui touche à D1 |
| `packages/ia` | le proxy du modèle : la clef ne quitte jamais le serveur |
| `apps/web` | la PWA : atelier, outils, diffusion, service worker |
| `e2e` | sept vérifications dans un vrai navigateur, mode avion et JavaScript coupé compris |

1 959 tests, couverture à 95,7 % (branches 90,2 %). Coquille initiale :
**30,9 Ko gzip** pour un plafond de 120, et elle ne grossit pas avec les outils —
chacun vit dans son fragment. Deux dépendances tierces de production :
`preact` et `idb-keyval`.

Une génération coûte **0,86 F au pire cas** pour un plafond d'un franc (§ 8), et
de l'ordre de 0,36 F au premier tour, qui est le cas courant.

En ligne sur **https://atelier237.pages.dev**, et vérifié sur un vrai
téléphone : l'application s'ouvre **données coupées**, et « Partager la carte »
**ouvre WhatsApp avec l'image**.

```bash
pnpm install
pnpm dev          # l'application, en développement
pnpm verif        # typecheck + tests + couverture + construction + budgets
```

Les budgets de la section 8 du brief ne se surveillent pas à l'œil : ils font
échouer la CI. Voir [`e2e/README.md`](e2e/README.md) pour la vérification dans
un vrai navigateur.

Les arbitrages sont journalisés dans [`docs/02-decisions.md`](docs/02-decisions.md).
