# Décisions prises, et pourquoi

Journal des arbitrages. Une décision qui n'est écrite nulle part se re-débat
tous les trois mois.

---

## Validées par le propriétaire du projet

| # | Question | Décision |
|---|---|---|
| 1 | Racine du dépôt | Le dépôt **est** la racine, pas de dossier `atelier237/` intermédiaire. |
| 2 | `facture` en v1 | **Oui, squelette à part entière**, et **écrite**. Elle partage `schema/commun.ts` avec le devis et s'en écarte sur ce qui l'engage : échéance au lieu de validité, règlements reçus au lieu d'acompte annoncé, statut de paiement. |
| 3 | Budget de 120 Ko gzip | Porte sur **la coquille initiale** (html + fragment d'entrée + css préchargée), et il est **mesuré** : `scripts/budget.mjs` échoue au-delà. Coquille à 18,6 Ko, fragments d'outils sous 5 Ko chacun. |

---

## Prises en écrivant le moteur

### Les montants sont des entiers, toujours
Le franc CFA n'a pas de subdivision. Tout ce qui est monétaire est un entier, la
TVA se calcule en entiers (`ht × 1925 / 10000`), et une fonction qui reçoit un
montant fractionnaire lève plutôt que d'arrondir dans le dos de l'appelant.

### On arrondit à la ligne, puis on somme
Deux lignes à 100 F donnent 19 F de TVA chacune, soit 38 F. Sommer d'abord puis
arrondir donnerait 39 F. On imprime 38 F, parce que c'est ce qu'un contrôleur
retrouve en recalculant le document ligne à ligne. Figé par un test.

### Le moteur ne lit ni l'horloge ni le hasard
`RenderContext.maintenant` est passé en argument. Sans ça les tests ne seraient
pas déterministes, et surtout la page rendue au bord n'afficherait pas le même
horodatage que le téléphone qui a publié. Vérifié par `purete.test.ts`, qui
interdit `new Date()` sans argument, `Date.now()` et `Math.random()`.

### Les dates sont mises en forme à l'heure de Douala, pas à celle de la machine
Africa/Douala est UTC+1 toute l'année, sans heure d'été. Un document publié à
23 h 30 à Douala porterait la veille sur une page rendue par un Worker qui vit
en UTC. `Intl` n'est pas utilisé : sa sortie dépend de la version d'ICU
embarquée, qui n'est pas la même sur un Tecno de 2019 et au bord de Cloudflare.

### Le schéma dit la forme, `legal-cm` dit l'obligation
Le NIU du client et la raison sociale sont *présents* dans le schéma mais
peuvent être vides — sinon on ne pourrait pas ouvrir un devis vierge. C'est
`mentionsManquantes` qui décide si un document est émettable, et lui seul.
Mélanger les deux couches laisserait passer un devis sans NIU, ou empêcherait
d'en commencer un.

### La date d'émission est figée dans l'état, jamais « maintenant »
Un devis réédité six mois plus tard porte toujours sa date d'origine. Même
raisonnement pour le numéro. C'est ce qui a motivé l'ajout de `initialiser(ctx)`
au type `Skeleton` du brief : ces deux champs ne peuvent pas vivre dans une
constante statique.

### Les champs inconnus sont des chaînes vides, jamais `null`
L'état fait l'aller-retour par JSON et passe par un validateur volontairement
minuscule. Ajouter le type `null` au sous-ensemble de JSON Schema coûterait plus
qu'il ne rapporte. Un numéro de téléphone qu'on n'a pas est une propriété
absente ; un NIU qu'on n'a pas est `''`.

### Une facture neuve est payable à réception
Pas de délai de trente jours par défaut : c'est une convention commerciale
française, pas une règle camerounaise, et le brief interdit d'inventer un délai
administratif (§ 9). L'utilisateur fixe son échéance.

### L'échéance dépassée l'emporte sur l'acompte reçu
Une facture en retard partiellement réglée est affichée « en retard », pas
« partielle » : pour agir, c'est le retard qui compte. Un versement au-delà du
dû ressort en trop-perçu plutôt que de creuser un reste négatif — ça se voit au
lieu de se perdre.

### L'A4 est rendu à la taille vraie, jamais à l'échelle
Le prototype dessinait un aperçu en pixels minuscules — 7,4 px pour le corps de
texte. Ça se voit à l'écran et ça s'imprime n'importe comment. La page fait ses
210 × 297 mm et le texte ses points ; c'est l'aperçu qui est mis à l'échelle par
une variable CSS. C'est aussi la seule façon d'obtenir un PDF juste en phase 5.

### Le rendu n'injecte jamais de HTML
Preact échappe tout ce qu'on lui passe en enfant. Un scanner interdit
`dangerouslySetInnerHTML`, `innerHTML`, `eval` et `new Function` dans tout
`packages/render`, et des tests vérifient qu'un `<script>` glissé dans le nom du
client ou la désignation d'une ligne ressort échappé. C'est l'invariant § 2.1
vérifié là où il se joue plutôt qu'affirmé dans un commentaire.

### Le validateur de schéma est écrit à la main
Cent lignes, sans dépendance, en vocabulaire JSON Schema standard pour servir
tel quel de schéma de réponse contrainte au modèle en phase 4. Une clef
`__proto__` venue de `JSON.parse` est cherchée avec `Object.hasOwn` et non par
accès direct, sinon elle remonterait la chaîne de prototypes. Testé.

### Le formulaire d'édition se déduit du schéma
Écrire un écran par squelette, ce serait dix-sept écrans à tenir à jour qui
divergeraient du schéma au premier champ ajouté — et le schéma est ce que le
modèle remplit, donc la divergence se paierait deux fois. Les libellés viennent
de `title`, un mot-clef standard de JSON Schema : pas de table de traduction à
côté, donc rien à oublier de traduire.

### La coquille ne connaît aucun squelette
Elle liste un catalogue de données pures, range des états, et charge à la
demande le fragment qui sait dessiner l'outil qu'on ouvre. L'état d'un outil
neuf vient de ce fragment, pas de la coquille. C'est ce qui fait que les
quatorze squelettes restants n'alourdiront pas le départ : **18,6 Ko gzip**
aujourd'hui, pour un plafond de 120.

### Le service worker précharge toute l'application
Y compris les fragments d'outils. C'est ce qui permet d'ouvrir n'importe quel
outil en mode avion **dès la première visite**, et pas seulement ceux qu'on a
déjà ouverts une fois. Vérifié dans un vrai navigateur, hors ligne.

### Un rejet asynchrone s'affiche, il ne se tait pas
`void promesse()` avalait les échecs : l'écran restait figé sans rien dire, ce
qui est le pire comportement pour quelqu'un dont le réseau tombe et dont le
téléphone est plein. Tout ce qui est asynchrone passe par un point unique qui
affiche ce qui a raté.

### `zod` n'est pas entré
Il n'a pas été nécessaire : le validateur écrit à la main fait le travail pour
moins cher qu'un poids dans un budget de 120 Ko. **Une seule dépendance de
production** à ce stade, `preact` — cinq étaient autorisées. La question de
`zod` se reposera au Worker, où le budget de poids n'existe pas.

---

## Vérifié sur le terrain

| Quoi | Où | Quand |
|---|---|---|
| Les trois outils écrits fonctionnent sur un vrai téléphone | https://atelier237.vercel.app | 9 septembre 2026 |

C'est la première fois que le produit tourne sur sa cible et non sur une machine
de développement. Deux choses restent à confirmer **sur ce même téléphone**, et
elles ne se déduisent pas de la première : que l'application s'ouvre données
coupées, et que « Partager la carte » ouvre bien WhatsApp — la section 6 du
brief insiste, « pas seulement sur le tien ».

## Reportées, et à quel moment il faudra trancher

| Sujet | Quand | Ce qui est déjà prêt |
|---|---|---|
| L'état publiable vit-il en D1 ou seulement en KV ? | avant la phase 2 | `docs/00-lecture-du-brief.md` § 2.4 — recommandation : colonne `state` dans `tools`. |
| Quel mécanisme d'identité ? | avant la phase 2 | § 2.5 — proposition : `device_id` + jeton opaque + code de récupération. |
| Que se passe-t-il quand le serveur rejette une version périmée ? | phase 2 | § 2.7 — la réponse 409 doit renvoyer la version stockée et l'app poser la question. |
| Taux USD → XAF pour `ai_calls.cost_xaf` | phase 4 | § 3.1 — le `USD=656` du prototype est le taux fixe **euro**/FCFA appliqué au dollar. À relever à la source, et à mettre en configuration du Worker, pas en constante. |
| Les six vérifications de la section 6 du brief | à l'ouverture de chaque phase concernée | § 4 — aucune ne concerne la phase 1. |
| Longueur du lien court pour les documents qui portent des noms et des montants | phase 2 | Un slug de 4 caractères en base32 fait environ un million de combinaisons : énumérable. Acceptable pour une liste de prix, discutable pour une facture ou une ardoise. À trancher avec le format d'URL, avant que des liens soient dans la nature. |
