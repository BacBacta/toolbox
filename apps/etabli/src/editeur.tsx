import type { Fichier, Langue, Projet, Textes } from '@a237/etabli'
import { MAX_FICHIERS, colorer, sorteDuFichier, verifierNomDeFichier } from '@a237/etabli'
import type { JSX } from 'preact'
import { useRef, useState } from 'preact/hooks'

/**
 * Écrire du code sur un téléphone.
 *
 * Il n'y a pas de bibliothèque d'édition ici, et ce n'est pas une économie de
 * bout de chandelle : les deux plus répandues pèsent deux cents kilo-octets et
 * cinq mégaoctets. Sur un forfait compté à l'octet, c'est le prix du repas de
 * midi pour ouvrir un éditeur. Une zone de texte pèse zéro, et sur un écran
 * tactile elle se comporte mieux — la sélection, le curseur et le clavier sont
 * ceux que la personne connaît déjà.
 *
 * Ce qui manquait vraiment sur un téléphone, ce n'est pas la coloration : ce
 * sont les accolades. Elles sont à trois appuis de profondeur sur un clavier
 * Android, derrière deux pages de symboles. La rangée au-dessus du clavier les
 * ramène à un appui, et c'est elle qui rend l'exercice supportable.
 */

/*
 * Les caractères qu'un clavier de téléphone enterre.
 *
 * Choisis en écrivant les trois modèles à la main sur un écran de 360 pixels :
 * ce sont ceux qu'on va chercher, pas ceux qu'on imagine. L'espace se passe de
 * bouton, les lettres aussi.
 */
/**
 * Ce qu'un clavier de téléphone ne doit surtout pas faire à du code.
 *
 * Un clavier Android met une majuscule après chaque point, corrige les mots
 * qu'il ne connaît pas, propose la suite, et remplace les guillemets droits par
 * des courbes. Appliqué à du code, ça donne `Const`, `document.GetElementById`,
 * et des chaînes que le navigateur refuse. La personne voit son travail cassé
 * sans comprendre par quoi — et elle n'a rien fait.
 *
 * Écrit en chaînes et non en booléens : Preact retire un attribut qui vaut
 * `false`, et `spellcheck` ne redeviendrait un attribut que sur les moteurs qui
 * en font une propriété réfléchie. En toutes lettres, il n'y a rien à parier.
 *
 * Un seul endroit, parce que la règle vaut pour toute saisie de code — la zone
 * comme le nom d'un fichier.
 */
const SANS_CORRECTION: Record<string, string> = {
  spellcheck: 'false',
  autocapitalize: 'off',
  autocorrect: 'off',
  autocomplete: 'off',
}

const SYMBOLES = ['{', '}', '(', ')', '[', ']', '<', '>', ';', '=', '"', "'", ':', '.', '/', '_']

export function Editeur(props: {
  readonly projet: Projet
  readonly ouvert: string
  readonly onOuvrir: (nom: string) => void
  readonly onEcrire: (nom: string, contenu: string) => void
  readonly onAjouter: (fichier: Fichier) => void
  readonly langue: Langue
  readonly t: Textes
}): JSX.Element {
  const zone = useRef<HTMLTextAreaElement | null>(null)
  const couche = useRef<HTMLPreElement | null>(null)
  const [nouveau, setNouveau] = useState<string | null>(null)
  const [reproche, setReproche] = useState('')

  const fichier = props.projet.fichiers.find((f) => f.nom === props.ouvert)

  /**
   * Insère au curseur, et rend la main au clavier.
   *
   * Sans le `focus()`, le clavier se referme à chaque symbole : on tape une
   * accolade, l'écran remonte, et il faut retoucher la zone pour continuer.
   * C'est le genre de détail qui fait abandonner au bout de dix minutes.
   */
  function inserer(texte: string): void {
    const z = zone.current
    if (z === null || fichier === undefined) return
    const debut = z.selectionStart
    const fin = z.selectionEnd
    const avant = fichier.contenu.slice(0, debut)
    const apres = fichier.contenu.slice(fin)
    const suite = `${avant}${texte}${apres}`

    /*
     * On pose la valeur et le curseur tout de suite, avant de prévenir le
     * parent.
     *
     * Le faire à la frame suivante marchait *presque* : un humain met plus de
     * seize millisecondes entre deux appuis, donc on ne le voyait pas. Mais le
     * caractère suivant partait où le curseur se trouvait encore — et sur un
     * clavier qui prédit, ou pour quelqu'un qui tape vite, ça donne du code
     * mélangé qu'on ne peut pas s'expliquer. Un essai au navigateur l'a
     * attrapé, en tapant plus vite qu'une main.
     *
     * Le rendu qui suit trouve la même valeur que celle du DOM et n'y touche
     * pas : le curseur reste où on vient de le mettre.
     */
    z.value = suite
    z.setSelectionRange(debut + texte.length, debut + texte.length)
    z.focus()
    props.onEcrire(fichier.nom, suite)
  }

  function ajouter(): void {
    const nom = (nouveau ?? '').trim()
    const probleme = verifierNomDeFichier(nom, props.projet.fichiers.map((f) => f.nom), props.langue)
    if (probleme !== null) {
      setReproche(probleme)
      return
    }
    props.onAjouter({ nom, contenu: '' })
    setNouveau(null)
    setReproche('')
  }

  return (
    <div class="editeur">
      <div class="onglets" role="tablist">
        {props.projet.fichiers.map((f) => (
          <button
            type="button"
            role="tab"
            key={f.nom}
            aria-selected={f.nom === props.ouvert}
            class={f.nom === props.ouvert ? 'onglet actif' : 'onglet'}
            onClick={() => props.onOuvrir(f.nom)}
          >
            {f.nom}
          </button>
        ))}
        {props.projet.fichiers.length < MAX_FICHIERS && (
          <button type="button" class="onglet ajout" onClick={() => setNouveau('')}>
            +
          </button>
        )}
      </div>

      {nouveau !== null && (
        <div class="nouveau-fichier">
          <input
            type="text"
            value={nouveau}
            placeholder={props.t.nomDeFichier}
            {...SANS_CORRECTION}
            onInput={(e) => setNouveau((e.target as HTMLInputElement).value)}
          />
          <button type="button" onClick={ajouter}>{props.t.ajouter}</button>
          <button type="button" class="discret" onClick={() => { setNouveau(null); setReproche('') }}>
            {props.t.annuler}
          </button>
          {reproche !== '' && <p class="reproche">{reproche}</p>}
        </div>
      )}

      {fichier === undefined ? (
        <p class="vide">{props.t.sansFichier}</p>
      ) : (
        <div class="zone-enveloppe">
          {/*
            * La couche colorée est **derrière** la zone de saisie, pas à sa place.
            *
            * Une zone de texte ne sait pas afficher de couleurs, et la remplacer
            * par un élément éditable coûterait la sélection, le curseur et le
            * clavier que la personne connaît — tout ce qui rend l'écriture
            * supportable sur un téléphone. On garde donc la zone, on rend son
            * texte transparent, et on dessine les mêmes caractères en dessous.
            *
            * Les deux doivent se superposer au pixel près : même police, même
            * taille, même hauteur de ligne, même marge, même repli. Une seule
            * différence et le curseur se met à mentir de plus en plus à mesure
            * qu'on descend.
            */}
          <pre ref={couche} class="zone-couleur" aria-hidden="true">
            {colorer(fichier.contenu, sorteDuFichier(fichier.nom)).map((j, n) => (
              // eslint-disable-next-line react/no-array-index-key
              <span key={n} class={`j-${j.sorte}`}>{j.texte}</span>
            ))}
            {/*
              * Un saut de ligne de plus quand le texte finit par un saut de ligne.
              *
              * Une zone de texte réserve une ligne au curseur après le dernier
              * saut ; un `<pre>` n'en dessine pas. Mesuré dans un vrai
              * navigateur : sur un fichier qui déborde, la zone faisait
              * 4 104 pixels et la couche 4 080 — vingt-quatre pixels, soit
              * exactement une ligne, et le décalage s'accumulait en défilant.
              *
              * Le premier relevé disait « alignées » parce que le fichier ne
              * débordait pas : les deux `scrollHeight` valaient alors la hauteur
              * de la boîte, et la mesure ne mesurait rien.
              */}
            {fichier.contenu.endsWith('\n') ? '\n' : ''}
          </pre>
          <textarea
            ref={zone}
            class="zone"
            value={fichier.contenu}
            onInput={(e) => props.onEcrire(fichier.nom, (e.target as HTMLTextAreaElement).value)}
            onScroll={(e) => {
              /*
               * La couche colorée suit la zone : elles défilent ensemble ou pas
               * du tout.
               *
               * Par référence, et non par voisinage dans le DOM :
               * `previousElementSibling` marcherait aujourd'hui et cesserait
               * sans bruit le jour où quelqu'un glisserait un élément entre
               * les deux — les couleurs se figeraient pendant que le texte
               * défile, sans rien casser d'assez visible pour qu'un essai le
               * rattrape.
               */
              const dessous = couche.current
              if (dessous === null) return
              dessous.scrollTop = (e.target as HTMLTextAreaElement).scrollTop
              dessous.scrollLeft = (e.target as HTMLTextAreaElement).scrollLeft
            }}
            aria-label={props.t.contenuDe(fichier.nom)}
            data-sorte={sorteDuFichier(fichier.nom)}
            {...SANS_CORRECTION}
            /*
             * Le texte revient à la ligne, contrairement à tout éditeur de code.
             *
             * Un éditeur de bureau ne replie pas : la structure se lit mieux, et
             * il reste de la largeur pour aller voir la fin d'une ligne. Sur
             * trois cent quatre-vingt-dix pixels il n'en reste pas : une capture
             * d'écran de cet éditeur montrait `<button id="bouton">Appuie
             * ici</button>` coupé net au bord droit. Du texte qu'on ne voit pas
             * est pire qu'une indentation en escalier — surtout pour quelqu'un
             * qui apprend, et qui ne sait pas encore qu'il faut faire défiler.
             */
            wrap="soft"
          />
        </div>
      )}

      <div class="symboles" aria-label={props.t.rangeeSymboles}>
        {SYMBOLES.map((s) => (
          <button
            type="button"
            key={s}
            class="symbole"
            /* Empêche la zone de perdre le focus : le clavier resterait fermé. */
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => inserer(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
