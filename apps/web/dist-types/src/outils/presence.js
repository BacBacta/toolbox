import { jsx as _jsx } from "preact/jsx-runtime";
import { presence, valider } from '@a237/engine';
import { RegistrePresence } from '@a237/render/registre';
import { EtatInvalide } from './commun.js';
export function Outil(props) {
    const erreurs = valider(presence.schema, props.outil.etat);
    if (erreurs.length > 0)
        return _jsx(EtatInvalide, { erreurs: erreurs });
    return (_jsx(RegistrePresence, { glyphe: props.glyphe, etat: props.outil.etat, ctx: props.ctx, onChange: props.onChange, onDiffuser: props.onDiffuser }));
}
export function creer(_skeleton, _maintenant, extrait) {
    const neuf = presence.defaults;
    return { nom: presence.title, etat: presence.garnir?.(neuf, extrait) ?? neuf };
}
