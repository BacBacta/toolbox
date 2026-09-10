import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { partageDePage, schemaPage, verifierPage } from '@a237/engine';
import { PageVitrine } from '@a237/render/page';
/*
 * La feuille de la vitrine entre avec ce fragment, et non dans la coquille :
 * elle ne sert qu'à cet écran, et le budget de 120 Ko du § 8 se tient en ne
 * chargeant pas ce qu'on n'ouvre pas. Vite pose le lien au chargement du
 * fragment.
 */
import '@a237/render/styles/vitrine.css';
import { Action, Actions, CoquilleOutil } from '@a237/render/registre';
import { useState } from 'preact/hooks';
import { ChampsSchema } from '../formulaire.js';
import { EtatInvalide } from './commun.js';
/**
 * L'écran d'une page composée.
 *
 * Un registre a un squelette d'un côté et un état de l'autre : la
 * configuration ne bouge pas, les lignes s'ajoutent. Une page n'a pas cette
 * séparation — **ce qu'on modifie est exactement ce qui se publie**. Son écran
 * est donc l'éditeur et l'aperçu, et rien entre les deux.
 *
 * L'aperçu n'est pas une approximation : c'est `PageVitrine`, le composant que
 * le serveur emploie pour la page publiée. Deux dessins pour une même
 * configuration finiraient par ne plus montrer la même chose, et c'est celui
 * que le client voit qui aurait tort.
 *
 * Le formulaire se déduit de `schemaPage` — le même schéma que le modèle
 * remplit. C'est ce qui fait qu'une page composée se corrige : le contrat qui
 * a servi à l'écrire sert à la reprendre, et un champ ajouté au contrat
 * apparaît des deux côtés sans qu'on y pense.
 */
const ONGLETS = ['Aperçu', 'Modifier'];
/**
 * Une page toute neuve, quand on en ouvre une sans que le modèle en ait écrit.
 *
 * Elle **passe son propre contrôle**, et ce n'est pas une évidence : sa
 * première version ouvrait sur une ligne de liste vide, que `verifierPage`
 * refuse à juste titre — un outil qui s'ouvre sur l'écran d'erreur de son
 * propre validateur n'est pas un outil. Une section de texte, elle, tient
 * debout avec une phrase, et cette phrase dit quoi faire.
 */
export const PAGE_VIDE = {
    titre: 'Ma page',
    kicker: 'MA PAGE',
    accroche: 'Dis ici ce que tu fais, en une phrase.',
    sections: [
        {
            titre: 'Ce que je propose',
            sorte: 'texte',
            texte: 'Écris ici ce que tu vends ou ce que tu fais.',
        },
    ],
};
export function Outil(props) {
    const [onglet, setOnglet] = useState('Aperçu');
    const erreurs = verifierPage(props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    const page = props.outil.etat;
    return (_jsx(CoquilleOutil, { titre: page.titre, glyphe: props.glyphe, sousTitre: page.kicker, 
        /*
         * Aucun indicateur : une vitrine ne totalise rien, et un compteur de
         * sections dirait ce que l'aperçu montre déjà mieux.
         */
        kpis: [], onglets: ONGLETS, ongletCourant: onglet, onOnglet: setOnglet, children: onglet === 'Aperçu' ? (_jsxs(_Fragment, { children: [_jsx("div", { class: "page-apercu", children: _jsx(PageVitrine, { page: page, maintenant: props.ctx.maintenant }) }), _jsx(Actions, { children: _jsx(Action, { principale: true, onClick: () => props.onDiffuser((c) => partageDePage(page, c)), children: "Publier et partager" }) })] })) : (_jsx(ChampsSchema, { schema: schemaPage, valeur: page, onChange: (v) => props.onChange(v), 
            /*
             * Le sommaire ne se règle pas à la main : il n'a de sens qu'à partir
             * de trois sections, et une case à cocher qui ne change rien à
             * l'écran fait douter de tout le reste. C'est la demande qui le
             * décide, et l'aperçu qui le montre.
             */
            masques: ['$.sommaire'] })) }));
}
export function creer(_skeleton, _maintenant, _extrait, compose) {
    const page = compose?.page ?? PAGE_VIDE;
    return { nom: page.titre, etat: page };
}
