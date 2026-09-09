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
| `packages/engine` | montant en toutes lettres, TVA ligne par ligne, mise en forme, validateur de schéma, numérotation continue, étage 1, trois squelettes (`devis`, `facture`, `njangi`) |
| `packages/legal-cm` | TVA 19,25 %, mentions obligatoires, formes NIU et RCCM, numérotation |
| `packages/render` | feuille A4 réelle, documents `devis` et `facture`. Le registre njangi et la carte canvas restent à faire |
| `packages/outils-test` | scanners partagés par les tests de pureté |
| `apps/web` | pas commencée |

419 tests, couverture à 97 %. Une seule dépendance de production : `preact`.

```bash
pnpm install
pnpm verif        # typecheck + tests + couverture, comme la CI
```

Les arbitrages sont journalisés dans [`docs/02-decisions.md`](docs/02-decisions.md).
