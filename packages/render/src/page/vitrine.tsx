import type { PageDemande, SectionDemandee } from '@a237/engine'
import { avecSommaire, lienWhatsApp, sectionsAncrees } from '@a237/engine'
import type { JSX } from 'preact'

/**
 * Une page composée, dessinée à la main.
 *
 * C'est le même composant qui sert l'aperçu dans l'application et la page
 * publiée sur le serveur. Deux dessins pour une même configuration finiraient
 * par ne plus montrer la même chose, et c'est celui que le client voit qui
 * aurait tort.
 *
 * Il n'y a **aucun script** : ni ici, ni dans ce que le modèle a le droit
 * d'écrire. Une page composée ne peut pas en contenir, parce qu'aucun champ du
 * contrat n'en accepte — l'invariant § 2.1 tient par la forme du contrat, pas
 * par un filtre qu'on pourrait oublier.
 */

function Lignes(props: { readonly section: SectionDemandee }): JSX.Element {
  const lignes = props.section.lignes ?? []
  const prix = props.section.sorte === 'prix'
  return (
    <ul class={prix ? 'vitrine-prix' : 'vitrine-liste'}>
      {lignes.map((l) => (
        <li key={l.nom}>
          <span class="quoi">
            <b>{l.nom}</b>
            {l.detail !== undefined && l.detail !== '' && <span class="detail">{l.detail}</span>}
          </span>
          {l.valeur !== undefined && l.valeur !== '' && <span class="combien">{l.valeur}</span>}
        </li>
      ))}
    </ul>
  )
}

export function PageVitrine(props: { readonly page: PageDemande }): JSX.Element {
  const p = props.page
  /*
   * Le sommaire : c'est tout ce que « un site » ajoute à « une page ».
   *
   * Ce sont des ancres, pas des adresses. Sur une connexion qui hoquette, un
   * menu qui recharge est un menu qu'on n'ose plus toucher ; celui-ci saute
   * dans un document déjà arrivé, et il marche sans une ligne de script.
   */
  const sections = sectionsAncrees(p.sections)
  const sommaire = avecSommaire(p)
  /*
   * Le numéro devient un lien `wa.me` — gratuit, sans compte, sans validation
   * (§ 6). C'est le bouton qui rapporte : quelqu'un qui lit la page et veut
   * acheter ne doit pas avoir à recopier dix chiffres.
   */
  const message = `Bonjour ${p.titre}, j’ai vu votre page.`
  const whatsapp =
    p.telephone === undefined || p.telephone === '' ? null : lienWhatsApp(p.telephone, message)

  return (
    <article class="vitrine">
      <header class="vitrine-tete">
        <p class="kicker">{p.kicker}</p>
        <h1>{p.titre}</h1>
        <p class="accroche">{p.accroche}</p>
      </header>

      {sommaire && (
        <nav class="vitrine-sommaire" aria-label="Sections">
          {sections.map(({ section, ancre }) => (
            <a href={`#${ancre}`} key={ancre}>
              {section.titre}
            </a>
          ))}
        </nav>
      )}

      {sections.map(({ section, ancre }) => (
        <section class="vitrine-section" key={ancre} id={sommaire ? ancre : undefined}>
          <h2>{section.titre}</h2>
          {section.sorte === 'texte' ? (
            /*
             * Les paragraphes se coupent sur les sauts de ligne, et rien
             * d'autre : pas de balisage, donc rien à interpréter.
             */
            (section.texte ?? '')
              .split('\n')
              .filter((bout) => bout.trim() !== '')
              .map((bout) => <p key={bout}>{bout}</p>)
          ) : (
            <Lignes section={section} />
          )}
        </section>
      ))}

      {(whatsapp !== null ||
        (p.adresse !== undefined && p.adresse !== '') ||
        (p.horaires !== undefined && p.horaires !== '')) && (
        <footer class="vitrine-pied">
          {whatsapp !== null && (
            <a class="vitrine-appel" href={whatsapp} rel="noreferrer">
              Écrire sur WhatsApp
              <span>{p.telephone}</span>
            </a>
          )}
          {p.adresse !== undefined && p.adresse !== '' && (
            <p class="vitrine-ou">
              <span class="etiquette">Où</span>
              {p.adresse}
            </p>
          )}
          {p.horaires !== undefined && p.horaires !== '' && (
            <p class="vitrine-ou">
              <span class="etiquette">Quand</span>
              {p.horaires}
            </p>
          )}
        </footer>
      )}
    </article>
  )
}
