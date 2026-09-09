import { jsx as _jsx } from "preact/jsx-runtime";
import { ardoise, valider } from '@a237/engine';
import { RegistreArdoise } from '@a237/render/registre';
import { EtatInvalide } from './commun.js';
export function Outil(props) {
    const erreurs = valider(ardoise.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    return (_jsx(RegistreArdoise, { glyphe: props.glyphe, etat: props.outil.etat, ctx: props.ctx, onChange: props.onChange, onDiffuser: props.onDiffuser }));
}
export function creer(_skeleton, _maintenant, extrait) {
    const neuf = ardoise.defaults;
    return { nom: ardoise.title, etat: ardoise.garnir?.(neuf, extrait) ?? neuf };
}
