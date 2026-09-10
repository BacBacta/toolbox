import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { dateCourte, heureCourte, schemaFormulaire, verifierFormulaire } from '@a237/engine';
import { PageFormulaire } from '@a237/render/page';
import { Action, Actions, CoquilleOutil } from '@a237/render/registre';
import '@a237/render/styles/vitrine.css';
import { useEffect, useState } from 'preact/hooks';
import { ChampsSchema } from '../formulaire.js';
import { dernieresConnues, rafraichir } from '../reponses.js';
import { EtatInvalide } from './commun.js';
/**
 * L'écran d'un formulaire composé.
 *
 * Comme la page, ce qu'on modifie est ce qui se publie. Ce qu'il a en plus est
 * un troisième onglet : **les réponses**. C'est tout l'intérêt de l'outil —
 * aujourd'hui, ramasser quinze commandes se fait par quinze messages WhatsApp
 * qu'il faut recopier à la main dans un cahier.
 *
 * Les réponses sont gardées sur l'appareil dès qu'elles sont lues : un traiteur
 * doit pouvoir relire ses commandes dans son taxi. Le réseau sert à en chercher
 * de nouvelles, pas à consulter celles qu'on a déjà.
 */
const ONGLETS = ['Réponses', 'Aperçu', 'Modifier'];
/** Un formulaire tout neuf, qui passe son propre contrôle. */
export const FORMULAIRE_VIDE = {
    titre: 'Mon formulaire',
    kicker: 'MON FORMULAIRE',
    accroche: 'Dis ici ce que tu demandes, et jusqu’à quand on peut répondre.',
    champs: [{ clef: 'nom', titre: 'Ton nom', sorte: 'texte', obligatoire: true }],
    bouton: 'Envoyer',
    merci: 'C’est bien reçu, merci.',
};
export function Outil(props) {
    const [onglet, setOnglet] = useState('Réponses');
    const erreurs = verifierFormulaire(props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    const formulaire = props.outil.etat;
    return (_jsxs(CoquilleOutil, { titre: formulaire.titre, glyphe: props.glyphe, sousTitre: formulaire.kicker, kpis: [], onglets: ONGLETS, ongletCourant: onglet, onOnglet: setOnglet, children: [onglet === 'Réponses' && _jsx(Recu, { formulaire: formulaire, lien: props.outil.lien }), onglet === 'Aperçu' && (_jsxs(_Fragment, { children: [_jsx("div", { class: "page-apercu", children: _jsx(PageFormulaire, { formulaire: formulaire }) }), _jsx(Actions, { children: _jsx(Action, { principale: true, onClick: () => props.onDiffuser((c) => partage(formulaire, c)), children: "Publier et partager" }) })] })), onglet === 'Modifier' && (_jsx(ChampsSchema, { schema: schemaFormulaire, valeur: formulaire, onChange: (v) => props.onChange(v) }))] }));
}
/**
 * Ce que le formulaire a reçu.
 *
 * Il montre d'abord ce qu'on avait — instantanément, hors ligne — puis va
 * chercher la suite. L'ordre compte : un écran qui attend le réseau avant de
 * montrer quoi que ce soit est un écran vide sur une connexion qui hoquette,
 * et un écran vide se lit « personne n'a répondu ».
 */
function Recu(props) {
    const lien = props.lien;
    const [recolte, setRecolte] = useState(null);
    const [enCours, setEnCours] = useState(false);
    useEffect(() => {
        if (lien === undefined)
            return;
        let vivant = true;
        void dernieresConnues(lien).then((r) => {
            if (vivant)
                setRecolte(r);
        });
        setEnCours(true);
        void rafraichir(lien, new Date()).then((r) => {
            if (!vivant)
                return;
            setRecolte(r);
            setEnCours(false);
        });
        return () => {
            vivant = false;
        };
    }, [lien]);
    if (lien === undefined) {
        return (_jsx("p", { class: "note", children: "Ce formulaire n\u2019est pas encore publi\u00E9. Ouvre l\u2019aper\u00E7u et partage-le : les r\u00E9ponses arriveront ici." }));
    }
    const reponses = recolte?.reponses ?? [];
    return (_jsxs(_Fragment, { children: [recolte?.horsLigne === true && (_jsxs("p", { class: "note", children: ["Pas de r\u00E9seau : voici les ", reponses.length === 0 ? 'réponses' : `${reponses.length}`, ' ', reponses.length === 0 ? '' : 'réponses ', "d\u00E9j\u00E0 rapport\u00E9es. Il y en a peut-\u00EAtre de nouvelles."] })), reponses.length > 0 && (_jsx("p", { class: "reponses-compte", children: reponses.length === 1 ? '1 réponse' : `${reponses.length} réponses` })), reponses.length === 0 ? (_jsx("p", { class: "note", children: enCours && recolte === null
                    ? 'Je regarde…'
                    : 'Personne n’a encore répondu. Renvoie le lien : c’est souvent tout ce qu’il manque.' })) : (_jsx("div", { class: "reponses", children: reponses.map((r) => (_jsx(UneReponse, { formulaire: props.formulaire, reponse: r }, r.recuLe))) }))] }));
}
function UneReponse(props) {
    const quand = new Date(props.reponse.recuLe);
    return (_jsxs("article", { class: "reponse", children: [_jsxs("p", { class: "reponse-quand", children: [dateCourte(quand), " \u00E0 ", heureCourte(quand)] }), _jsx("dl", { children: props.formulaire.champs
                    .filter((c) => (props.reponse.contenu[c.clef] ?? '') !== '')
                    .map((c) => (_jsxs("div", { class: "reponse-ligne", children: [_jsx("dt", { children: c.titre }), _jsx("dd", { children: dire(c, props.reponse.contenu[c.clef] ?? '') })] }, c.clef))) })] }));
}
/** « oui » plutôt que la valeur brute d'une case cochée. */
function dire(champ, valeur) {
    return champ.sorte === 'oui-non' ? 'oui' : valeur;
}
/**
 * Ce qui part dans une discussion : le lien, et de quoi donner envie de
 * l'ouvrir. Jamais les réponses — elles sont à celui qui les reçoit.
 */
function partage(formulaire, ctx) {
    return {
        title: formulaire.titre,
        desc: formulaire.accroche,
        name: 'compose-formulaire',
        txt: [
            `${formulaire.titre.toUpperCase()} — ${formulaire.kicker.toLowerCase()}`,
            formulaire.accroche,
            ctx.lien,
        ]
            .filter((l) => l !== '')
            .join('\n'),
        broad: null,
        warn: null,
        card: {
            kicker: formulaire.kicker,
            title: formulaire.titre,
            sub: formulaire.accroche,
            tag: null,
            bigLabel: '',
            big: formulaire.bouton,
            pct: null,
            subline: '',
            listTitle: 'CE QU’ON TE DEMANDE',
            items: formulaire.champs.map((c) => ({ n: c.titre, ok: false, warn: false, val: null })),
            link: ctx.lien,
            stamp: '',
        },
        relances: [],
        relancesVides: 'Un formulaire se partage, il ne relance personne.',
    };
}
export function creer(_skeleton, _maintenant, _extrait, compose) {
    const formulaire = compose?.formulaire ?? FORMULAIRE_VIDE;
    return { nom: formulaire.titre, etat: formulaire };
}
