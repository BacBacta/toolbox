import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { EXTRAIT_VIDE, comprendre, montantF } from '@a237/engine';
import { useState } from 'preact/hooks';
import { composer } from './composer.js';
/** Les identifiants des outils qui n'ont pas de squelette. Voir `outils/`. */
const ID_COMPOSE_REGISTRE = 'compose';
const ID_COMPOSE_CALCUL = 'compose-calcul';
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
    const [composition, setComposition] = useState('repos');
    function repondre(texte) {
        setDemande(texte);
        setComposition('repos');
        setReponse(texte.trim() === '' ? null : comprendre(texte, props.fiches));
    }
    /**
     * L'étage 2 : le modèle compose un registre que l'étage 1 ne connaissait pas.
     *
     * Il ne part que sur un geste — jamais en tapant. Chaque appel coûte de
     * l'argent (§ 8, moins d'un franc la génération), et lancer une génération à
     * chaque frappe brûlerait un budget pour des phrases inachevées.
     */
    function reussi() {
        setComposition('repos');
        setDemande('');
        setReponse(null);
    }
    function faireComposer() {
        setComposition('en-cours');
        void composer(demande).then((r) => {
            if (r.sorte === 'compose') {
                reussi();
                props.onCreer(ID_COMPOSE_REGISTRE, EXTRAIT_VIDE, { registre: r.registre }, r.fcfa);
            }
            else if (r.sorte === 'calcule') {
                reussi();
                props.onCreer(ID_COMPOSE_CALCUL, EXTRAIT_VIDE, { calcul: r.calcul }, r.fcfa);
            }
            else if (r.sorte === 'pas-ouvert') {
                setComposition('pas-ouvert');
            }
            else if (r.sorte === 'sans-credit') {
                setComposition('sans-credit');
            }
            else if (r.sorte === 'hors-sujet') {
                setComposition({ horsSujet: r.pourquoi });
            }
            else {
                setComposition({ echoue: r.pourquoi });
            }
        });
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
                }, children: _jsxs("label", { class: "champ", for: "demande", children: [_jsx("span", { class: "champ-libelle", children: "De quoi as-tu besoin ?" }), _jsx("input", { id: "demande", type: "text", enterkeyhint: "go", autocomplete: "off", value: demande, placeholder: "njangi de 20 000 F par mois\u2026", onInput: (e) => repondre(e.target.value) })] }) }), reponse === null && (_jsx("div", { class: "atelier-exemples", children: EXEMPLES.map((e) => (_jsx("button", { type: "button", class: "atelier-exemple", onClick: () => repondre(e), children: e }, e))) })), reponse?.sorte === 'sur' && (_jsx(Proposition, { fiche: reponse.fiche, extrait: reponse.extrait, onOuvrir: ouvrir })), reponse?.sorte === 'ambigu' && (_jsxs("div", { class: "atelier-reponse", children: [_jsx("p", { class: "atelier-dit", children: "Lequel veux-tu ?" }), _jsx("div", { class: "atelier-choix", children: reponse.fiches.map((f) => (_jsxs("button", { type: "button", class: "atelier-option", onClick: () => ouvrir(f, reponse.extrait), children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: f.glyphe }), _jsx("b", { children: f.title })] }, f.id))) })] })), reponse?.sorte === 'hors-portee' && (_jsxs("div", { class: "atelier-reponse", children: [_jsx("p", { class: "atelier-dit", children: "Aucun de mes outils ne correspond. Je peux en composer un \u2014 un registre avec tes colonnes, ou une calculatrice avec tes champs." }), composition === 'repos' && (_jsxs("button", { type: "button", class: "atelier-option principale", onClick: faireComposer, children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: "\u2733" }), _jsxs("span", { class: "texte", children: [_jsx("b", { children: "Compose-le pour moi" }), _jsx("span", { children: "demande le r\u00E9seau" })] })] })), composition === 'en-cours' && _jsx("p", { class: "note", children: "Je compose\u2026" }), composition === 'sans-credit' && (_jsx("p", { class: "note", children: "Il n\u2019y a plus de cr\u00E9dit pour composer. Les outils que tu as d\u00E9j\u00E0 continuent de marcher, et ceux de la liste ci-dessous s\u2019ouvrent sans rien co\u00FBter." })), composition === 'pas-ouvert' && (_jsx("p", { class: "note", children: "La composition n\u2019est pas encore ouverte. En attendant, prends l\u2019outil le plus proche dans la liste ci-dessous." })), typeof composition === 'object' && 'horsSujet' in composition && (_jsx("p", { class: "note", children: composition.horsSujet })), typeof composition === 'object' && 'echoue' in composition && (_jsxs("p", { class: "note", children: ["Je n\u2019ai pas pu composer \u2014 ", composition.echoue, ". R\u00E9essaie ?"] }))] }))] }));
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
