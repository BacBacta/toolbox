import type { Diplome, EtatCv, LangueCv, Poste } from '@a237/engine'
import { INTITULES } from '@a237/engine'
import type { JSX } from 'preact'
import { NumeroPage, PageA4, Paragraphes } from './chrome.js'

/**
 * Le CV sur A4, en quatre gabarits.
 *
 * Quatre mises en page pour un seul contenu : c'est le seul document de
 * l'atelier où la forme est l'enjeu. Une facture se lit parce qu'il le faut ;
 * un CV se lit parce qu'il donne envie, et un magasinier qui postule à la
 * mairie n'envoie pas la même feuille qu'un graphiste qui postule en agence.
 *
 * Aucun n'emprunte à `chrome.tsx` autre chose que la feuille et le numéro de
 * page : l'entête légal, le bloc client et les zones de signature n'ont rien à
 * faire ici.
 *
 * Aucun ne réserve de place pour une photo. Le prototype dessinait un carré
 * portant le mot « photo » : à l'écran c'est une intention, à l'impression
 * c'est un carré vide marqué « photo » sur la feuille qu'on tend à un
 * employeur. Tant que l'atelier ne sait pas stocker une image, il vaut mieux
 * ne rien promettre.
 */

/** Les puces d'un poste. Une ligne vide ne laisse pas de puce orpheline. */
function Faits(props: { readonly points: readonly string[] }): JSX.Element {
  return (
    <>
      {props.points
        .filter((p) => p.trim() !== '')
        .map((p, i) => (
          <div class="cv-fait" key={`${i}-${p.slice(0, 12)}`}>
            {p}
          </div>
        ))}
    </>
  )
}

/**
 * La date d'une entrée : en marge dans le gabarit éditorial, sur la même ligne
 * que l'employeur partout ailleurs.
 *
 * C'est la seule différence de structure entre les gabarits en dehors de la
 * bande latérale du gabarit « bloc ». Mettre l'employeur en marge avec la date,
 * comme on l'a d'abord fait, y produit un pavé ferré à droite sur trois lignes
 * en face d'un titre d'une seule.
 */
function Marge(props: { readonly quand: string; readonly enMarge: boolean }): JSX.Element | null {
  if (!props.enMarge || props.quand.trim() === '') return null
  return <div class="cv-marge">{props.quand}</div>
}

function ligneOu(qui: string, quand: string, enMarge: boolean, separateur: string): string {
  return [qui, enMarge ? '' : quand].filter((s) => s.trim() !== '').join(` ${separateur} `)
}

function Diplomes(props: {
  readonly diplomes: readonly Diplome[]
  readonly enMarge: boolean
  readonly separateur: string
}): JSX.Element {
  return (
    <>
      {props.diplomes.map((d, i) => (
        <div class="cv-item" key={`${i}-${d.intitule}`}>
          <Marge quand={d.annee} enMarge={props.enMarge} />
          <div class="cv-quoi">{d.intitule}</div>
          <div class="cv-ou">
            {ligneOu(d.etablissement, d.annee, props.enMarge, props.separateur)}
          </div>
        </div>
      ))}
    </>
  )
}

function Postes(props: {
  readonly postes: readonly Poste[]
  readonly enMarge: boolean
  readonly separateur: string
}): JSX.Element {
  return (
    <>
      {props.postes.map((p, i) => (
        <div class="cv-item" key={`${i}-${p.intitule}`}>
          <Marge quand={p.periode} enMarge={props.enMarge} />
          <div class="cv-quoi">{p.intitule}</div>
          <div class="cv-ou">
            {ligneOu(p.employeur, p.periode, props.enMarge, props.separateur)}
          </div>
          <Faits points={p.points} />
        </div>
      ))}
    </>
  )
}

/** Le titre d'une section. Rien ne s'affiche si la section est vide. */
function Section(props: {
  readonly titre: string
  readonly vide: boolean
  readonly children: JSX.Element | readonly JSX.Element[]
}): JSX.Element | null {
  if (props.vide) return null
  return (
    <>
      <h4 class="cv-section">{props.titre}</h4>
      {props.children}
    </>
  )
}

/** Le profil, écrit en paragraphes comme partout ailleurs dans l'atelier. */
function Profil(props: { readonly texte: string; readonly titre: string }): JSX.Element | null {
  if (props.texte.trim() === '') return null
  return (
    <>
      <h4 class="cv-section">{props.titre}</h4>
      <div class="cv-profil">
        <Paragraphes texte={props.texte} />
      </div>
    </>
  )
}

function Contact(props: { readonly id: EtatCv['identite'] }): JSX.Element {
  const parts = [props.id.tel, props.id.mail, props.id.ville].filter((s) => s.trim() !== '')
  return <div class="cv-contact">{parts.join(' · ')}</div>
}

function motsDe(langue: LangueCv): Readonly<Record<string, string>> {
  return INTITULES[langue]
}

export function DocumentCv(props: { readonly etat: EtatCv }): JSX.Element {
  const etat = props.etat
  const t = motsDe(etat.langue)
  const id = etat.identite
  const classes = `a4-cv ${etat.gabarit}${etat.dense ? ' dense' : ''}`

  // L'éditorial range la date en marge ; les trois autres la mettent en ligne.
  const enMarge = etat.gabarit === 'editorial'
  const separateur = etat.gabarit === 'notaire' ? '—' : '·'
  const experience = (
    <Section titre={t.experience!} vide={etat.postes.length === 0}>
      <Postes postes={etat.postes} enMarge={enMarge} separateur={separateur} />
    </Section>
  )
  const formation = (
    <Section titre={t.formation!} vide={etat.diplomes.length === 0}>
      <Diplomes diplomes={etat.diplomes} enMarge={enMarge} separateur={separateur} />
    </Section>
  )

  // Le gabarit « bloc » range le contact et les listes dans une bande
  // latérale ; les trois autres empilent tout sur une colonne. C'est la seule
  // différence de structure — le reste n'est que du CSS.
  if (etat.gabarit === 'bloc') {
    return (
      <PageA4 encre={etat.encre}>
        <div class={classes}>
          <aside class="cv-bande">
            <div class="cv-nom">{id.nom}</div>
            <div class="cv-titre">{id.titre}</div>
            <Section titre={t.contact!} vide={false}>
              <>
                {[id.tel, id.mail, id.ville]
                  .filter((s) => s.trim() !== '')
                  .map((s) => (
                    <div class="cv-ligne" key={s}>
                      {s}
                    </div>
                  ))}
              </>
            </Section>
            <Section titre={t.competences!} vide={etat.competences.length === 0}>
              <>
                {etat.competences.map((c) => (
                  <div class="cv-ligne" key={c}>
                    {c}
                  </div>
                ))}
              </>
            </Section>
            <Section titre={t.langues!} vide={etat.langues.length === 0}>
              <>
                {etat.langues.map((l) => (
                  <div class="cv-ligne" key={l}>
                    {l}
                  </div>
                ))}
              </>
            </Section>
          </aside>
          <div class="cv-principal">
            <Profil texte={etat.resume} titre={t.profil!} />
            {experience}
            {formation}
          </div>
        </div>
        <NumeroPage page={1} total={1} />
      </PageA4>
    )
  }

  return (
    <PageA4 encre={etat.encre}>
      <div class={classes}>
        <header class="cv-tete">
          <div class="cv-nom">{id.nom}</div>
          <div class="cv-titre">{id.titre}</div>
          <Contact id={id} />
        </header>

        <Profil texte={etat.resume} titre={t.profil!} />
        {experience}
        {formation}

        <Section titre={t.competences!} vide={etat.competences.length === 0}>
          <div class="cv-serie">{etat.competences.join(' · ')}</div>
        </Section>
        <Section titre={t.langues!} vide={etat.langues.length === 0}>
          <div class="cv-serie">{etat.langues.join(' · ')}</div>
        </Section>
      </div>
      <NumeroPage page={1} total={1} />
    </PageA4>
  )
}
