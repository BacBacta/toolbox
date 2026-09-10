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
- **Le partage est un fichier.** Un seul document HTML autonome, qui part sur
  WhatsApp comme n'importe quelle pièce jointe et s'ouvre seul chez celui qui
  le reçoit. Pas de compte, pas de lien à héberger, pas de réseau.
- **Les exemples parlent d'ici.** Des francs CFA, des prix de quartier — pas
  des dollars.

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
- **Un lien court à partager.** Le fichier exporté marche aujourd'hui, sans
  serveur. Un lien demanderait de servir du code écrit par n'importe qui, donc
  **une origine séparée** de celle de l'atelier — sans quoi une page piégée
  s'hébergerait à côté des comptes.
- **Les leçons.** L'éditeur d'abord, sur une base qui marche.
- **La coloration syntaxique.** Elle coûte au moins deux cents kilo-octets.
  Le chiffre du budget est ce qu'il faudra mettre en face le jour où on la
  voudra.

## Lancer

```bash
pnpm --filter @a237/etabli-web dev      # développement
pnpm --filter @a237/etabli-web build    # construction, dans apps/etabli/dist
node scripts/budget.mjs                 # le poids, mesuré et bloquant
```
