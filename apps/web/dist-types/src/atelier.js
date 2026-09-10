import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { CE_QUE_COUTE, comprendre, etageDe, montantF } from '@a237/engine';
import { useState } from 'preact/hooks';
/**
 * Des exemples qui montrent ce qu'une phrase peut porter, pas seulement le nom
 * d'un outil : le premier prouve qu'un montant et une période sont entendus.
 *
 * Courts exprès. Sur 390 px, quatre exemples longs font quatre lignes et
 * repoussent la grille sous le pli — on cacherait les outils pour montrer
 * comment les demander.
 */
const EXEMPLES = [
    'njangi de 20 000 F par mois',
    'une facture',
    'liste de prix',
    'partager une course',
];
export function Atelier(props) {
    const [demande, setDemande] = useState('');
    const [reponse, setReponse] = useState(null);
    function repondre(texte) {
        setDemande(texte);
        setReponse(texte.trim() === '' ? null : comprendre(texte, props.fiches));
    }
    function ouvrir(fiche, extrait) {
        setDemande('');
        setReponse(null);
        props.onCreer(fiche.id, extrait);
    }
    return (_jsxs("section", { class: "atelier", children: [_jsx("form", { class: "atelier-demande", onSubmit: (e) => {
                    e.preventDefault();
                    const r = reponse;
                    // Entrée ouvre directement quand il n'y a pas de doute : c'est le
                    // chemin de quelqu'un qui sait ce qu'il veut et tape vite.
                    if (r?.sorte === 'sur')
                        ouvrir(r.fiche, r.extrait);
                }, children: _jsxs("label", { class: "champ", for: "demande", children: [_jsx("span", { class: "champ-libelle", children: "De quoi as-tu besoin ?" }), _jsx("input", { id: "demande", type: "text", enterkeyhint: "go", autocomplete: "off", value: demande, placeholder: "njangi de 20 000 F par mois\u2026", onInput: (e) => repondre(e.target.value) })] }) }), reponse === null && (_jsx("div", { class: "atelier-exemples", children: EXEMPLES.map((e) => (_jsx("button", { type: "button", class: "atelier-exemple", onClick: () => repondre(e), children: e }, e))) })), reponse?.sorte === 'sur' && (_jsx(Proposition, { fiche: reponse.fiche, extrait: reponse.extrait, onOuvrir: ouvrir })), reponse?.sorte === 'ambigu' && (_jsxs("div", { class: "atelier-reponse", children: [_jsx("p", { class: "atelier-dit", children: "Lequel veux-tu ?" }), _jsx("div", { class: "atelier-choix", children: reponse.fiches.map((f) => (_jsxs("button", { type: "button", class: "atelier-option", onClick: () => ouvrir(f, reponse.extrait), children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: f.glyphe }), _jsx("b", { children: f.title })] }, f.id))) })] })), reponse?.sorte === 'plusieurs' && (_jsx("div", { class: "atelier-reponse", children: _jsx("p", { class: "atelier-dit", children: "\u00C7a fait plusieurs outils d\u2019un coup. Demande-les un par un \u2014 chacun co\u00FBte quelques centimes \u2014 ou prends un abonnement." }) })), reponse?.sorte === 'hors-portee' && (_jsxs("div", { class: "atelier-reponse", children: [_jsx("p", { class: "atelier-dit", children: "Aucun de mes outils ne correspond. On en fabrique un ensemble \u2014 un registre, une calculatrice, une page \u00E0 envoyer sur WhatsApp, ou un formulaire qui ramasse les r\u00E9ponses." }), _jsxs("button", { type: "button", class: "atelier-option principale", onClick: () => props.onDiscuter(demande), children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: "\u2733" }), _jsxs("span", { class: "texte", children: [_jsx("b", { children: "En parler \u00E0 l\u2019atelier" }), _jsx("span", { children: CE_QUE_COUTE[etageDe(demande, props.fiches)] })] })] })] }))] }));
}
/**
 * Ce qu'on a compris, dit avant d'ouvrir.
 *
 * Le résumé n'est pas décoratif : il montre que « 20 000 F » a bien été
 * entendu comme la cotisation. S'il se trompe, ça se voit avant le clic et non
 * après, quand il faudrait défaire.
 */
function Proposition(props) {
    const retenu = resumer(props.extrait);
    return (_jsx("div", { class: "atelier-reponse", children: _jsxs("button", { type: "button", class: "atelier-option principale", onClick: () => props.onOuvrir(props.fiche, props.extrait), children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: props.fiche.glyphe }), _jsxs("span", { class: "texte", children: [_jsxs("b", { children: ["Ouvrir ", props.fiche.title.toLowerCase()] }), retenu !== '' && _jsx("span", { children: retenu })] })] }) }));
}
/**
 * Ce que la phrase a donné, en français. Vide quand elle n'a rien donné.
 *
 * Le montant passe par `montantF`, comme partout ailleurs. `toLocaleString`
 * écrivait la même somme autrement — espace fine au lieu d'insécable, selon
 * l'ICU du téléphone — et la même valeur se serait lue de deux façons entre
 * cet écran et celui d'à côté.
 */
function resumer(extrait) {
    const bouts = [];
    const somme = extrait.montants[0];
    if (somme !== undefined)
        bouts.push(montantF(somme));
    if (extrait.periode !== null)
        bouts.push(`par ${extrait.periode}`);
    if (extrait.compte !== null)
        bouts.push(`${extrait.compte} personnes`);
    if (extrait.pourcent !== null)
        bouts.push(`${extrait.pourcent} %`);
    return bouts.join(' · ');
}
