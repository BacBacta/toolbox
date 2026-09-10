import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { GABARITS, controleCv, cv, debordeUnePage, valider } from '@a237/engine';
import { DocumentCv } from '@a237/render/doc';
import { useState } from 'preact/hooks';
import { ChampsSchema } from '../formulaire.js';
import { CadreDocument, EtatInvalide, Manquements } from './commun.js';
/**
 * Le CV à l'écran.
 *
 * Il a ce qu'aucun autre document n'a : trois réglages de forme — gabarit,
 * langue, densité — qui ne changent rien au contenu. Ils vivent au-dessus de la
 * feuille et pas dans le formulaire, parce qu'on en juge en regardant la page,
 * pas en lisant un champ.
 */
/** Champs pilotés par les boutons au-dessus de la feuille, pas par le formulaire. */
const MASQUES = ['$.nom', '$.gabarit', '$.langue', '$.dense'];
const NOMS_GABARIT = {
    notaire: ['Notaire', 'sérif, administratif'],
    executif: ['Exécutif', 'grotesque, privé'],
    editorial: ['Éditorial', 'display, créatif'],
    bloc: ['Bloc', 'bande latérale'],
};
function Reglages(props) {
    const e = props.etat;
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "cv-gabarits", role: "group", "aria-label": "Gabarit", children: GABARITS.map((g) => (_jsxs("button", { type: "button", class: "cv-gabarit", "aria-pressed": e.gabarit === g, onClick: () => props.onChange({ ...e, gabarit: g }), children: [NOMS_GABARIT[g][0], _jsx("small", { children: NOMS_GABARIT[g][1] })] }, g))) }), _jsxs("div", { class: "cv-options", children: [['fr', 'en'].map((l) => (_jsx("button", { type: "button", class: "outil-bascule", "aria-pressed": e.langue === l, onClick: () => props.onChange({ ...e, langue: l }), children: l === 'fr' ? 'Français' : 'English' }, l))), _jsx("span", { class: "cv-ecart", "aria-hidden": "true" }), _jsx("button", { type: "button", class: "outil-bascule", "aria-pressed": e.dense, onClick: () => props.onChange({ ...e, dense: !e.dense }), children: e.dense ? 'Compact' : 'Aéré' })] })] }));
}
export function Outil(props) {
    // Un CV neuf est vide : il s'ouvre sur son formulaire. Il n'a pas d'émetteur,
    // donc pas de quoi appliquer la règle commune — la sienne tient au nom.
    const vide = props.outil.etat?.identite?.nom;
    const [onglet, setOnglet] = useState(typeof vide === 'string' && vide.trim() !== '' ? 'Document' : 'Modifier');
    const erreurs = valider(cv.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    const etat = props.outil.etat;
    return (_jsx(CadreDocument, { titre: props.outil.nom, glyphe: props.glyphe, sousTitre: etat.identite.titre === '' ? 'Curriculum vitæ' : etat.identite.titre, onglet: onglet, onOnglet: setOnglet, onDiffuser: () => props.onDiffuser((c) => cv.share(etat, c)), children: onglet === 'Document' ? (_jsxs(_Fragment, { children: [_jsx(Manquements, { manquements: controleCv(etat).map((m) => ({
                        champ: m.champ,
                        libelle: m.libelle,
                        gravite: 'bloquant',
                    })), consequence: "Sans elles, un recruteur ne peut ni te situer ni te rappeler.", onCompleter: () => setOnglet('Modifier') }), debordeUnePage(etat) && (_jsxs("div", { class: "note", children: ["Ce CV d\u00E9borde sans doute d\u2019une page.", ' ', etat.dense
                            ? 'Coupe les faits les moins parlants : deux pages se lisent rarement en entier.'
                            : 'Passe en compact, ou coupe les faits les moins parlants.'] })), _jsx(Reglages, { etat: etat, onChange: props.onChange }), _jsx(DocumentCv, { etat: etat })] })) : (_jsx(ChampsSchema, { schema: cv.schema, valeur: etat, masques: MASQUES, onChange: props.onChange })) }));
}
export function creer(skeleton, _maintenant, _extrait) {
    if (skeleton !== 'cv')
        throw new RangeError(`ce fragment ne sait faire qu’un CV : ${skeleton}`);
    return { nom: cv.title, etat: cv.defaults };
}
