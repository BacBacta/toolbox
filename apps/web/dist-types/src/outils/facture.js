import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { controleLegal, facture, valider } from '@a237/engine';
import { DocumentFacture } from '@a237/render/doc';
import { useState } from 'preact/hooks';
import { ChampsSchema } from '../formulaire.js';
import { CadreDocument, EtatInvalide, Manquements } from './commun.js';
const MASQUES = ['$.nom', '$.emisLe'];
export function Outil(props) {
    const [onglet, setOnglet] = useState('Document');
    const erreurs = valider(facture.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    const etat = props.outil.etat;
    return (_jsx(CadreDocument, { titre: props.outil.nom, sousTitre: `Facture N° ${etat.numero}`, onglet: onglet, onOnglet: setOnglet, onDiffuser: () => props.onDiffuser(facture.share(etat, props.ctx)), children: onglet === 'Document' ? (_jsxs(_Fragment, { children: [_jsx(Manquements, { manquements: controleLegal(etat) }), _jsx(DocumentFacture, { etat: etat, maintenant: props.ctx.maintenant })] })) : (_jsx(ChampsSchema, { schema: facture.schema, valeur: etat, masques: MASQUES, onChange: props.onChange })) }));
}
export function creer(maintenant) {
    return {
        nom: facture.title,
        etat: facture.initialiser?.({ lien: '', maintenant }) ?? facture.defaults,
    };
}
