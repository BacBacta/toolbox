import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { attestation, controleDette, controleEmetteur, dette, motivation, recu, valider, } from '@a237/engine';
import { DocumentAttestation, DocumentDette, DocumentMotivation, DocumentRecu, } from '@a237/render/doc';
import { useState } from 'preact/hooks';
import { ChampsSchema } from '../formulaire.js';
import { CadreDocument, EtatInvalide, Manquements, ongletDOuverture } from './commun.js';
/**
 * Les quatre actes et lettres à l'écran.
 *
 * Un seul fragment pour les quatre : ils partagent le cadre, le formulaire
 * dressé par le schéma et la bascule Document / Modifier. Ce qui les distingue
 * tient dans une fonction de rendu et un contrôle légal.
 */
/** Champs que l'utilisateur ne saisit pas : ils sont dérivés à la création. */
const MASQUES = ['$.nom', '$.emisLe'];
/**
 * Le contrôle d'une reconnaissance de dette n'est pas celui d'une attestation.
 *
 * `mentionsManquantes` cherche une entreprise — NIU, RCCM, centre des impôts.
 * Un acte entre deux personnes n'en a pas : ce qu'un juge cherche, c'est
 * l'identité des parties, un montant et une échéance. Les deux contrôles se
 * ramènent ici à la même forme, pour que l'écran n'ait qu'un seul encart.
 */
const ACTES = {
    attestation: {
        squelette: attestation,
        rendre: (etat) => _jsx(DocumentAttestation, { etat: etat }),
        sousTitre: (etat) => `${etat.objet} N° ${etat.numero}`,
        manques: (etat) => controleEmetteur(etat),
        consequence: 'Sans elles, le document n’identifie pas l’entreprise qui le délivre.',
    },
    recu: {
        squelette: recu,
        rendre: (etat) => _jsx(DocumentRecu, { etat: etat }),
        sousTitre: (etat) => `Reçu N° ${etat.numero}`,
        manques: (etat) => controleEmetteur(etat),
        consequence: 'Sans elles, le document n’identifie pas l’entreprise qui le délivre.',
    },
    dette: {
        squelette: dette,
        rendre: (etat) => _jsx(DocumentDette, { etat: etat }),
        sousTitre: () => 'Acte sous seing privé',
        manques: (etat) => controleDette(etat).map((m) => ({ ...m, gravite: 'bloquant' })),
        consequence: 'Sans elles, l’acte ne prouve rien devant un juge.',
    },
    motivation: {
        squelette: motivation,
        rendre: (etat) => _jsx(DocumentMotivation, { etat: etat }),
        sousTitre: (etat) => etat.objet,
        manques: () => [],
        consequence: '',
    },
};
export function Outil(props) {
    const acte = ACTES[props.outil.skeleton];
    // Le crochet passe avant la sortie anticipée : un état qui redeviendrait
    // valide changerait sinon le nombre de crochets d'un rendu à l'autre.
    const [onglet, setOnglet] = useState(ongletDOuverture(props.outil.etat));
    if (acte === undefined) {
        return (_jsx(EtatInvalide, { erreurs: [{ chemin: '$', message: `acte inconnu : ${props.outil.skeleton}` }] }));
    }
    const erreurs = valider(acte.squelette.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    const etat = props.outil.etat;
    return (_jsx(CadreDocument, { titre: props.outil.nom, glyphe: props.glyphe, sousTitre: acte.sousTitre(etat), onglet: onglet, onOnglet: setOnglet, onDiffuser: () => props.onDiffuser((c) => acte.squelette.share(etat, c)), children: onglet === 'Document' ? (_jsxs(_Fragment, { children: [_jsx(Manquements, { manquements: acte.manques(etat).map((m) => ({
                        champ: m.champ,
                        libelle: m.libelle,
                        gravite: (m.gravite ?? 'bloquant'),
                    })), consequence: acte.consequence, onCompleter: () => setOnglet('Modifier') }), acte.rendre(etat)] })) : (_jsx(ChampsSchema, { schema: acte.squelette.schema, valeur: etat, masques: MASQUES, onChange: props.onChange })) }));
}
export function creer(skeleton, maintenant, _extrait) {
    const acte = ACTES[skeleton];
    if (acte === undefined)
        throw new RangeError(`acte inconnu : ${skeleton}`);
    const s = acte.squelette;
    return {
        nom: s.title,
        etat: s.initialiser?.({ lien: '', maintenant }) ?? s.defaults,
    };
}
