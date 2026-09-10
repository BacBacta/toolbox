import { jsx as _jsx } from "preact/jsx-runtime";
import { CALCULATRICES, squeletteDeCalcul, valider } from '@a237/engine';
import { Calculatrice } from '@a237/render/registre';
import { EtatInvalide } from './commun.js';
/** L'adaptateur des calculatrices. Un fragment pour les deux, et pour les composées. */
const PAR_ID = new Map(CALCULATRICES.map((s) => [s.id, s]));
export function Outil(props) {
    const compose = props.outil.calcul;
    const squelette = compose !== undefined ? squeletteDeCalcul(compose) : PAR_ID.get(props.outil.skeleton);
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
    const squelette = calcul !== undefined ? squeletteDeCalcul(calcul) : PAR_ID.get(skeleton);
    if (squelette === undefined)
        throw new RangeError(`calcul inconnu : ${skeleton}`);
    return { nom: squelette.title, etat: squelette.defaults };
}
