# Établi

Écrire du code sur son téléphone, hors ligne.

Le compagnon de l'atelier, et son contraire sur un point : l'atelier fabrique
des outils pour qui n'écrit pas de code, l'Établi est pour qui veut apprendre.
Ce qu'ils partagent est la contrainte — un Android d'entrée de gamme, un
forfait compté à l'octet, des coupures, et le français.

## Pourquoi pas Replit

Replit demande une connexion permanente, une carte bancaire, et parle anglais.
Ici, aucune des trois n'est acquise. L'Établi tourne **entièrement dans le
navigateur** : le code s'exécute sur l'appareil, dans un cadre isolé, et rien
ne part sur le réseau — ni pour ouvrir un projet, ni pour le lancer, ni pour
le partager.

**Vingt-deux kilo-octets et trois cents**, tout compris : éditeur, exécution,
console, couleur, modèles, dépôt, export, et Python. C'est l'argument, et il
est mesuré à chaque construction par `scripts/budget.mjs`. Les éditeurs qu'on
installe ailleurs pèsent de deux cents kilo-octets à cinq mégaoctets pour la
seule zone de saisie.

## Ce qui est adapté, concrètement

- **La rangée de symboles.** Les accolades sont à trois appuis de profondeur
  sur un clavier Android, derrière deux pages. C'est la vraie raison pour
  laquelle personne ne code sur un téléphone, bien avant la taille de l'écran.
  Ici, un appui.
- **Le clavier ne corrige rien.** Majuscule automatique, correction
  orthographique, complétion et guillemets courbes détruisent du code. Les
  quatre sont coupées sur tout champ de code (`SANS_CORRECTION`).
- **Une console.** Il n'y a ni touche F12 ni outils de développement sur ces
  téléphones. Sans elle, une page blanche est indiscernable d'une page qui
  charge, et quelqu'un qui apprend en conclut qu'il n'y arrive pas.
- **La couleur, sans bibliothèque.** Mots-clefs, chaînes, nombres et
  commentaires se distinguent, en JavaScript, en CSS et en HTML. Ce n'est pas
  de l'agrément : sans couleur, une chaîne jamais fermée ressemble à du code,
  et on cherche l'erreur ailleurs pendant vingt minutes. Coût mesuré :
  **un kilo-octet et six cents**, là où les bibliothèques du métier en
  demandent deux cents.
- **Python, et son prix annoncé avant.** Un interpréteur Python compilé en
  WebAssembly pèse cinq mégaoctets sur le fil. Sur un forfait compté à l'octet,
  ce n'est pas un détail technique, c'est de l'argent. Le chiffre s'affiche
  donc **avant** — dans le bouton lui-même, pour qu'on ne puisse pas appuyer
  sans l'avoir eu sous les yeux. Une seule fois : ensuite Python tourne sans
  réseau du tout.
- **Les lignes se replient.** À l'inverse de tout éditeur de bureau : sur
  390 pixels, du texte sorti par la droite est du texte qu'on croit effacé.
- **Hors ligne d'abord.** Les projets vivent dans IndexedDB. On travaille
  pendant les coupures, dans un taxi, la veille d'un devoir.
- **Un lien qu'on garde, et pas de compte.** « Sauvegarder en ligne et
  partager » dépose le projet et rend un lien. Ce lien le retrouve quand le
  téléphone a disparu, et c'est aussi celui qu'on envoie sur WhatsApp — un
  seul geste pour les deux, parce que c'est le même dépôt.
- **Le partage marche aussi en fichier.** Un seul document HTML autonome, qui
  s'ouvre seul chez celui qui le reçoit, sans réseau du tout.
- **Les exemples parlent d'ici.** Des francs CFA, des prix de quartier — pas
  des dollars.
- **Deux langues, parce que le pays en a deux.** Le français et l'anglais sont
  tous deux officiels au Cameroun, et le Nord-Ouest et le Sud-Ouest sont
  anglophones. Tout bascule : l'interface, les reproches, les modèles — code
  des modèles compris, parce qu'un anglophone devant
  `const bouton = document.getElementById("bouton")` apprend à recopier sans
  comprendre.
- **L'erreur est expliquée, hors ligne.** `Uncaught SyntaxError: Unexpected
  token '{'` ne dit rien à quelqu'un qui apprend. Un dictionnaire d'une
  douzaine de motifs traduit les erreurs courantes en une phrase et un geste,
  sans réseau, sans clef et sans coût. Le message d'origine reste affiché : il
  faudra le reconnaître le jour où on le cherchera ailleurs.

## Le dépôt, et pourquoi il n'a pas de compte

`PUT /api/p/:lien` dépose, `GET /api/p/:lien` relit. C'est la **seule** écriture
venue de l'extérieur dans tout l'Établi, et la seule raison pour laquelle il
touche à un réseau.

Le lien et la clef se tirent **sur l'appareil**, jamais sur le serveur : un
premier dépôt tient donc en un aller simple, sans rien demander à personne.
Créer un compte avant d'avoir écrit trois lignes est exactement la marche que
cet outil existe pour retirer.

Les deux ne voyagent pas ensemble. Le **lien** se partage — c'est son but. La
**clef** autorise à réécrire et ne quitte jamais le téléphone : sans cette
séparation, le premier destinataire pourrait effacer le travail de celui qui le
lui a envoyé. Une écriture sans la bonne clef reçoit `404` et non `403`, pour ne
pas apprendre à qui tâtonne quels liens sont pris.

**Ce qui est déposé n'est jamais servi comme une page.** Le lien ouvre
l'éditeur, qui charge le projet et l'exécute dans le cadre isolé de celui qui
l'ouvre. Servir directement du HTML écrit par un inconnu ferait de cette adresse
un hébergement de pages piégées.

## L'isolement

Le code s'exécute dans une `<iframe sandbox="allow-scripts">`, **sans**
`allow-same-origin`. Il tourne donc dans une origine opaque : aucun accès au
stockage de l'Établi, à ses cookies, ni à son DOM. C'est ce qui rend acceptable
d'ouvrir un projet reçu de quelqu'un d'autre.

Les deux permissions ensemble se neutralisent — le cadre pourrait retirer son
propre bac à sable. Un essai le rend impossible à commettre distraitement, et
un autre vérifie que l'attribut est bien posé sur l'élément rendu.

La console reçoit ses messages par `postMessage`. Le cadre n'ayant pas
d'origine, c'est **l'identité de sa fenêtre** qui est vérifiée, pas l'origine
du message : n'importe quelle page ou extension peut poster ici, et sans cette
vérification leur texte s'afficherait comme s'il venait du code de la personne.

## La couleur, et le blocage qu'elle a failli coûter

Trois balayeurs — un par langage — découpent le texte en jetons, qu'une couche
posée sous la zone de saisie colore. La zone, elle, devient transparente : c'est
le même texte, aux mêmes coordonnées. D'où une seule déclaration de police, de
taille, d'interligne et de marge pour les deux couches : une divergence d'un
pixel décale tout le bas du fichier.

Un balayeur écrit naïvement peut ne pas avancer. `` `a${b}c` `` en mode CSS l'a
fait : le caractère suivant passait le test d'entrée d'un mot mais pas celui de
sa continuation, l'indice restait le même, et la boucle tournait sans fin — sur
un téléphone, l'écran gèle et il faut tuer le navigateur. Aucun délai d'essai ne
rattrape ça : la boucle ne rend jamais la main, donc vitest lui-même ne peut pas
l'interrompre.

`parcourir()` rend le blocage impossible : si un pas n'a pas avancé, le
caractère est pris tel quel et l'indice avance d'un. Le garde-fou est vérifié
par sabotage — on le retire, et la suite d'essais se fige au lieu de signaler
une erreur.

Le dernier saut de ligne, lui, demande une compensation : un `<pre>` ignore le
sien, un `<textarea>` non. La mesure au navigateur a d'abord répondu « aligné »
à tort — le fichier d'essai ne débordait pas, et les deux hauteurs valaient
simplement celle de la boîte. Avec un fichier assez long : 4104 contre 4080,
soit une ligne d'écart. Une mesure qui ne peut pas échouer ne mesure rien.

## Python, et pourquoi il ne coûte le réseau qu'une fois

Le cadre isolé est dans une origine opaque — c'est le prix de l'isolement, et
c'est ce qui rend acceptable d'ouvrir le projet de quelqu'un d'autre. Mais une
origine opaque n'a **pas de stockage** : `caches` et `localStorage` y *lèvent*
une exception, ils ne valent pas `undefined`, ce qui piège toute détection
écrite en `typeof` — le banc d'essai qui a établi ça s'y est cassé le nez
lui-même au premier passage. Ce qu'IndexedDB y garde disparaît avec le cadre.

Le cadre ne peut donc rien retenir. Sans rien faire, chaque « Lancer »
redescendrait cinq mégaoctets. C'est l'Établi qui garde les fichiers, les
vérifie, et les poste au cadre.

Restait à ce que Pyodide accepte de ne pas aller les chercher lui-même. Trois
accroches, trouvées en lisant sa source puis vérifiées **en comptant les
requêtes reçues par un serveur** :

- il ne télécharge `pyodide.asm.js` que `if (typeof _createPyodideModule !=
  "function")` — on le lui injecte en balise, il ne demande rien ;
- `lockFileContents` lui évite d'aller chercher le verrou ;
- le reste passe par `fetch`, qu'on détourne pour ces fichiers-là seulement.

Le détournement de `fetch` seul ne suffisait pas : le compteur montrait
`pyodide.asm.js` demandé deux fois, parce qu'il est chargé par balise et non
par `fetch`. Un mégaoctet à chaque lancement, que personne n'aurait vu passer.
Avec les trois accroches : **zéro requête** au second lancement.

Le prix annoncé n'est pas une constante tapée à la main, et il a fallu trois
tours pour qu'il soit vrai.

Comprimer les fichiers nous-mêmes donnait un chiffre flatteur — quatre
mégaoctets et demi contre cinq — parce qu'on peut choisir le réglage le plus
lent. Prendre celui que la source annonce était mieux, mais la source n'est pas
le serveur qui sert : Cloudflare envoie **5 401 584** octets là où jsDelivr en
annonçait 5 304 678, surtout parce qu'il ne comprime pas le `.zip` du tout. On
annonçait un dixième de mégaoctet de moins que le prix payé.

`--mesurer <origine>` remesure donc après la mise en ligne, sur le serveur qui
sert vraiment, et vérifie chaque empreinte avant d'inscrire une taille. La
mesure passe par `curl` : Cloudflare répond en morceaux, donc sans
`content-length`, et `fetch` décompresse sans jamais dire combien d'octets sont
passés — un premier essai croyait mesurer et rendait onze mégaoctets et demi au
lieu de cinq, son repli s'étant déclenché en silence.

Annoncer moins que le vrai prix est l'erreur que tout ceci existe pour ne pas
commettre. Tant que la remesure n'a pas eu lieu, l'estimation de construction
ne prend jamais le chiffre le plus bas.

Les douze mégaoctets ne sont pas versionnés : `pnpm pyodide` les récupère. Une
installation qui ne l'a pas fait marche exactement comme avant, sans proposer
Python — plutôt qu'avec un bouton qui échoue.

## Ce qui n'y est pas encore

- **Le modèle en renfort.** Le dictionnaire couvre les erreurs courantes ; ce
  qu'il ne connaît pas mériterait un appel au modèle. Ce sera l'étape
  suivante, et elle demandera une clef sur ce projet-ci.
- **Les leçons.** L'éditeur d'abord, sur une base qui marche.

## Lancer

```bash
pnpm --filter @a237/etabli-web dev      # développement
pnpm pyodide                            # les douze mégaoctets de Python
pnpm --filter @a237/etabli-web build    # dist/ et functions/
node scripts/budget.mjs                 # le poids, mesuré et bloquant

# La mise en ligne se lance **depuis apps/etabli**, jamais depuis la racine.
npx wrangler pages deploy dist --cwd apps/etabli --branch main

# Puis remesurer le prix de Python sur le serveur qui le sert vraiment,
# et redéployer le manifeste corrigé.
node scripts/pyodide.mjs --mesurer https://etabli237.pages.dev
pnpm --filter @a237/etabli-web build
npx wrangler pages deploy dist --cwd apps/etabli --branch main
```

`apps/etabli/wrangler.toml` existe pour une raison apprise à ses dépens : lancé
depuis la racine, l'envoi faisait lire le `wrangler.toml` de l'atelier à
wrangler, et le projet de l'Établi s'est retrouvé avec les fonctions de
l'atelier **et ses liaisons** — dont `COMPTES`, la base des comptes et des
paiements. Wrangler prend la configuration la plus proche&nbsp;; celle-ci étant
dans `apps/etabli`, un envoi lancé d'ici ne peut plus attraper celle de la
racine.
