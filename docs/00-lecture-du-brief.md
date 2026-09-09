# Lecture du brief — ce que j'ai compris, et ce qui coince

Rédigé avant toute ligne de code, après lecture intégrale de `BRIEF.md` et
dépouillement de `reference/atelier-prototype.html` (1 461 lignes, 16 squelettes).

---

## 1. L'architecture en dix lignes

1. Deux programmes distincts : une **PWA Preact** pour celui qui écrit, du **HTML
   sans JavaScript** rendu au bord pour celui qui lit. Ils ne partagent que le moteur.
2. Le cœur est **`packages/engine`** : pur, sans DOM, testé — types `Skeleton`,
   schémas, calculs d'argent, montant en toutes lettres, spécification de carte.
3. L'IA ne produit **jamais de code** : elle remplit une configuration JSON validée
   contre un schéma, que des moteurs écrits à la main transforment en pixels.
4. Trois étages de coût : squelette servi tel quel (0 jeton, ~70 % des cas),
   composition (~1 500 jetons), libre (~3 000 jetons, plafonné).
5. L'état vit **en IndexedDB sur le téléphone du propriétaire**. Le réseau ne sert
   qu'à publier, payer et appeler le modèle — trois choses qui peuvent attendre.
6. Publier = rendre la carte **en canvas sur le téléphone**, la téléverser dans R2,
   écrire l'instantané dans KV, puis D1. Aucun rendu d'image côté serveur, jamais.
7. Lire = un `GET` sur KV, un seul aller-retour, mis en cache au bord, avec
   `og:image` pointant la carte : **l'aperçu WhatsApp est le tableau de bord**.
8. La publication est **en lecture seule** et **versionnée** : une version périmée
   est rejetée, un vieux téléphone n'écrase pas une publication plus récente.
9. Les relances partent du **pouce du trésorier** via `wa.me`, jamais du serveur —
   la dette de njangi est sociale, l'autorité est celle du trésorier, pas la nôtre.
10. Le poids est une fonctionnalité : 120 Ko gzip pour la PWA, 25 Ko et zéro JS
    pour la page publique, 200 Ko pour la carte. Vérifié en CI, pas à l'œil.

---

## 2. Contradictions internes du brief

Aucune n'est grave, mais chacune produirait du mauvais code si on la suit à la lettre.

### 2.1 « 6 documents » qui en font 7, et une facture qui n'existe pas
La section 1 annonce « 6 documents A4 » puis en énumère sept, dont une **facture**.
Le prototype n'a **pas** de squelette `facture` : `devis` porte simplement `facture`
dans ses mots-clés. Or **toute la section 5 est du droit de la facture** (NIU du
client, numérotation continue, TVA ligne par ligne, déductibilité B2B). Un devis
n'engage rien fiscalement ; une facture, si.
→ **Décision demandée** : `facture` devient-elle un squelette à part entière en v1 ?

### 2.2 « 6 registres complets » qui en font 4
La section 1 compte `njangi, dettes, prix, présence, callbox, caisse` comme registres
complets. Dans le prototype, le décompte réel est : **4 registres écrits à la main**
(njangi, dettes, prix, présence), **1 calculatrice à barème** (callbox, groupe
« Calculs »), **3 listes génériques pilotées par configuration** (caisse, stock,
clients) et **2 calculatrices** (scolarité, course). Total : 16, mais pas la
répartition annoncée.
→ Sans effet sur le plan : c'est le décompte du travail qui change, pas la cible.
   Les 3 listes et 2 calculatrices sont presque gratuites, elles sortent d'un moteur
   générique déjà présent dans le prototype (`tList`, `tCalc`).

### 2.3 Le PDF est en phase 3 dans un tableau, en phase 5 partout ailleurs
Section 3.2, ligne « PDF » : « **phase 3** : Playwright sur un petit VPS. Voir 7.5. »
La section 3.3 dit `services/pdf/ phase 5`, la section 7 met le paiement en phase 3
et le PDF en phase 5, et le renvoi « voir 7.5 » désigne bien la phase 5.
→ Je retiens **phase 5**. Coquille dans le tableau.

### 2.4 Où vit l'état publiable ? Le schéma D1 ne le dit pas
`POST /publish` envoie `{ config, state, version }`. KV stocke `state`. Mais la table
`tools` n'a **qu'une colonne `config`** — aucune colonne `state`. Conséquence si on
implémente le SQL tel quel : **KV devient l'unique dépôt de l'état d'un registre**,
et un téléphone perdu ou réinstallé perd le carnet de njangi, sauf à le relire depuis
l'instantané public. Pour un trésorier qui tient douze mois de cotisations, c'est la
panne qui tue le produit.
→ **Décision demandée**, elle change le schéma et le parcours de restauration :
   - **(a)** ajouter `state TEXT` à `tools` : D1 est la source de vérité, KV est un
     cache dérivé, la restauration après perte du téléphone est un vrai chemin ;
   - **(b)** garder D1 pour les métadonnées seules, et assumer que la restauration
     se fait depuis l'instantané KV public — plus simple, moins sûr.
   Je recommande **(a)** : le surcoût est une colonne et une écriture déjà faite.

### 2.5 Il n'y a aucune authentification dans le brief
`POST /publish` doit « vérifier le quota du plan », `users` a un `recovery_hash` et il
existe une table `devices` — mais **aucun mécanisme d'identité n'est décrit** : ni
inscription, ni session, ni jeton. Le Worker ne peut pas savoir de quel compte vient
une publication.
→ Proposition, à trancher **avant la phase 2**, pas maintenant : au premier lancement
   la PWA crée un `device_id` + un jeton opaque stockés en IndexedDB, le Worker crée
   un `users` en `trial` à la première requête, et le **code de récupération**
   (`recovery_hash`, déjà prévu) rattache un nouveau téléphone au compte. Pas de mot
   de passe, pas d'e-mail, pas de SMS à payer. Cohérent avec la section 2.
   Corollaire à assumer : qui détient le jeton publie. En lecture seule, c'est tenable.

### 2.6 Numérotation « unique, continue et chronologique » vs hors ligne d'abord
Section 5 : la numérotation des factures est la mention que la DGI surveille. Le
prototype la code en dur (`num:"DV-2026-0118"`). Mais l'invariant 7 impose de pouvoir
travailler hors ligne, et la section 3.4 prévoit plusieurs `devices` par compte :
**deux téléphones hors ligne produiront deux fois le même numéro**.
→ Proposition : le compteur vit dans la configuration de l'outil, il est incrémenté
   localement, et le serveur **refuse la publication d'un numéro déjà utilisé** pour
   ce compte (contrainte d'unicité), l'app renumérotant alors le brouillon. À écrire
   dans le schéma `devis`/`facture` dès la phase 1, sinon c'est une migration plus tard.

### 2.7 Une publication rejetée par le contrôle de version n'a pas de porte de sortie
« rejette si `version` ≤ version stockée » est juste, et la file d'attente hors ligne
rejoue les requêtes. Combinés, les deux perdent silencieusement le travail : le
téléphone A édite dans le train, le téléphone B publie, la file de A est rejetée.
→ À prévoir dans la même phase : la réponse 409 doit renvoyer la version stockée, et
   l'app doit poser la question à l'écran (« ta version est plus ancienne — reprendre
   celle du serveur, ou écraser ? »). Une ligne dans l'API, un écran dans l'app.

---

## 3. Faits du prototype à corriger en le portant

### 3.1 `USD=656` est un taux faux (bogue de coût réel)
`reference/atelier-prototype.html:511` : `USD=656`. C'est le **taux fixe du franc CFA
contre l'euro** (1 EUR = 655,957 XAF, parité fixe), appliqué par erreur au dollar. Or
les modèles se facturent **en dollars** et le brief demande un coût **en FCFA** dans
`ai_calls.cost_xaf` avec un plafond à 1 FCFA par génération. Le taux USD/XAF flotte
avec l'euro.
→ À porter comme **paramètre de configuration du Worker**, pas comme constante, avec
   un `// À VÉRIFIER:` et une valeur relevée à la source le jour où la phase 4 démarre.
   Ordre de grandeur du budget malgré tout tenu : ~1 500 jetons entrée / ~800 sortie
   sur Flash-Lite ≈ 0,000 47 $, soit une fraction de franc quel que soit le taux retenu.

### 3.2 La TVA n'est calculée qu'en bloc, jamais ligne par ligne
Section 5 : « TVA 19,25 %, **indiquée ligne par ligne**, puis en bloc HT / TVA / TTC ».
Le prototype ne fait que le bloc (`ht.reduce`, puis `Math.round(ht*0.1925)`).
→ Le moteur doit calculer et exposer la TVA par ligne. Question d'arrondi à trancher
   dans les tests : **arrondir chaque ligne puis sommer**, ou **sommer puis arrondir**
   — les deux ne donnent pas le même TTC. Je propose d'arrondir au franc à la ligne et
   de faire du total la somme des lignes arrondies : c'est ce qu'un contrôleur
   recalcule à la main depuis le papier, et le document doit tomber juste sous son stylo.

### 3.3 `lettres()` s'arrête avant le milliard
`lettres(1e9)` produit « dix cents millions ». Au-delà de 999 999 999, la fonction est
fausse. Peu probable sur une reconnaissance de dette, mais c'est du calcul d'argent :
le moteur gérera le milliard ou refusera explicitement, testé dans les deux cas.
Le reste de l'algorithme est correct, y compris les pièges : `quatre-vingts` (80),
`quatre-vingt-un` (81), `soixante-et-onze` (71), `quatre-vingt-onze` (91), `cent` (100),
`deux millions cent mille` (2 100 000). Il est porté tel quel, avec ses tests.

### 3.4 Tout le prototype est écrit en `innerHTML`
`shell()`, `docPage()`, chaque outil : concaténation de chaînes injectées en
`innerHTML`. L'invariant 2.1 l'interdit sur toute sortie de modèle. Passer en JSX
Preact n'est pas un portage mécanique, c'est **la réécriture de tous les rendus** —
c'est l'essentiel du travail de la phase 1, et il faut le budgéter comme tel.

### 3.5 Ce qui se porte sans discussion
La spécification de carte est déjà uniforme aux quatre outils qui partagent
(`kicker, title, sub, tag, bigLabel, big, pct, subline, listTitle, items[], link, stamp`) :
elle devient `CardSpec` dans `packages/engine/cardspec.ts` sans y toucher. Le
`drawCard()` canvas, les textes français, les barèmes callbox, les gabarits A4 et les
mentions légales se portent à l'identique.

---

## 4. Ce que je ne vérifie pas maintenant

La section 6 liste six vérifications à faire « en une session, avant d'écrire la couche
concernée ». Aucune ne concerne la phase 1 : limites Cloudflare, latence depuis Douala,
domaine `.cm`, comptes CamPay/Fapshi, prix du VPS PDF, `navigator.share({files})` sur
de vrais téléphones. Elles sont bloquantes pour les phases 2, 3 et 5 — pas pour le
moteur. Je les rappellerai au moment d'ouvrir chacune de ces phases.
