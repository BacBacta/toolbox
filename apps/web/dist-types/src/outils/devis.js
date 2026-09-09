import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { controleLegal, devis, valider } from '@a237/engine';
import { DocumentDevis } from '@a237/render/doc';
import { useState } from 'preact/hooks';
import { ChampsSchema } from '../formulaire.js';
import { CadreDocument, EtatInvalide, Manquements, ongletDOuverture } from './commun.js';
/** Champs que l'utilisateur ne saisit pas : ils sont dérivés à la création. */
const MASQUES = ['$.nom', '$.emisLe'];
export function Outil(props) {
    // Le crochet passe avant la sortie anticipée : un état qui redeviendrait
    // valide changerait sinon le nombre de crochets d'un rendu à l'autre.
    const [onglet, setOnglet] = useState(ongletDOuverture(props.outil.etat));
    const erreurs = valider(devis.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    const etat = props.outil.etat;
    return (_jsx(CadreDocument, { titre: props.outil.nom, glyphe: props.glyphe, sousTitre: `Devis N° ${etat.numero}`, onglet: onglet, onOnglet: setOnglet, onDiffuser: () => props.onDiffuser(devis.share(etat, props.ctx)), children: onglet === 'Document' ? (_jsxs(_Fragment, { children: [_jsx(Manquements, { manquements: controleLegal(etat), onCompleter: () => setOnglet('Modifier') }), _jsx(DocumentDevis, { etat: etat })] })) : (_jsx(ChampsSchema, { schema: devis.schema, valeur: etat, masques: MASQUES, onChange: props.onChange })) }));
}
export function creer(_skeleton, maintenant) {
    return {
        nom: devis.title,
        etat: devis.initialiser?.({ lien: '', maintenant }) ?? devis.defaults,
    };
}
