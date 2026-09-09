# Atelier 237 — brief d'implémentation

> **Comment utiliser ce fichier.** Place-le à la racine du dépôt sous `BRIEF.md`, puis
> ouvre Claude Code et colle le prompt de la section 11. Claude Code lira ce fichier
> en entier avant d'écrire une ligne. Renvoie-le à ce fichier chaque fois qu'il
> propose quelque chose qui contredit la section 2.

---

## 0. Ce que tu construis

Un générateur d'outils de gestion pour le Cameroun. L'utilisateur décrit ce qu'il lui
faut en français courant — « il me faut un devis », « noter qui a cotisé au njangi » —
et reçoit soit un **document A4 conforme au droit camerounais**, soit un **registre
interactif** qu'il utilise tous les jours sur son téléphone, hors ligne.

Il publie ensuite cet outil sur un lien court, et **le diffuse dans WhatsApp** sous
forme d'image, de lien et de messages pré-remplis.

Modèle économique : essai gratuit limité, puis 2 000 F CFA / mois, payés en MTN Mobile
Money ou Orange Money.

**Cible.** Commerçants, trésoriers de njangi, gérants de callbox, enseignants,
demandeurs d'emploi. Android d'entrée de gamme, Chrome, forfait data compté à l'octet,
coupures de courant et de réseau quotidiennes.

---

## 1. Ce qui est déjà fait

Un prototype cliquable complet existe (HTML/JS d'un seul fichier, ~127 Ko).
Il contient, en état de marche :

- 16 squelettes d'outils : 6 documents A4 (CV 4 gabarits, devis, facture, attestation,
  reconnaissance de dette, lettre de motivation, reçu) et 6 registres complets
  (njangi, dettes clients, liste de prix, présence, callbox, caisse) plus des listes
  et calculatrices génériques.
- Les mentions légales camerounaises dans les documents d'affaires (entête RCCM/NIU,
  TVA 19,25 %, numérotation, pied légal, zones cachet/signature).
- Le montant en toutes lettres en français correct.
- La couche de diffusion WhatsApp : rendu canvas d'une carte PNG, lien court versionné,
  aperçu de discussion, relances `wa.me` individuelles.
- Les graphiques (barres, empilés) en SVG inline.
- Un simulacre de paiement mobile money et de formules.

**Le prototype est une spécification exécutable, pas une base de code.** On le porte,
on ne le copie pas tel quel. Ce qu'on garde intégralement : la logique métier, les
calculs, les gabarits de documents, le rendu de la carte canvas, les textes français.

---

## 2. Les invariants — à ne jamais « optimiser »

Ces décisions sont le produit. Si une proposition les contredit, elle est mauvaise,
même si elle est techniquement plus élégante.

1. **Jamais de génération de code libre par l'IA.** Le modèle remplit une
   **configuration JSON** validée contre un schéma. Le rendu est fait par des moteurs
   écrits à la main. Pas d'`eval`, pas d'`innerHTML` sur une sortie de modèle, pas de
   HTML arbitraire hébergé. C'est ce qui rend le coût en jetons dérisoire, la sortie
   fiable, et la surface d'attaque nulle.

2. **L'app d'écriture et la page de lecture sont deux programmes différents.**
   Le propriétaire de l'outil utilise une PWA. Celui qui ouvre le lien partagé reçoit
   du **HTML rendu côté serveur, sans JavaScript**. Un membre de njangi sur un Tecno
   à 25 000 F ne doit pas télécharger une application pour lire un tableau.

3. **Publication en lecture seule.** Le trésorier écrit, les membres lisent. Un
   registre modifiable par tous détruit exactement ce qu'il protège. Ça permet aussi
   de tenir la lecture sur un simple KV au lieu d'une base par client.

4. **Les relances partent du pouce de l'utilisateur**, via `wa.me`, jamais du serveur.
   Dans un njangi la dette est sociale : une relance de la plateforme n'a aucune
   autorité, celle du trésorier en a. Bonus : 0 F, pas de compte Meta, pas de
   validation de gabarit.

5. **L'ardoise (dettes clients) ne se publie pas dans un groupe.** Sa carte est un
   document interne. L'interface le dit à l'écran. Publier des noms et des montants,
   c'est de l'humiliation, et on perd le client avec l'argent.

6. **Le poids est une fonctionnalité.** Aplats plutôt que dégradés (÷3 sur le poids du
   PNG), pas de police web au-delà de ce qui est déjà chargé, pas de framework CSS,
   pas de bibliothèque de graphiques. Budgets en section 8.

7. **Hors ligne d'abord.** L'outil doit fonctionner entièrement sans réseau. Le réseau
   sert à publier, payer, et appeler l'IA — trois choses qui peuvent attendre.

8. **Aucune clé d'API dans le client.** Jamais. Ni IA, ni paiement, ni R2.

---

## 3. Architecture

### 3.1 Vue d'ensemble

```
  Téléphone du propriétaire            Bord (Cloudflare)              Téléphone du membre
  ┌───────────────────────┐         ┌─────────────────────┐         ┌──────────────────┐
  │ PWA Preact            │  publie │ Worker (Hono)       │  GET    │ Navigateur       │
  │ · moteurs de rendu    │────────>│ · /api/publish      │<────────│ atl.cm/n/ZBV3    │
  │ · état en IndexedDB   │         │ · KV  (instantanés) │         │                  │
  │ · carte PNG en canvas │         │ · R2  (cartes PNG)  │────────>│ HTML statique    │
  │ · file d'attente      │         │ · D1  (comptes)     │  200    │ + og:image       │
  └───────────────────────┘         │ · webhook MoMo      │         └──────────────────┘
            │                       │ · proxy IA          │
            │ navigator.share       └─────────────────────┘
            v                                 │
      ┌───────────┐                           │ HTTPS
      │ WhatsApp  │                           v
      └───────────┘                  CamPay / Fapshi · Gemini Flash-Lite
```

**Le point non évident :** la carte PNG est dessinée **sur le téléphone du
propriétaire**, pas sur le serveur. Au moment de publier, elle est téléversée dans R2
et la page de lecture pointe son `og:image` dessus. Résultat : aucun rendu d'image
côté serveur (pas de Satori, pas de resvg-wasm, pas de navigateur sans tête), et on
réutilise du code déjà écrit et déjà testé à l'œil.

### 3.2 Pile technique

| Couche | Choix | Pourquoi |
|---|---|---|
| App | **Vite + Preact + TypeScript** | 4 Ko de runtime, JSX, signaux. React coûte 40 Ko qu'on ne peut pas se permettre. |
| État local | **IndexedDB** via `idb-keyval` (~1 Ko) | localStorage plafonne vers 5 Mo et est synchrone ; on stocke aussi des PNG. |
| Hors ligne | **Service worker** écrit à la main | Workbox pèse plus que l'app. Coquille + moteurs en cache, données en IDB. |
| API | **Cloudflare Workers + Hono** | Gratuit à ton échelle, au bord, et c'est le même endroit pour le webhook, le proxy IA et la page de lecture. |
| Comptes | **D1** (SQLite) | Relationnel, transactionnel, gratuit au démarrage. |
| Lecture publique | **KV** | Le chemin le plus chaud. Un `GET` d'instantané ne doit jamais toucher D1. |
| Fichiers | **R2** | Pas de frais de sortie — décisif pour servir des images. |
| Paiement | **CamPay** ou **Fapshi**, derrière une interface | Les deux font MTN MoMo + Orange Money avec webhook. L'adaptateur te permet d'en changer sans réécrire. |
| IA | **Gemini 2.5 Flash-Lite** via proxy Worker | ~0,10 $ / 1 M jetons en entrée, 0,40 $ en sortie. Un CV revient à une fraction de franc. |
| PDF | **phase 3** : Playwright sur un petit VPS | Voir 7.5. En v1 : impression navigateur. |

### 3.3 Dépôt

```
atelier237/
├── BRIEF.md                    ← ce fichier
├── package.json                 (pnpm workspaces)
├── packages/
│   ├── engine/                  cœur pur, zéro DOM, 100 % testé
│   │   ├── skeletons/           les 16 squelettes en TS typé
│   │   ├── schema/              JSON Schema de chaque configuration
│   │   ├── compute/             totaux, TVA, amortissements, fiabilité njangi
│   │   ├── lettres.ts           montant en toutes lettres (français)
│   │   └── cardspec.ts          état d'un outil -> spécification de carte
│   ├── render/                  moteurs de rendu (dépendent du DOM)
│   │   ├── doc/                 gabarits A4
│   │   ├── registre/            registres interactifs
│   │   └── card.ts              spécification de carte -> canvas PNG
│   ├── legal-cm/                constantes et validateurs camerounais
│   └── ui/                      jetons de design, composants partagés
├── apps/
│   ├── web/                     la PWA (propriétaire)
│   └── read/                    le rendu HTML de lecture (importé par le Worker)
├── workers/
│   └── api/                     Hono : publish, pay, ai, read
├── services/
│   └── pdf/                     phase 5, Playwright
└── e2e/                         Playwright : parcours complets
```

`packages/engine` **ne doit importer aucune API navigateur**. C'est la règle qui rend
la thèse « configuration, pas code » testable en CI.

### 3.4 Modèle de données (D1)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- ulid
  phone         TEXT UNIQUE,               -- E.164, renseigné au premier paiement
  plan          TEXT NOT NULL DEFAULT 'trial',   -- trial | atelier
  plan_expires  INTEGER,                   -- epoch ms
  credits       INTEGER NOT NULL DEFAULT 5,
  recovery_hash TEXT,                      -- argon2 du code de récupération
  created_at    INTEGER NOT NULL
);

CREATE TABLE devices (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  label      TEXT,
  last_seen  INTEGER
);

CREATE TABLE tools (
  id         TEXT PRIMARY KEY,             -- ulid
  slug       TEXT UNIQUE NOT NULL,         -- 4 car. base32, l'URL courte
  user_id    TEXT NOT NULL REFERENCES users(id),
  skeleton   TEXT NOT NULL,                -- 'njangi', 'devis', ...
  name       TEXT NOT NULL,
  config     TEXT NOT NULL,                -- JSON validé contre le schéma
  version    INTEGER NOT NULL DEFAULT 0,   -- monotone, anti-écrasement
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE payments (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  provider     TEXT NOT NULL,              -- campay | fapshi
  provider_ref TEXT NOT NULL,
  amount_xaf   INTEGER NOT NULL,
  status       TEXT NOT NULL,              -- pending | success | failed
  raw          TEXT NOT NULL,              -- charge utile brute du webhook
  created_at   INTEGER NOT NULL,
  UNIQUE(provider, provider_ref)           -- idempotence
);

CREATE TABLE ai_calls (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,                -- 'compose' | 'libre' | 'action'
  tokens_in  INTEGER, tokens_out INTEGER,
  cost_xaf   REAL,
  ok         INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

**KV** — clé `snap:<slug>` → `{ version, skeleton, name, state, cardKey, publishedAt }`.
**R2** — clé `card/<slug>/<version>.png`.

### 3.5 Les quatre chemins critiques

**Publier** (`POST /api/tools/:id/publish`)
1. Le client rend la carte en canvas, `toBlob()`.
2. Il envoie `{ config, state, version }` + le PNG en `multipart/form-data`.
3. Le Worker : vérifie le quota du plan → valide la configuration contre le schéma →
   **rejette si `version` ≤ version stockée** (un vieux téléphone n'écrase pas une
   publication plus récente) → écrit R2, puis KV, puis D1 dans cet ordre.
4. Réponse : `{ url, version }`.
5. Si le client est hors ligne, la requête est mise en file dans IDB et rejouée.

**Lire** (`GET /:kind/:slug`)
1. Worker → KV (un seul aller-retour, mis en cache au bord).
2. Rendu de HTML statique par `apps/read` : `<meta og:image>` vers l'URL R2, puis le
   tableau. **Aucun `<script>` sur cette page.**
3. `Cache-Control: public, max-age=60, stale-while-revalidate=600`.
4. `?t=<version>` dans l'URL partagée pour que WhatsApp ne serve jamais l'aperçu de
   la semaine précédente.

**Payer**
1. Le client `POST /api/pay/start { phone, operator }`.
2. Worker → adaptateur fournisseur → insertion `payments` en `pending` → renvoie un
   identifiant de suivi.
3. L'utilisateur confirme sur son téléphone.
4. Webhook `POST /api/pay/webhook` → **vérification de la signature** → `UNIQUE`
   garantit l'idempotence → si succès : `plan='atelier'`, `plan_expires = now + 30 j`,
   `credits = 40`.
5. Le client interroge `GET /api/pay/:id` pendant 90 s, puis affiche « on te
   préviendra » et vérifie au prochain lancement.

**Appeler l'IA** (`POST /api/ai`)
1. Vérifier le quota (`credits > 0`), sinon 402.
2. Construire une invite qui **impose la sortie en JSON** conforme au schéma du
   squelette visé.
3. Appeler le modèle. Valider la sortie. **Un seul essai de reprise** en cas d'échec
   de validation, puis abandon avec un message clair.
4. Décrémenter les crédits, journaliser dans `ai_calls` avec le coût réel en FCFA.
5. Ne jamais renvoyer de HTML au client — uniquement de la configuration.

---

## 4. Le moteur : configuration, jamais de code

Trois étages, du moins cher au plus cher :

| Étage | Déclencheur | Jetons | Ce qui se passe |
|---|---|---|---|
| 1 — squelette | correspondance directe de mots-clés | **0** | On sert le squelette tel quel. Doit couvrir ~70 % des demandes. |
| 2 — composition | correspondance partielle | ~1 500 | Le modèle remplit la configuration d'un squelette existant (colonnes, libellés, unités, taux). |
| 3 — libre | aucune correspondance | ~3 000 | Le modèle compose une structure à partir des primitives, plafonné par jour et par compte. |

Un squelette ressemble à ça (`packages/engine/skeletons/njangi.ts`) :

```ts
export const njangi: Skeleton = {
  id: 'njangi',
  group: 'registres',
  title: 'Carnet de njangi',
  keywords: ['njangi', 'tontine', 'cotisation', 'tour', 'membre'],
  engine: 'registre',
  schema: njangiSchema,          // JSON Schema, la seule chose que l'IA peut remplir
  defaults: { cotisation: 5000, periode: 'semaine' },
  compute: { collecte, fiabilite, prochainTour },
  card: njangiCardSpec,          // état -> spécification de carte
  share: njangiShare,            // état -> texte, relances, description
}
```

L'IA ne produit **jamais** autre chose qu'un objet conforme à `schema`. Le rendu est
fait par `engine: 'registre'`, écrit à la main, testé.

---

## 5. Faits vérifiés à respecter

Ceux-ci ont été vérifiés à la source. Ne les redéris pas, ne les « corrige » pas sans
source.

**Droit camerounais — documents d'affaires**
- **TVA 19,25 %**, indiquée ligne par ligne, puis en bloc HT / TVA / TTC.
- **NIU obligatoire** — c'est la mention la plus surveillée par la DGI. Sans NIU,
  l'entreprise n'existe pas fiscalement et le client B2B ne peut pas déduire.
- **RCCM**, raison sociale complète, forme juridique, adresse, centre des impôts.
- Numérotation **unique, continue et chronologique**.
- En B2B, le **NIU du client** doit aussi figurer.
- Une facture envoyée par WhatsApp est valable si le PDF est complet.
- Reconnaissance de dette : montant **en toutes lettres**, mention « Lu et approuvé ».

**WhatsApp**
- L'**API Groups plafonne à 8 participants** par groupe, exige un Official Business
  Account, et n'est pas disponible pour les numéros de l'app WhatsApp Business.
  → Un bot dans un groupe njangi de 20 personnes est **impossible**. N'essaie pas.
- Maximum **10 000 groupes** par numéro d'entreprise.
- Liste de diffusion (app WhatsApp Business gratuite) : **256 contacts par liste**, et
  **le destinataire doit avoir enregistré ton numéro** pour recevoir.
- L'**Embedded Signup n'est pas ouvert au Cameroun** — embarquer le numéro d'un
  commerçant sur l'API Cloud est manuel et lent. Raison de plus pour rester sur
  `wa.me` en v1.
- `wa.me/<numéro>?text=<texte encodé>` : gratuit, sans compte, sans validation.

**Coûts modèles** (par million de jetons, entrée / sortie, relevés septembre 2026)
- Gemini 2.5 Flash-Lite : 0,10 $ / 0,40 $ ← **le choix par défaut**
- Qwen3.7 Flash : 0,03 $ / 0,13 $ (secours moins cher)
- Mistral Small 4 : 0,15 $ / 0,60 $
- Claude Haiku 4.5 : 1,00 $ / 5,00 $ (réserve : arbitrage de qualité seulement)

**Rails de paiement au Cameroun** : CamPay, Fapshi, MeSomb, NotchPay, LYGOS.
API MTN MoMo et Orange Money accessibles directement mais plus lourdes à embarquer.

**Concurrence** : Nkap Control facture déjà des Camerounais en mobile money sur le
créneau des outils de gestion. Ne raconte pas que le terrain est vide.

---

## 6. À revérifier avant de t'engager

Je ne les ai pas vérifiés, ou ils bougent vite. Vérifie-les toi-même, en une session,
**avant** d'écrire la couche concernée.

- Limites réelles du plan gratuit Cloudflare Workers / D1 / KV / R2 aujourd'hui.
- Latence réelle depuis Douala et Yaoundé vers le bord Cloudflare (mesure, ne suppose pas).
- Disponibilité, prix et pièces exigées pour un domaine `.cm` court. Un `.app` ou un
  `.com` court fait le même travail si `.cm` coince.
- Délai et pièces d'ouverture de compte marchand CamPay et Fapshi, et **fiabilité
  réelle de leurs webhooks** (c'est le risque d'exécution numéro un).
- Prix exact du VPS PDF au moment où tu y arrives.
- Que `navigator.share({files})` ouvre bien WhatsApp sur les téléphones que tes
  utilisateurs ont vraiment — pas seulement sur le tien.

---

## 7. Plan par phases

Chaque phase a un critère d'arrêt. **N'entame pas la suivante avant de l'avoir atteint.**

### Phase 0 — Préflight (aucun code)
Ouvrir les comptes CamPay et Fapshi en bac à sable. Réserver le domaine. Créer le
compte Cloudflare et le projet.
**Fini quand** : un paiement bac à sable de 100 F a été déclenché et son webhook
enregistré, à la main, avec `curl` ou l'interface du fournisseur.

### Phase 1 — Moteur et coquille hors ligne
Porter le prototype dans `packages/engine`, `packages/render` et `apps/web`. Aucun
serveur, aucun compte, tout en IndexedDB.
**Fini quand** : les 16 squelettes fonctionnent en mode avion sur un vrai Android ;
le bundle initial fait **moins de 120 Ko gzip** ; `packages/engine` a une couverture
de tests supérieure à 90 % ; les calculs TVA et le montant en toutes lettres ont des
tests de cas limites (0 F, 80, 81, 71, 1 000 000, 2 100 000).

### Phase 2 — Publication : la couche WhatsApp
Worker, KV, R2, D1. Publication, lien court, `og:image`, page de lecture sans script,
carte PNG, partage natif, relances `wa.me`.
**Fini quand** : tu colles un lien dans une vraie discussion WhatsApp et l'aperçu
affiche la carte ; un **deuxième téléphone** ouvre le lien et voit le registre à jour ;
tu publies deux fois de suite et l'aperçu change ; une publication avec une version
périmée est rejetée par le serveur.

### Phase 3 — Paiement
Interface `PaymentProvider`, deux adaptateurs, webhook signé, état d'abonnement,
quotas, écran de restauration par code de récupération.
**Fini quand** : **un vrai paiement de 100 F CFA** est passé de bout en bout sur ton
propre numéro, le webhook a basculé le plan, et **rejouer le même webhook trois fois
ne change rien** (idempotence prouvée par un test).

### Phase 4 — IA
Proxy Worker, invites contraintes au JSON, validation de schéma, reprise unique,
quotas, journal des coûts.
**Fini quand** : **dix générations réelles** ont été mesurées et le coût moyen par
génération est affiché en FCFA dans `ai_calls` ; une sortie volontairement invalide
est rejetée sans jamais atteindre le rendu ; le chemin « plus de crédits » est propre.

### Phase 5 — PDF réel
Service Playwright sur un petit VPS. Polices embarquées, feuille d'impression A4,
marges vérifiées.
**Fini quand** : un même devis produit un PDF **identique** ouvert sur Windows, macOS
et Android, et un imprimeur de quartier l'imprime sans surprise.

### Phase 6 — Terrain
Cinq commerçants réels utilisent l'outil une semaine. Un comptable camerounais valide
trois factures. Un recruteur de Douala relit trois CV.
**Fini quand** : quelqu'un que tu ne connais pas a payé 2 000 F sans que tu sois dans
la pièce.

---

## 8. Budgets et garde-fous

À faire échouer en CI, pas à surveiller à l'œil :

| Mesure | Plafond |
|---|---|
| Bundle initial de la PWA | 120 Ko gzip |
| Page de lecture publique | 25 Ko, zéro JS |
| Carte PNG partagée | 200 Ko |
| Premier rendu utile sur 3G lente | < 3 s |
| Coût moyen par génération IA | < 1 FCFA |
| Dépendances de production dans `apps/web` | 5 au maximum |

Toute nouvelle dépendance doit être justifiée par écrit dans le message de commit :
poids gzip, ce qu'elle remplace, pourquoi ça ne s'écrit pas en 40 lignes.

---

## 9. Comment travailler

- **Français partout dans l'interface**, chaînes centralisées dans `packages/ui/i18n.ts`
  (préparer l'anglais pour les CV, ne pas le traduire maintenant).
- Écrire le test avant le moteur pour tout ce qui calcule de l'argent.
- Commits petits, en français, un sujet par commit.
- Ne pas commencer une phase sans avoir coché le critère d'arrêt de la précédente.
- Quand une décision de la section 2 gêne, **le dire au lieu de la contourner**.
- Vérifier toute affirmation sur le droit ou les prix à la source. Si la source manque,
  écrire `// À VÉRIFIER:` dans le code et le remonter.
- Ne jamais inventer un montant, un taux, un délai administratif ou un tarif d'API.

---

## 10. Hors périmètre v1

À refuser, même si c'est tentant :
API WhatsApp Cloud · comptes multi-utilisateurs sur un même outil · édition partagée ·
synchronisation temps réel · application native · stockage de pièces jointes ·
signature électronique · connexion bancaire · marketplace de gabarits ·
mode hors ligne pour la page de lecture publique · notifications push.

---

## 11. Le prompt d'ouverture — à coller dans Claude Code

```
Lis BRIEF.md en entier avant toute chose. C'est la spécification du projet.

Tu construis Atelier 237. Nous démarrons à la Phase 1 : le moteur et la coquille
hors ligne. Les phases 0 à 6 et leurs critères d'arrêt sont en section 7 ; les
invariants sont en section 2 et ne se négocient pas.

Pour cette première session, dans cet ordre :

1. Résume-moi en dix lignes ce que tu as compris de l'architecture, et signale
   toute contradiction ou zone floue que tu vois dans le brief. Ne code pas encore.
2. Propose l'arborescence exacte du monorepo et le contenu des package.json,
   tsconfig et de la configuration Vite. Attends ma validation.
3. Implémente packages/engine : les types Skeleton et Schema, puis DEUX squelettes
   seulement — `njangi` (registre) et `devis` (document A4) — avec leurs tests
   unitaires complets, y compris le calcul de TVA à 19,25 % et le montant en toutes
   lettres en français (teste 0, 71, 80, 81, 91, 100, 1 000 000, 2 100 000).
4. Ne passe au rendu que quand ces tests passent.

Contraintes de cette session : aucune dépendance de production en dehors de preact,
idb-keyval et zod sans me demander. Tout en français dans l'interface. packages/engine
n'importe aucune API navigateur — c'est vérifié par un test.

Ce qui existe déjà : un prototype HTML d'un seul fichier qui contient toute la logique
métier, les gabarits et les textes. Je te le fournis comme référence. Porte-le, ne le
copie pas : le prototype est une spécification exécutable, pas une base de code.
```

Joins le fichier `atelier.html` du prototype à cette première session.
