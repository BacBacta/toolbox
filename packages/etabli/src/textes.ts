import type { Langue } from './expliquer.js'

/**
 * Tout ce que l'Établi dit, dans les deux langues du pays.
 *
 * Le français et l'anglais sont tous deux officiels au Cameroun, et le
 * Nord-Ouest et le Sud-Ouest sont anglophones. Un outil d'apprentissage qui ne
 * parle qu'une des deux en exclut une partie — et ce n'est pas une partie qu'on
 * choisit d'exclure.
 *
 * Tout est ici, et pas dispersé dans les composants : c'est la seule façon
 * qu'un essai puisse vérifier qu'aucune phrase n'existe dans une langue et pas
 * dans l'autre. Une interface à moitié traduite est pire qu'une interface qui
 * ne l'est pas — on croit que le reste va suivre.
 */

export interface Textes {
  readonly accroche: string
  readonly unInstant: string
  readonly projetDisparu: string
  readonly commencer: string
  readonly tesProjets: string
  readonly fichiers: (combien: number) => string
  readonly effacer: (nom: string) => string

  readonly ouvertureEnCours: string
  readonly lienMort: string
  readonly lienIllisible: string

  readonly mesProjets: string
  readonly lancer: string
  readonly ecrire: string
  readonly relancer: string
  readonly exporter: string

  readonly nomDeFichier: string
  readonly ajouter: string
  readonly annuler: string
  readonly sansFichier: string
  readonly contenuDe: (nom: string) => string
  readonly rangeeSymboles: string

  readonly cadreTitre: string
  readonly console: string
  readonly erreurs: (combien: number) => string
  readonly consoleVide: string
  readonly consoleVideExemple: string

  readonly sauvegarder: string
  readonly mettreAJour: string
  readonly envoiEnCours: string
  readonly gardeCeLien: string
  readonly copier: string
  readonly copie: string
  readonly surWhatsApp: string
  readonly pasDeReseau: string
  readonly partageEchoue: string

  readonly langue: string
}

const FR: Textes = {
  accroche: 'Écris du code, ici, sans réseau.',
  unInstant: 'Un instant…',
  projetDisparu: 'Ce projet n’existe plus.',
  commencer: 'Commencer',
  tesProjets: 'Tes projets',
  fichiers: (n) => `${n} fichier${n > 1 ? 's' : ''}`,
  effacer: (nom) => `Effacer ${nom}`,

  ouvertureEnCours: 'On ouvre le projet reçu…',
  lienMort: 'Ce lien n’existe plus. Demande à celui qui te l’a envoyé de le repartager.',
  lienIllisible: 'Ce lien n’a pas pu être ouvert. Vérifie ton réseau et réessaie.',

  mesProjets: '← Mes projets',
  lancer: '▶ Lancer',
  ecrire: 'Écrire',
  relancer: '⟳ Relancer',
  exporter: 'Exporter en un fichier',

  nomDeFichier: 'page.html',
  ajouter: 'Ajouter',
  annuler: 'Annuler',
  sansFichier: 'Ce projet n’a pas encore de fichier.',
  contenuDe: (nom) => `Contenu de ${nom}`,
  rangeeSymboles: 'Caractères du clavier',

  cadreTitre: 'Ton code en train de tourner',
  console: 'Console',
  erreurs: (n) => `${n} erreur${n > 1 ? 's' : ''}`,
  consoleVide: 'Rien pour l’instant. Écris',
  consoleVideExemple: 'pour voir.',

  sauvegarder: 'Sauvegarder en ligne et partager',
  mettreAJour: 'Mettre à jour le lien',
  envoiEnCours: 'Envoi…',
  gardeCeLien: 'Garde ce lien : il retrouve ton projet même si tu perds ce téléphone.',
  copier: 'Copier',
  copie: 'Copié',
  surWhatsApp: 'Envoyer sur WhatsApp',
  pasDeReseau: 'Pas de réseau. Ton projet est en sécurité sur ce téléphone ; réessaie quand ça revient.',
  partageEchoue: 'Le partage a échoué. Réessaie tout à l’heure.',

  langue: 'English',
}

const EN: Textes = {
  accroche: 'Write code, right here, with no network.',
  unInstant: 'One moment…',
  projetDisparu: 'This project no longer exists.',
  commencer: 'Start here',
  tesProjets: 'Your projects',
  fichiers: (n) => `${n} file${n > 1 ? 's' : ''}`,
  effacer: (nom) => `Delete ${nom}`,

  ouvertureEnCours: 'Opening the project you received…',
  lienMort: 'This link no longer exists. Ask whoever sent it to share it again.',
  lienIllisible: 'This link could not be opened. Check your network and try again.',

  mesProjets: '← My projects',
  lancer: '▶ Run',
  ecrire: 'Write',
  relancer: '⟳ Run again',
  exporter: 'Export as one file',

  nomDeFichier: 'page.html',
  ajouter: 'Add',
  annuler: 'Cancel',
  sansFichier: 'This project has no file yet.',
  contenuDe: (nom) => `Contents of ${nom}`,
  rangeeSymboles: 'Keyboard characters',

  cadreTitre: 'Your code, running',
  console: 'Console',
  erreurs: (n) => `${n} error${n > 1 ? 's' : ''}`,
  consoleVide: 'Nothing yet. Write',
  consoleVideExemple: 'to see it here.',

  sauvegarder: 'Save online and share',
  mettreAJour: 'Update the link',
  envoiEnCours: 'Sending…',
  gardeCeLien: 'Keep this link: it finds your project again even if you lose this phone.',
  copier: 'Copy',
  copie: 'Copied',
  surWhatsApp: 'Send on WhatsApp',
  pasDeReseau: 'No network. Your project is safe on this phone; try again when it comes back.',
  partageEchoue: 'Sharing failed. Try again in a moment.',

  langue: 'Français',
}

const TOUS: Readonly<Record<Langue, Textes>> = { fr: FR, en: EN }

export function textes(langue: Langue): Textes {
  return TOUS[langue]
}
