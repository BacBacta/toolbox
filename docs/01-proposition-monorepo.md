# Proposition — arborescence, configurations, et découpage de la phase 1

> **Statut : en attente de validation.** Aucun de ces fichiers n'est écrit sur le
> disque. Section 11 du brief, étape 2 : « Propose l'arborescence exacte du monorepo
> et le contenu des package.json, tsconfig et de la configuration Vite. Attends ma
> validation. »

---

## 1. Racine du dépôt

Le brief dessine un dossier `atelier237/`. Le dépôt s'appelle `toolbox` et il est
vide : je propose de **faire du dépôt lui-même la racine du projet**, sans dossier
`atelier237/` intermédiaire. Un niveau de moins dans tous les chemins, et rien à
gagner à imbriquer un seul projet.

## 2. Arborescence

```
.
├── BRIEF.md                          la spécification
├── README.md
├── package.json                      espace de travail pnpm, scripts racine
├── pnpm-workspace.yaml
├── tsconfig.base.json                réglages partagés, strict
├── vitest.config.ts                  un seul lancement pour tout le dépôt
├── .github/workflows/ci.yml          tests + typecheck + budgets, bloquants
├── scripts/
│   ├── budget.mjs                    mesure le poids gzip, sort en erreur au-delà
│   └── deps.mjs                      refuse plus de 5 dépendances dans apps/web
├── docs/                             notes de lecture, décisions ouvertes
├── reference/
│   └── atelier-prototype.html        lecture seule, jamais importé
│
├── packages/
│   ├── engine/                       ← PHASE 1, cœur pur, zéro DOM
│   │   ├── package.json
│   │   ├── tsconfig.json             lib: ES2022 SANS "DOM"
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts              Skeleton, ToolState, CardSpec, ShareSpec
│   │   │   ├── format.ts             nf(), dates longues/courtes, XAF
│   │   │   ├── lettres.ts            montant en toutes lettres (français)
│   │   │   ├── cardspec.ts           état d'un outil -> CardSpec
│   │   │   ├── match.ts              étage 1 : mots-clés -> squelette
│   │   │   ├── schema/
│   │   │   │   ├── index.ts
│   │   │   │   ├── njangi.ts
│   │   │   │   └── devis.ts
│   │   │   ├── compute/
│   │   │   │   ├── tva.ts            19,25 %, ligne par ligne puis bloc
│   │   │   │   ├── njangi.ts         collecte, fiabilité, prochain tour
│   │   │   │   └── devis.ts          totaux, acompte
│   │   │   └── skeletons/
│   │   │       ├── index.ts          registre des squelettes
│   │   │       ├── njangi.ts
│   │   │       └── devis.ts
│   │   └── test/
│   │       ├── lettres.test.ts       0, 71, 80, 81, 91, 100, 1e6, 2 100 000
│   │       ├── tva.test.ts           cas limites et arrondis
│   │       ├── njangi.test.ts
│   │       ├── devis.test.ts
│   │       ├── schema.test.ts        sorties de modèle valides ET invalides
│   │       └── purete.test.ts        aucune API navigateur dans le paquet bâti
│   │
│   ├── legal-cm/                     ← PHASE 1, constantes et validateurs
│   │   ├── src/{index,tva,mentions,niu,rccm,numerotation}.ts
│   │   └── test/
│   │
│   ├── ui/                           ← PHASE 1, jetons de design + i18n
│   │   └── src/{tokens.css,i18n.ts,components/}
│   │
│   └── render/                       ← PHASE 1b, seulement quand les tests passent
│       ├── doc/                      gabarits A4 (devis en premier)
│       ├── registre/                 registres interactifs (njangi en premier)
│       └── card.ts                   CardSpec -> canvas PNG (porté tel quel)
│
├── apps/
│   ├── web/                          ← PHASE 1b, la PWA
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── public/{manifest.webmanifest,icons/}
│   │   └── src/{main.tsx,app.tsx,routes/,store/,sw.ts}
│   └── read/                         ← PHASE 2 (dossier créé vide, avec un README)
│
├── workers/api/                      ← PHASE 2
├── services/pdf/                     ← PHASE 5
└── e2e/                              ← PHASE 2
```

Les dossiers des phases 2 à 5 sont créés vides, avec un `README.md` d'une ligne qui
rappelle leur critère d'entrée. Rien d'autre : pas de squelette de code mort.

---

## 3. `package.json` racine

```json
{
  "name": "atelier237",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "pnpm --filter @a237/web dev",
    "build": "pnpm -r --filter \"./packages/**\" build && pnpm --filter @a237/web build",
    "test": "vitest run",
    "test:cov": "vitest run --coverage",
    "typecheck": "tsc -b",
    "budget": "node scripts/budget.mjs && node scripts/deps.mjs",
    "verif": "pnpm typecheck && pnpm test:cov && pnpm budget"
  },
  "devDependencies": {
    "typescript": "…",
    "vitest": "…",
    "@vitest/coverage-v8": "…",
    "vite": "…",
    "@preact/preset-vite": "…"
  }
}
```

**Les versions sont volontairement laissées en `…`.** Vite et Vitest changent de
majeure vite ; je ne veux pas inventer un numéro de mémoire. À l'installation je
résous les versions courantes, je les épingle au format `^majeure.mineure.correctif`
et le fichier de verrouillage fait foi. Les numéros retenus seront écrits dans le
message de commit, conformément à la section 8.

`pnpm-workspace.yaml` :

```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "workers/*"
  - "services/*"
  - "e2e"
```

---

## 4. `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

`packages/engine/tsconfig.json` — **c'est ici que se joue l'invariant du moteur pur** :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["src", "test"],
  "references": [{ "path": "../legal-cm" }]
}
```

`"lib": ["ES2022"]` **sans `"DOM"`** : `document`, `window`, `navigator`,
`localStorage`, `fetch`, `HTMLCanvasElement` ne compilent tout simplement pas dans
ce paquet. Vérifié en le cassant : les trois premiers font échouer `tsc` sur-le-champ.

> **Correction en cours de route.** La proposition initiale ajoutait `"types": []`,
> ce qui interdisait aussi les types Node — et donc empêchait `test/purete.test.ts`,
> qui lit les sources avec `node:fs`, de compiler. Le garde-fou qui compte est `lib`
> sans `DOM` ; il est conservé intact. L'interdiction des API Node dans `src/` est
> tenue par le test de pureté, qui refuse tout import non relatif autre que
> `@a237/legal-cm` — vérifié en ajoutant un `import { readFileSync } from 'node:fs'`
> dans le moteur, qui le fait bien échouer.

`test/purete.test.ts` double la règle à la lecture, et interdit en plus `new Date()`
sans argument, `Date.now()` et `Math.random()` : le moteur ne lit ni l'horloge ni le
hasard. Un test, pas une convention.

`apps/web/tsconfig.json` ajoute `"lib": ["ES2022", "DOM", "DOM.Iterable"]`.

---

## 5. `apps/web/vite.config.ts`

```ts
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  build: {
    target: 'es2020',                       // Chrome Android d'entrée de gamme
    modulePreload: { polyfill: false },     // 2 Ko rendus au budget
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
    reportCompressedSize: true,
    sourcemap: true                         // hors du chemin critique, non servi
  }
})
```

**Pas de `manualChunks`.** Le découpage vient de l'app elle-même : un registre de
squelettes fait d'`import()` dynamiques,

```ts
const OUTILS = {
  njangi: () => import('@a237/render/registre/njangi'),
  devis:  () => import('@a237/render/doc/devis'),
  // … les quatorze autres
}
```

Rollup en tire naturellement un fragment par outil, le service worker les met en
cache au premier usage, et la coquille de départ ne paie pas les seize outils. C'est
la seule façon de tenir 120 Ko gzip avec seize squelettes, quatre gabarits de CV, les
rendus A4, la carte canvas et les graphiques.

Le **service worker est écrit à la main** (`src/sw.ts`, bâti séparément) : coquille et
fragments d'outils en cache, données en IndexedDB, file d'attente de publication en
IndexedDB. Pas de Workbox — il pèse plus que l'app.

---

## 6. Les budgets, en CI, dès le premier commit

`scripts/budget.mjs` mesure après `build` et **sort en erreur** :

| Mesure | Plafond | Portée |
|---|---|---|
| Coquille initiale de la PWA (html + entrée + css préchargée, gzip) | 120 Ko | dès la phase 1 |
| Fragment d'un outil (gzip) | 25 Ko | dès la phase 1 |
| Page de lecture publique | 25 Ko, zéro `<script>` | phase 2 |
| Carte PNG | 200 Ko | phase 2 |
| Dépendances de production dans `apps/web` | 5 | dès la phase 1 |
| Couverture de `packages/engine` | > 90 % | dès la phase 1 |

Le plafond de 120 Ko porte sur **la coquille**, pas sur le total du `dist`. Un outil
chargé à la demande et mis en cache n'est pas sur le chemin critique du premier
rendu. Si tu veux le plafond sur le total, dis-le : c'est tenable, mais ça change les
arbitrages de rendu (les quatre gabarits de CV deviennent alors le premier poste).

---

## 7. Une question de dépendance à trancher : `zod` dans le client

Le brief autorise `preact`, `idb-keyval` et `zod` sans demander. Les deux premières
sont acquises (~4 Ko et ~1 Ko). `zod` me gêne : la validation de schéma sert surtout
**côté Worker** (valider une sortie de modèle avant qu'elle n'atteigne quoi que ce
soit) et il pèse une part non triviale d'un budget de 120 Ko.

Proposition : `zod` reste **dépendance de production du Worker**, et **dépendance de
développement du moteur**, où il sert à *générer* les JSON Schema statiques. La PWA
importe les schémas générés et un validateur écrit à la main — exactement le test que
la section 8 impose (« pourquoi ça ne s'écrit pas en 40 lignes »). Je mesure le poids
réel des deux options au moment de l'installation et je te donne le chiffre avant de
figer, plutôt que de citer un nombre de mémoire.

---

## 8. Ce que je fais ensuite, une fois validé

Étape 3 de la section 11, dans cet ordre, en commits petits et français :

1. `types.ts` — `Skeleton`, `Schema`, `CardSpec`, `ShareSpec`, `ToolState`.
2. `lettres.ts` **avec son test d'abord** : 0, 71, 80, 81, 91, 100, 1 000 000,
   2 100 000, plus 17, 200, 201, 1 000, 80 000 et le comportement au-delà du milliard.
3. `legal-cm` + `compute/tva.ts` **avec leur test d'abord** : 19,25 % ligne par ligne
   puis en bloc, arrondis, montant nul, ligne à quantité nulle, très gros montants.
4. Squelette `devis` : schéma, calculs, spécification de carte, mentions obligatoires.
5. Squelette `njangi` : schéma, collecte, fiabilité, prochain tour, carte.
6. `purete.test.ts` : aucune API navigateur dans le moteur bâti.

**Je ne touche pas au rendu tant que ces tests ne passent pas** (section 11, point 4).
