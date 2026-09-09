import { jsx as _jsx } from "preact/jsx-runtime";
import { callbox, valider } from '@a237/engine';
import { RegistreCallbox } from '@a237/render/registre';
import { EtatInvalide } from './commun.js';
export function Outil(props) {
    const erreurs = valider(callbox.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    return (_jsx(RegistreCallbox, { glyphe: props.glyphe, etat: props.outil.etat, ctx: props.ctx, onChange: props.onChange, onDiffuser: props.onDiffuser }));
}
export function creer(_skeleton, _maintenant, extrait) {
    const neuf = callbox.defaults;
    return { nom: callbox.title, etat: callbox.garnir?.(neuf, extrait) ?? neuf };
}
