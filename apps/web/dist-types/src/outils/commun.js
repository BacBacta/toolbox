import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
/**
 * Ce que devis et facture partagent à l'écran. Ils ne diffèrent que par ce
 * qu'ils engagent ; leur cadre est le même.
 */
/**
 * Un état qui ne valide pas contre son schéma ne doit jamais atteindre le
 * rendu (invariant § 2.1). On le dit, on ne devine pas.
 */
export function EtatInvalide(props) {
    // Classe à part : « ton état est cassé » et « ton document est incomplet »
    // sont deux problèmes différents, et l'un se répare, l'autre se remplit.
    return (_jsxs("div", { class: "alerte etat-invalide", children: [_jsx("p", { children: "Cet outil ne correspond pas \u00E0 ce que l\u2019application sait dessiner. Rien n\u2019a \u00E9t\u00E9 perdu : l\u2019\u00E9tat est toujours enregistr\u00E9 sur le t\u00E9l\u00E9phone." }), _jsx("ul", { children: props.erreurs.slice(0, 5).map((e) => (_jsxs("li", { children: [_jsx("code", { children: e.chemin }), " \u2014 ", e.message] }, e.chemin))) })] }));
}
/**
 * Ce qui manque au document pour passer un contrôle.
 *
 * Les mentions manquantes s'énumèrent au lieu de se lire en prose : sept
 * mentions dans une phrase font cinq lignes de rouge dont on ne retient rien,
 * alors qu'une liste se pointe du doigt et se coche des yeux.
 *
 * Et l'encart porte le geste qui le fait disparaître. Un écran qui dit « il
 * manque ton NIU » sans emmener là où on le saisit laisse l'utilisateur
 * chercher l'onglet lui-même.
 */
export function Manquements(props) {
    const bloquants = props.manquements.filter((m) => m.gravite === 'bloquant');
    const avertissements = props.manquements.filter((m) => m.gravite === 'avertissement');
    if (bloquants.length === 0 && avertissements.length === 0)
        return null;
    return (_jsxs("div", { class: bloquants.length > 0 ? 'alerte' : 'note', children: [bloquants.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["Il manque ", bloquants.length === 1 ? 'une mention' : `${bloquants.length} mentions`, ". Sans elles, un client qui veut d\u00E9duire ne pourra pas s\u2019en servir."] }), _jsx("ul", { children: bloquants.map((m) => (_jsx("li", { children: m.libelle }, m.libelle))) })] })), avertissements.length > 0 && (_jsxs("p", { children: ["\u00C0 v\u00E9rifier : ", avertissements.map((m) => m.libelle).join(', '), "."] })), props.onCompleter !== undefined && (_jsx("button", { type: "button", class: "alerte-action", onClick: props.onCompleter, children: "Compl\u00E9ter le document" }))] }));
}
/**
 * L'onglet d'ouverture d'un document.
 *
 * Un document qu'on vient de créer s'ouvre sur le formulaire : l'onglet
 * Document lui montrerait une page blanche surmontée de la liste des sept
 * mentions qui manquent — un reproche avant le premier geste. Une fois
 * l'entreprise saisie, il y a quelque chose à regarder, et c'est le document
 * qui prend la main.
 *
 * L'état arrive brut, avant validation : ce choix se fait au premier rendu,
 * donc avant qu'on sache s'il est conforme.
 */
export function ongletDOuverture(etat) {
    const doc = etat;
    const nom = doc?.emetteur?.nom;
    return typeof nom === 'string' && nom.trim() !== '' ? 'Document' : 'Modifier';
}
export function CadreDocument(props) {
    return (_jsxs("section", { class: "outil", children: [_jsxs("header", { class: "outil-entete", children: [_jsxs("div", { class: "outil-identite", children: [_jsx("div", { class: "outil-pastille", "aria-hidden": "true", children: props.glyphe }), _jsxs("div", { class: "outil-titre", children: [_jsx("b", { children: props.titre }), _jsx("span", { children: props.sousTitre })] })] }), _jsx("div", { class: "outil-onglets", role: "tablist", children: ['Document', 'Modifier'].map((o) => (_jsx("button", { type: "button", role: "tab", "aria-selected": o === props.onglet, onClick: () => props.onOnglet(o), children: o }, o))) })] }), _jsxs("div", { class: "outil-corps", role: "tabpanel", children: [props.children, _jsx("div", { class: "outil-actions", children: _jsx("button", { type: "button", class: "outil-action principale", onClick: props.onDiffuser, children: "Diffuser" }) })] })] }));
}
