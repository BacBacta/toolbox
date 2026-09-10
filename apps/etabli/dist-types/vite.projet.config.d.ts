/**
 * `GET` et `PUT /api/p/:lien`, assemblés en un fichier.
 *
 * Pages tire ses routes du **nom des fichiers** : `api/p/[lien].js` répond à
 * `/api/p/n'importe quoi` et donne le segment dans `params.lien`. Or Rollup
 * assainit les crochets d'un nom de sortie — le fichier sortirait `_lien_.js`,
 * qui ne répondrait qu'à `/api/p/_lien_`. Le dépôt aurait alors rendu 404
 * partout, et la construction, elle, aurait réussi. Même piège que la page de
 * lecture de l'atelier, même parade : on sort sous un nom neutre et on le remet
 * en place après coup.
 *
 * Ces fonctions vivent sous `apps/etabli/`, et surtout pas dans le `functions/`
 * de la racine : celui-là appartient à l'atelier, et les mélanger a déjà mis
 * les liaisons de l'atelier — dont la base des comptes — sur le projet de
 * l'Établi.
 */
declare const _default: import("vite").UserConfig;
export default _default;
