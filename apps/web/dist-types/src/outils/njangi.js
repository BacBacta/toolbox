import { jsx as _jsx } from "preact/jsx-runtime";
import { njangi, valider } from '@a237/engine';
import { RegistreNjangi } from '@a237/render/registre';
import { EtatInvalide } from './commun.js';
export function Outil(props) {
    const erreurs = valider(njangi.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    return (_jsx(RegistreNjangi, { glyphe: props.glyphe, etat: props.outil.etat, ctx: props.ctx, onChange: props.onChange, onDiffuser: props.onDiffuser }));
}
export function creer(_skeleton, maintenant, extrait) {
    const neuf = njangi.initialiser?.({ lien: '', maintenant }) ?? njangi.defaults;
    return { nom: njangi.title, etat: njangi.garnir?.(neuf, extrait) ?? neuf };
}
