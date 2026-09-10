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

**Onze kilo-octets et huit cents**, tout compris : éditeur, exécution, console,
modèles, export. C'est l'argument, et il est mesuré à chaque construction par
`scripts/budget.mjs`. Les éditeurs qu'on installe ailleurs pèsent de deux
cents kilo-octets à cinq mégaoctets pour la seule zone de saisie.

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

## Ce qui n'y est pas encore

- **Python.** Prévu via Pyodide, mais c'est six mégaoctets à télécharger. Ça ne
  peut pas être dans la coquille : ce sera un choix explicite, avec le prix en
  mégaoctets annoncé avant.
- **Le modèle en renfort.** Le dictionnaire couvre les erreurs courantes ; ce
  qu'il ne connaît pas mériterait un appel au modèle. Ce sera l'étape
  suivante, et elle demandera une clef sur ce projet-ci.
- **Les leçons.** L'éditeur d'abord, sur une base qui marche.
- **La coloration syntaxique.** Elle coûte au moins deux cents kilo-octets.
  Le chiffre du budget est ce qu'il faudra mettre en face le jour où on la
  voudra.

## Lancer

```bash
pnpm --filter @a237/etabli-web dev      # développement
pnpm --filter @a237/etabli-web build    # dist/ et functions/
node scripts/budget.mjs                 # le poids, mesuré et bloquant

# La mise en ligne se lance **depuis apps/etabli**, jamais depuis la racine.
npx wrangler pages deploy dist --cwd apps/etabli --branch main
```

`apps/etabli/wrangler.toml` existe pour une raison apprise à ses dépens : lancé
depuis la racine, l'envoi faisait lire le `wrangler.toml` de l'atelier à
wrangler, et le projet de l'Établi s'est retrouvé avec les fonctions de
l'atelier **et ses liaisons** — dont `COMPTES`, la base des comptes et des
paiements. Wrangler prend la configuration la plus proche&nbsp;; celle-ci étant
dans `apps/etabli`, un envoi lancé d'ici ne peut plus attraper celle de la
racine.
