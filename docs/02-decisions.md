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

Sur https://atelier237.pages.dev, sur la cible et non sur une machine de
développement.

La troisième ligne est celle qui comptait le plus : la section 6 du brief la
posait comme préalable — « vérifie que `navigator.share({files})` ouvre bien
WhatsApp sur les téléphones que tes utilisateurs ont vraiment, pas seulement sur
le tien » — et toute la couche de diffusion en dépendait. Le repli du prototype
(copier le texte, appui long sur l'image) reste en place pour les appareils qui
ne savent pas partager de fichier, mais il n'est plus le chemin principal.

La deuxième valide l'invariant § 2.7 sur la cible, et coche un des quatre
critères d'arrêt de la phase 1.

## Où vit le proxy IA — tranché le 9 septembre 2026, revenu au brief le même jour

Le brief le place dans le Worker Cloudflare, au même endroit que le webhook de
paiement et la page de lecture (§ 3.1). Il est d'abord parti en **fonction
Vercel**, parce que l'application y était déjà déployée : l'étage 2 était
joignable le jour même plutôt qu'après une phase 2 complète.

Le déménagement est fait, et il a coûté ce qui était annoncé : **un fichier,
pas une couche**. Tout ce qui décide vit dans `@a237/ia` et
`packages/engine/src/registre.ts`, purs et testés sans réseau ; ce qui a bougé,
c'est l'adaptateur — `worker.ts`, trente lignes — et la façon dont les réglages
arrivent. Ils se lisaient dans `process.env` ; ils arrivent maintenant en
argument, parce qu'un Worker n'a pas de `process` et qu'une lecture au
chargement du module aurait rendu `undefined` partout, sans que rien n'échoue.

Ce qui a décidé du retour au brief : **R2 n'a pas de frais de sortie**. Ce
qu'on sert le plus, ce sont les cartes PNG, puisque l'aperçu WhatsApp est le
tableau de bord. Facturer cette bande passante reviendrait à facturer l'usage
normal du produit. Le détail est dans `docs/03-deploiement.md`.

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

## Les comptes s'écartent du § 3.4 sur quatre points

Le bloc SQL du brief est une illustration, et trois de ses choix ont déjà été
revus ailleurs — le `slug` de quatre caractères est devenu un lien de douze,
pour la même raison qu'une clé de coffre n'a pas quatre chiffres. Voici les
écarts du schéma des comptes, et pourquoi.

**Pas de table `tools`.** Un outil vit sur le téléphone, dans IndexedDB
(§ 2.7), et son instantané publié vit dans KV. Une troisième copie en base ne
serait lue par personne, et il faudrait pourtant la tenir à jour à chaque
modification, hors ligne comprise. On range ce qu'on relit.

**Les noms sont en français**, comme le reste du dépôt (§ 9) : `comptes`,
`appareils`, `paiements`, `appels_ia`. Les plans sont `essai` et `atelier`
plutôt que `trial` et `atelier` — un mot sur deux en anglais dans une base
qu'on lit en français est un mot de trop.

**`ai_calls.kind` devient `appels_ia.etage`.** L'étage est déjà calculé par le
moteur, gratuitement et sans réseau ; il dit la même chose que `'compose' |
'libre'`, et c'est lui qui décide du prix. Deux vocabulaires pour une même
notion finiraient par ne plus se correspondre.

**Le code de récupération n'est pas haché par argon2.** Cette exigence répond à
un mot de passe *choisi par quelqu'un* — quelques dizaines de bits au mieux,
qu'un dérivateur lent rend coûteux à essayer hors ligne. Le code d'ici est tiré
par la machine sur seize lettres d'un alphabet de trente et un, soit près de
quatre-vingts bits : sa force est dans son entropie, pas dans la lenteur du
calcul. Un SHA-256 suffit, n'ajoute aucune dépendance au plafond du § 8, et ne
dépense pas le temps processeur du Worker à chaque récupération.

Un dernier écart, sur l'identité plutôt que sur le schéma : le brief prévoit
`phone TEXT UNIQUE` renseigné au premier paiement, et cette unicité casse un
cas réel — un téléphone perdu, un appareil neuf, un compte neuf, et le même
numéro qui paie de nouveau. Le numéro **suit le compte qui vient de payer** :
il désigne une personne, et il va au compte dont elle se sert aujourd'hui.
L'ancien compte garde son abonnement et ses crédits ; il ne perd que le numéro.

---

## Ce que le modèle a le droit de composer — tranché le 10 septembre 2026

Le point de départ est un défaut rapporté depuis un téléphone : « je veux un
site internet » ne trouvait qu'un refus. Le refus était juste — rien derrière ne
savait faire une page, et un outil qui invente un registre « Ventes » pour cette
demande-là ment. C'est donc ce qu'il refusait qui manquait, pas le refus.

Quatre formes, donc, et le choix se fait sur la demande.

### « Un site » et « une page » sont le même objet

Ce n'est pas une économie, c'est ce qui est juste. Un site, c'est un menu et
plusieurs sujets ; une page sans script n'a pas besoin de plusieurs adresses
pour les porter. Le sommaire saute d'une section à l'autre dans un document
déjà arrivé, ce qui est exactement ce qu'on veut sur une connexion qui
hoquette — un menu qui recharge est un menu qu'on n'ose plus toucher. Le champ
`sommaire` dit simplement laquelle des deux on a demandée.

Neuf demandes de site sur dix, ici, demandent une page à envoyer sur WhatsApp :
un nom, ce qu'on vend, un numéro, des prix, des horaires.

### Un événement est une page datée

Une annonce de mariage, une réunion de tontine, une vente de fin d'année ont un
nom, un lieu, un programme et une phrase — tout ce qu'une vitrine porte déjà. Ce
qu'elles ont en plus est une date, et une date que la machine comprend permet à
la page de dire « dans 3 jours » ou « c'est passé ». Une date écrite dans un
texte libre ne sait rien dire, et une affiche qui garde son air d'urgence après
coup fait traverser la ville pour rien.

Un champ, donc, et non une quatrième forme. Le délai passe devant la date : on
ne lit pas une affiche pour sa date, on la lit pour savoir si on a le temps.

**Ce qui est écrit sans fuseau se lit à Douala.** `new Date('2026-09-12T15:00')`
lit l'heure de la machine, et un Worker vit en UTC : un mariage annoncé à 15 h
s'affichait à 16 h sur la page publiée et à 15 h dans l'aperçu du téléphone qui
l'avait écrite, sans que rien ne dise lequel des deux croire.

### Le formulaire public n'a pas une ligne de script

Ce n'est pas une prouesse, c'est la seule façon que ça marche. Dans le
navigateur intégré de WhatsApp, sur un téléphone d'entrée de gamme, sur une
connexion qui hoquette, un formulaire qui dépend de JavaScript est un formulaire
qui perd des réponses **sans que personne ne le sache** : celui qui remplit
croit avoir envoyé, celui qui attend croit que personne n'a répondu. Le
navigateur sait poster un `<form>` depuis 1995, et il le fait même quand la page
n'a pas fini de charger.

Le prix à payer est réel et on le paie : ce qui manque à une réponse se dit sur
la page, avec ce qui a déjà été tapé perdu. C'est plus honnête qu'une validation
qui laisse partir une réponse vide.

### Un formulaire note son propriétaire, les autres formes non

Publier une page, c'est mettre quelque chose à lire derrière une adresse, et
lire ne demande pas de savoir qui a déposé. Publier un formulaire, c'est ouvrir
une adresse où des inconnus écrivent — et ce qu'ils écrivent doit revenir à
quelqu'un, et à personne d'autre. On ne range que ce qu'on relit.

Le lien appartient à qui l'a tiré : republier dessus depuis un autre appareil ne
le prend pas. Et un appareil qui n'est pas le propriétaire reçoit **404 et non
403** — dire « ce n'est pas à toi » confirmerait à un inconnu que le lien existe
et qu'il reçoit. Un formulaire de tontine n'a pas à se laisser énumérer.

### Trois défenses, et aucune ne demande rien au visiteur

Un champ piège que les robots remplissent, un délai de trente secondes entre
deux envois du même endroit, un plafond par formulaire. Ni image à déchiffrer,
ni case « je ne suis pas un robot » qui charge trois cents kilo-octets de
script — sur la connexion de quelqu'un qui voulait juste dire qu'il vient
samedi.

L'adresse d'une réponse n'est jamais rangée telle quelle, et son empreinte est
**salée par le lien** : sans sel, la même adresse donnerait la même empreinte
partout, et on saurait qu'une même personne a répondu au formulaire de la
tontine et à celui du lycée.

### Le plafond de l'invite se mesure en francs, pas en caractères

Il valait huit mille caractères, choisis quand l'invite portait trois schémas.
En ajouter un quatrième l'a fait passer à neuf mille sept cents, et la question
s'est posée : lever le chiffre, ou renoncer à la page. Aucune des deux n'était
la bonne, parce que le chiffre n'était qu'un intermédiaire. Ce que le brief
plafonne, c'est **un franc la génération** (§ 8).

Où on en est : 0,86 F au pire cas — deux tours, reprise comprise — et de l'ordre
de 0,36 F au premier tour, qui est le cas courant. Chaque forme ajoute son
schéma à chaque appel, y compris aux appels qui n'en ont pas besoin. **Une
cinquième forme ne passera pas**, et la réponse ne sera pas de lever le
plafond : ce sera de router l'invite — reconnaître la famille demandée avant
d'appeler, et n'envoyer que son schéma. On ne l'a pas fait plus tôt parce que se
tromper de famille ferait payer un refus à quelqu'un dont la demande était
faisable, et c'est le plus cher des deux échecs.

### Le schéma sert deux publics, et ne leur dit pas la même chose

Un même schéma dit au modèle quoi remplir **et** dresse le formulaire qui permet
de corriger ce qu'il a rempli. C'est ce qui fait qu'une page composée se
reprend : le contrat qui a servi à l'écrire sert à la modifier, et un champ
ajouté apparaît des deux côtés sans qu'on y pense.

Mais `title` nomme un champ dans un formulaire, et le modèle a la clef sous les
yeux ; `ecran` dit quand montrer un champ et ce que disent ses boutons, et pour
le modèle c'est un mot-clef inconnu au milieu d'un schéma qu'on lui demande de
respecter à la lettre. Ils sont retirés avant l'envoi.

Sous **une seule clef réservée**, et non un mot-clef par réglage : un registre a
une propriété qui s'appelle `libelleAjout`, et un mot-clef d'éditeur du même nom
devenait indiscernable de ce contenu-là.

---

## L'agent — tranché le 10 septembre 2026

Un bouton qui lance une génération et rend un outil marchait. Il a deux défauts,
et le second est le plus grave.

Il ne laisse **aucune place à la deuxième phrase**. Personne ne décrit du
premier coup l'outil qu'il veut : « non, ajoute une colonne pour le mode de
paiement », « enlève les prix », « mets mon numéro » est la vraie façon dont un
outil se fabrique. Avec un bouton, la seule reprise possible est de tout
redemander — et de repayer.

Et il fait attendre huit secondes devant un écran vide. Sur une connexion qui
hoquette, huit secondes deviennent trente, et rien ne dit si ça marche.

### Le modèle rend deux choses à la fois

Un mot pour la personne, et l'outil, dans la même réponse. Le mot vient en
premier parce que le modèle écrit ses clefs dans l'ordre du schéma : il s'écrit
dans la conversation pendant que l'outil se construit à côté. Un second appel
pour la phrase coûterait deux fois.

Il a le **droit de ne rendre que le mot**. Une demande de trois mots ne
contient pas de quoi fabriquer quoi que ce soit, et une question coûte le même
tour qu'un outil inventé — sauf qu'elle, elle sert.

### La fenêtre montre une ébauche, jamais un outil

Ce qui s'y dessine n'a traversé aucun validateur et n'a le droit de rien créer.
L'outil n'existe qu'à la fin, quand la réponse complète est passée par le
moteur. **La frontière du § 2.1 n'a pas bougé d'un pouce** : c'est la même
qu'avec le bouton, à un écran de plus.

Lire du JSON qui n'est pas fini est donc une pièce à part, pure et éprouvée.
Deux règles la gouvernent : on ne devine jamais — une clef commencée est
abandonnée plutôt que remplie — et un aperçu ne recule jamais sur ce qui est
acquis, parce qu'un aperçu qui clignote se lit comme une panne.

Une fois l'outil fini, la fenêtre montre **la chose elle-même** quand elle se
dessine sans état : une page et un formulaire se rendent à partir de leur seule
configuration. Un registre et une calculatrice sont des écrans qu'on remplit ;
leur essence est la liste de leurs colonnes, et c'est déjà ce qui est affiché.

### Le crédit se prend au premier tour, pas à chaque tour

Un outil coûte un crédit ; une conversation en fabrique un. Faire payer chaque
tour la rendrait impossible : quelqu'un qui a cinq essais n'ose pas dire
« ajoute une colonne » si ça lui coûte le cinquième de ce qu'il a.

« C'est la suite d'une conversation » ne se croit pas sur parole. Un compteur de
tours que le navigateur renvoie est un compteur qu'on remet à zéro dans les
outils de développement, et la composition deviendrait gratuite à volonté. Le
serveur signe donc un laissez-passer — le compte, le rang du tour, la
péremption — et refuse ce qui ne porte pas sa signature. Huit tours, après quoi
la conversation n'affine plus, elle tourne.

Un laissez-passer rafistolé n'est pas refusé : il est **traité comme absent**,
ce qui fait payer un crédit. Au bon compte.

### Seul le premier tour a besoin de choisir

C'est ce qui rend une conversation abordable. Le premier tour porte les quatre
schémas ; dès que la famille est connue, les suivants n'emportent que le sien.
Un affinage n'a aucune raison de payer la description d'un formulaire quand on
retouche une page. Mesuré en production : 0,1 à 0,3 F le tour.

C'est aussi le routage que le garde-fou de l'invite réclamait depuis qu'une
quatrième forme y était entrée — obtenu sans jamais risquer de se tromper de
famille, puisque le premier tour les a toutes.

### `/api/ai` et le bouton disparaissent

Garder une route qui dépense de l'argent et que plus rien n'appelle, c'est
garder une route que personne ne maintient. Ce que ses essais couvraient et qui
vit encore a retrouvé des essais à lui : `lireReponseModele` et
`verifierCalcul` en avaient besoin depuis le début et n'étaient éprouvés qu'en
passant.

### Ce que trois vrais deuxièmes tours ont appris

Deux fois sur trois, le modèle répondait en **prose** — « Voilà, j'ai retiré la
date et ajouté la colonne » — sans une accolade. Une conversation qui ressemble
à une conversation fait glisser le modèle dans le registre de la conversation,
et un contrat énoncé une seule fois au début d'un échange qui s'allonge ne pèse
plus assez à la fin.

Cette prose était pire qu'illisible : elle **affirmait** une modification qui
n'était nulle part.

Trois corrections, et aucune n'est une rustine :

- `response_format` était posé sur l'appel d'un seul tenant et oublié sur le
  flux — celui que l'agent emploie, c'est-à-dire le seul qui serve ;
- la forme de la réponse est redite juste avant la question. Ce qui est dit une
  fois au début ne pèse plus assez ; ce qui est dit juste avant pèse ;
- le rappel de l'outil est mis dans la bouche de **la personne**. Posé comme un
  message d'agent, il portait du JSON nu, et le modèle imitait ce qu'il croyait
  être sa propre dernière réponse.

Le journal du serveur dit désormais ce que le modèle a réellement écrit quand
un tour est illisible. Sans lui il fallait deviner — c'est ce qu'on a fait au
premier essai, et on s'est trompé.
