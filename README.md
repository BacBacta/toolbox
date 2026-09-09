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

**Phase 1, moteur — en cours.** Le cœur pur est écrit et testé ; le rendu n'a pas
commencé, conformément au point 4 de la section 11 du brief.

| Paquet | État |
|---|---|
| `packages/engine` | montant en toutes lettres, TVA ligne par ligne, mise en forme, validateur de schéma, numérotation continue, étage 1, **neuf squelettes sur dix-sept** — dont six qui ne sont que de la configuration |
| `packages/legal-cm` | TVA 19,25 %, mentions obligatoires, formes NIU et RCCM, numérotation |
| `packages/render` | feuille A4 réelle, documents `devis` et `facture`, registre njangi, écran générique de liste, calculatrice, carte partagée en canvas |
| `packages/outils-test` | scanners partagés par les tests de pureté |
| `apps/web` | la PWA : accueil, stockage IndexedDB, formulaire dressé à partir du schéma, diffusion, service worker |
| `e2e` | une vérification dans un vrai navigateur, mode avion compris |

853 tests, couverture à 96 %. Coquille initiale : **14,9 Ko gzip** pour un
plafond de 120 — et elle ne grossira pas avec les huit squelettes restants,
chacun vivant dans son propre fragment. Deux dépendances tierces de production :
`preact` et `idb-keyval`.

Écrits : devis, facture, carnet de njangi, liste de prix, livre de caisse,
inventaire, clients, frais scolaires, partage de course. Restent : CV,
attestation, reconnaissance de dette, lettre de motivation, reçu, ardoise
clients, feuille de présence, call-box.

En ligne sur **https://atelier237.pages.dev**, et vérifié sur un vrai
téléphone : l'application s'ouvre **données coupées**, et « Partager la carte »
**ouvre WhatsApp avec l'image**. Cette dernière était le préalable posé par la
section 6 du brief.

```bash
pnpm install
pnpm dev          # l'application, en développement
pnpm verif        # typecheck + tests + couverture + construction + budgets
```

Les budgets de la section 8 du brief ne se surveillent pas à l'œil : ils font
échouer la CI. Voir [`e2e/README.md`](e2e/README.md) pour la vérification dans
un vrai navigateur.

Les arbitrages sont journalisés dans [`docs/02-decisions.md`](docs/02-decisions.md).
