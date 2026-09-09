import type { Encre } from '../types.js'

/**
 * Le curriculum vitæ.
 *
 * Seul document de l'atelier qui ne prouve rien et n'engage personne : il se
 * lit en trente secondes par quelqu'un qui en a quarante autres sur son bureau.
 * Ce qui compte n'est donc pas la conformité mais la lisibilité, et c'est
 * pourquoi il porte quatre gabarits là où une facture n'en porte qu'un.
 */

/** Les quatre mises en page. Le nom dit à qui elles s'adressent. */
export type Gabarit = 'notaire' | 'executif' | 'editorial' | 'bloc'

export const GABARITS: readonly Gabarit[] = ['notaire', 'executif', 'editorial', 'bloc']

/** La langue des intitulés de section — pas celle du contenu. */
export type LangueCv = 'fr' | 'en'

export interface Poste {
  readonly intitule: string
  readonly employeur: string
  readonly periode: string
  readonly points: readonly string[]
}

export interface Diplome {
  readonly intitule: string
  readonly etablissement: string
  readonly annee: string
}

export interface IdentiteCv {
  readonly nom: string
  readonly titre: string
  readonly tel: string
  readonly mail: string
  readonly ville: string
}

export interface EtatCv {
  readonly nom: string
  readonly encre: Encre
  readonly gabarit: Gabarit
  readonly langue: LangueCv
  /** Resserre l'interligne pour faire tenir une carrière longue sur une page. */
  readonly dense: boolean
  readonly identite: IdentiteCv
  readonly resume: string
  readonly postes: readonly Poste[]
  readonly diplomes: readonly Diplome[]
  readonly competences: readonly string[]
  readonly langues: readonly string[]
}

/**
 * Les intitulés de section, dans les deux langues.
 *
 * Le prototype traduisait aussi le contenu — mais il ne pouvait le faire que
 * pour le CV d'exemple qu'il portait en dur. Ici la bascule ne touche que les
 * étiquettes : quelqu'un qui postule à l'international écrit son texte en
 * anglais lui-même, et l'atelier ne prétend pas le traduire.
 */
export const INTITULES: Readonly<Record<LangueCv, Readonly<Record<string, string>>>> = {
  fr: {
    profil: 'Profil',
    experience: 'Expérience professionnelle',
    formation: 'Formation',
    competences: 'Compétences',
    langues: 'Langues',
    contact: 'Contact',
  },
  en: {
    profil: 'Profile',
    experience: 'Experience',
    formation: 'Education',
    competences: 'Skills',
    langues: 'Languages',
    contact: 'Contact',
  },
}

export interface ManqueCv {
  readonly champ: string
  readonly libelle: string
}

/**
 * Ce qui manque à un CV pour être envoyable.
 *
 * Rien ici n'est une obligation légale : un CV ne passe aucun contrôle. Ce sont
 * les quatre choses sans lesquelles un recruteur ne peut rien faire de la
 * feuille — savoir qui écrit, pour quel poste, comment rappeler, et sur quoi
 * juger.
 */
export function controleCv(etat: EtatCv): ManqueCv[] {
  const manques: ManqueCv[] = []
  const id = etat.identite
  if (id.nom.trim() === '') manques.push({ champ: '$.identite.nom', libelle: 'ton nom' })
  if (id.titre.trim() === '') {
    manques.push({ champ: '$.identite.titre', libelle: 'le poste que tu vises' })
  }
  // Un moyen suffit : beaucoup n'ont pas d'adresse mail, personne n'est sans
  // téléphone. Exiger les deux écarterait la moitié des gens.
  if (id.tel.trim() === '' && id.mail.trim() === '') {
    manques.push({ champ: '$.identite.tel', libelle: 'un téléphone ou une adresse mail' })
  }
  if (etat.postes.length === 0 && etat.diplomes.length === 0) {
    manques.push({ champ: '$.postes', libelle: 'au moins une expérience ou un diplôme' })
  }
  return manques
}

/**
 * Le CV tient-il sur une page ?
 *
 * Un compte de signes, pas une mesure : le rendu vrai dépend de la police et du
 * gabarit, et le moteur ne voit pas le navigateur. Le seuil sert à proposer le
 * mode compact avant que la seconde page n'arrive, pas à garantir quoi que ce
 * soit.
 */
export const SIGNES_PAR_PAGE = 2600

export function signesCv(etat: EtatCv): number {
  const lignes = [
    etat.resume,
    ...etat.competences,
    ...etat.langues,
    ...etat.postes.flatMap((p) => [p.intitule, p.employeur, p.periode, ...p.points]),
    ...etat.diplomes.flatMap((d) => [d.intitule, d.etablissement, d.annee]),
  ]
  return lignes.reduce((total, l) => total + l.length, 0)
}

export function debordeUnePage(etat: EtatCv): boolean {
  return signesCv(etat) > (etat.dense ? SIGNES_PAR_PAGE * 1.35 : SIGNES_PAR_PAGE)
}
