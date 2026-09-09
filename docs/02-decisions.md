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

### Un registre décrit par ses colonnes n'est pas du code
Quatre outils du prototype — liste de prix, livre de caisse, inventaire,
annuaire — ne sont qu'un tableau de lignes avec des colonnes différentes. Ils
déclarent leurs colonnes ; **le schéma s'en déduit**, et avec lui la validation,
la carte, le partage et le formulaire d'édition. Deux calculatrices tiennent de
même dans une formule. Ajouter un cinquième registre de ce genre coûte vingt
lignes de description.

Ce qui ne rentre pas dans une fabrique y reste étranger : le njangi a une
rotation, l'ardoise aura un vieillissement, la présence une matrice. Une
fabrique qui prétendrait les couvrir aussi serait un langage de programmation
déguisé, et le brief veut précisément l'inverse.

### Les paquets déclarent `"sideEffects": false`
Sans ça, Rollup ne peut pas prouver que construire un squelette au chargement
d'un module est sans conséquence, et garde tout : la coquille payait sept
kilo-octets pour des outils que personne n'avait ouverts. `budget.mjs` cherche
maintenant des marqueurs d'outils dans le fragment de départ et échoue s'il en
trouve.

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

| Quoi | Résultat | Quand |
|---|---|---|
| Les trois outils écrits fonctionnent sur un vrai téléphone | oui | 9 septembre 2026 |
| L'application s'ouvre données coupées | **oui** | 9 septembre 2026 |
| « Partager la carte » ouvre WhatsApp avec l'image | **oui** | 9 septembre 2026 |

Sur https://atelier237.vercel.app, sur la cible et non sur une machine de
développement.

La troisième ligne est celle qui comptait le plus : la section 6 du brief la
posait comme préalable — « vérifie que `navigator.share({files})` ouvre bien
WhatsApp sur les téléphones que tes utilisateurs ont vraiment, pas seulement sur
le tien » — et toute la couche de diffusion en dépendait. Le repli du prototype
(copier le texte, appui long sur l'image) reste en place pour les appareils qui
ne savent pas partager de fichier, mais il n'est plus le chemin principal.

La deuxième valide l'invariant § 2.7 sur la cible, et coche un des quatre
critères d'arrêt de la phase 1.

## Où vit le proxy IA — tranché le 9 septembre 2026

Le brief le place dans le Worker Cloudflare, au même endroit que le webhook de
paiement et la page de lecture (§ 3.1). Il part d'abord en **fonction Vercel**,
parce que l'application y est déjà déployée : l'étage 2 est joignable
aujourd'hui plutôt qu'après une phase 2 complète.

L'écart est contenu par construction. Tout ce qui décide vit dans `@a237/ia` et
`packages/engine/src/registre.ts`, purs et testés sans réseau ; le fichier
déposé dans `api/` n'est que de la plomberie. Le déménagement vers Cloudflare
déplacera un fichier, pas une couche.

Le taux USD → XAF est déjà en configuration (`A237_TAUX_FCFA`) et non en
constante, comme la ligne reportée ci-dessous l'exigeait.

## Ce qui manque encore au proxy, et pourquoi il reste fermé

Le brief exige un quota par compte — `credits > 0`, sinon 402 — et un journal
dans `ai_calls`. Les comptes vivent dans D1, qui n'existe pas avant la phase 2.

Un proxy ouvert sans quota est un robinet payant offert à qui passe. La
fonction refuse donc de servir tant que `A237_IA_OUVERTE` ne vaut pas `1` :
**poser la clef ne suffit pas**. Deux gestes, pas un. C'est grossier et
délibérément visible — un garde-fou qu'on remarque est un garde-fou qu'on
remplace, là où un plafond discret se serait fait oublier.

Le coût réel part dans le journal du serveur en attendant sa table, parce que
« moins d'un franc par génération » (§ 8) est un critère de réussite, et qu'un
critère qu'on ne mesure pas est une croyance.

## Le modèle économique est hybride — tranché le 9 septembre 2026

Le brief prévoyait un abonnement mensuel de 2 000 F (§ 1). La décision le
complète plutôt que de le remplacer :

| Étage | Ce que c'est | Ce que ça coûte |
|---|---|---|
| 1 | Un squelette répond, par mots-clefs | **gratuit**, et hors ligne |
| 2 | Un outil composé par le modèle | **à l'appel**, quelques centimes |
| 3 | Plusieurs outils d'un coup | **abonnement** |

**Le point qui fait tenir l'ensemble : l'étage se décide avant de dépenser.**
`etageDe` ne coûte rien — c'est de la correspondance de mots-clefs, hors
ligne — et c'est ce qui permet d'annoncer un prix plutôt qu'une facture.
Reconnaître une grosse demande après l'avoir faite reviendrait à présenter
l'addition en prétendant l'avoir annoncée.

Le navigateur affiche le prix sous le bouton, avant le clic. Le serveur
recalcule et tranche : un prix qu'on peut contourner depuis les outils de
développement n'est pas un prix.

Le doute penche du côté le moins cher. Sous-estimer coûte quelques centimes ;
sur-estimer envoie vers un abonnement quelqu'un qui voulait un seul carnet, et
celui-là ne revient pas. Les marques de pluralité sont donc peu nombreuses et
sans ambiguïté, et une hésitation entre deux outils reste une question, pas un
paiement.

### Ce qui manque, et ce que la phase 2 doit livrer

`abonne()` rend `false` : il n'y a pas de comptes, donc l'étage 3 est fermé à
tout le monde. C'est la bonne valeur par défaut — on ne facture personne, et on
ne dépense pas non plus. C'est une couture d'une ligne, à brancher sur le plan
du compte quand D1 existera.

La phase 2 doit donc livrer, en plus de ce que le brief prévoyait : un plan par
compte lisible à chaque appel, et un compteur de consommation à l'appel pour
l'étage 2 — le solde d'OpenRouter est global, il ne dit pas qui a dépensé quoi.

## Le catalogue est complet : dix-sept sur dix-sept

Les huit derniers squelettes sont écrits. Trois décisions de portage méritent
d'être consignées, parce qu'elles s'écartent du prototype et qu'on se
demandera pourquoi.

**Le CV ne traduit que ses intitulés.** Le prototype basculait le CV entier en
anglais — mais il ne pouvait le faire que pour le CV d'exemple qu'il portait en
dur. Traduire le texte de quelqu'un demande le modèle, donc des jetons, pour un
résultat qu'on ne saurait pas relire. La bascule ne touche donc que
« Expérience professionnelle » / « Experience ». Et il ne réserve aucune place
pour une photo : tant que l'atelier ne sait pas stocker une image, un carré vide
marqué « photo » sur la feuille qu'on tend à un employeur est pire que rien.

**L'ancienneté d'une dette se calcule.** Le prototype gardait un nombre de jours
dans l'état de l'ardoise. Il n'aurait jamais bougé : une dette de trois mois se
serait affichée « depuis 4 jours » pour toujours. On garde la date d'ouverture,
et les jours se déduisent de l'instant que l'appelant fournit — la même règle
que partout ailleurs, le moteur ne lit pas d'horloge.

**Une case vide n'est pas une absence.** Sur la feuille de présence, le
dénominateur ne compte que les séances où la personne figurait. Sans cette
règle, le dernier inscrit ouvre la feuille à 20 % et n'y peut rien.

Deux écrans portent un avertissement avant diffusion : l'ardoise (§ 2.5 du
brief, mot pour mot) et le call-box, dont la recette du jour n'est pas une
information de groupe. La feuille de présence partage l'appel du jour, que tout
le monde a vu de ses yeux, jamais le taux d'assiduité de chacun.

## Reportées, et à quel moment il faudra trancher

| Sujet | Quand | Ce qui est déjà prêt |
|---|---|---|
| L'état publiable vit-il en D1 ou seulement en KV ? | avant la phase 2 | `docs/00-lecture-du-brief.md` § 2.4 — recommandation : colonne `state` dans `tools`. |
| Quel mécanisme d'identité ? | avant la phase 2 | § 2.5 — proposition : `device_id` + jeton opaque + code de récupération. |
| Que se passe-t-il quand le serveur rejette une version périmée ? | phase 2 | § 2.7 — la réponse 409 doit renvoyer la version stockée et l'app poser la question. |
| Taux USD → XAF pour `ai_calls.cost_xaf` | phase 4 | § 3.1 — le `USD=656` du prototype est le taux fixe **euro**/FCFA appliqué au dollar. À relever à la source, et à mettre en configuration du Worker, pas en constante. |
| Les six vérifications de la section 6 du brief | à l'ouverture de chaque phase concernée | § 4 — aucune ne concerne la phase 1. |
| Longueur du lien court pour les documents qui portent des noms et des montants | phase 2 | Un slug de 4 caractères en base32 fait environ un million de combinaisons : énumérable. Acceptable pour une liste de prix, discutable pour une facture ou une ardoise. À trancher avec le format d'URL, avant que des liens soient dans la nature. |
