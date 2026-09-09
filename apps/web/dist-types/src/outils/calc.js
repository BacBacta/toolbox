import { jsx as _jsx } from "preact/jsx-runtime";
import { CALCULATRICES, evaluer, squeletteCalc, valider } from '@a237/engine';
import { Calculatrice } from '@a237/render/registre';
import { EtatInvalide } from './commun.js';
/** L'adaptateur des calculatrices. Un fragment pour les deux, et pour les composées. */
const PAR_ID = new Map(CALCULATRICES.map((s) => [s.id, s]));
/** L'identifiant d'une calculatrice qui n'a pas de squelette. */
export const ID_COMPOSE_CALCUL = 'compose-calcul';
/**
 * Une calculatrice composée par le modèle.
 *
 * Sa formule est un arbre déclaré, pas du code : `evaluer` l'interprète, et
 * c'est ce qui permet au modèle de décrire un calcul sans jamais obtenir le
 * droit d'en exécuter un (invariant § 2.1).
 */
function calculCompose(demande) {
    return squeletteCalc({
        id: ID_COMPOSE_CALCUL,
        title: demande.titre,
        group: 'calculs',
        keywords: [],
        titreNom: demande.titreNom,
        relancesVides: 'Une calculatrice se consulte, elle ne se relance pas.',
        config: {
            kicker: demande.kicker,
            entrees: demande.entrees,
            sortie: {
                libelle: demande.sortie.libelle,
                unite: demande.sortie.unite,
                calcul: (val) => evaluer(demande.sortie.formule, val),
            },
        },
    });
}
export function Outil(props) {
    const compose = props.outil.calcul;
    const squelette = compose !== undefined ? calculCompose(compose) : PAR_ID.get(props.outil.skeleton);
    if (squelette === undefined) {
        return (_jsx(EtatInvalide, { erreurs: [{ chemin: '$', message: `calcul inconnu : ${props.outil.skeleton}` }] }));
    }
    const erreurs = valider(squelette.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    return (_jsx(Calculatrice, { glyphe: props.glyphe, config: squelette.config, titre: squelette.title, etat: props.outil.etat, ctx: props.ctx, onChange: props.onChange, onDiffuser: props.onDiffuser, partage: squelette.share }));
}
export function creer(skeleton, _maintenant, _extrait, compose) {
    const calcul = compose?.calcul;
    const squelette = calcul !== undefined ? calculCompose(calcul) : PAR_ID.get(skeleton);
    if (squelette === undefined)
        throw new RangeError(`calcul inconnu : ${skeleton}`);
    return { nom: squelette.title, etat: squelette.defaults };
}
