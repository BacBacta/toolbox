import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useState } from 'preact/hooks';
import { adressePartagee, deposer } from './partage.js';
export function Partage(props) {
    const [etat, setEtat] = useState(props.projet.lien === undefined
        ? { quoi: 'repos' }
        : { quoi: 'fait', adresse: adressePartagee(props.projet.lien, location.origin) });
    const [copie, setCopie] = useState(false);
    async function envoyer() {
        setEtat({ quoi: 'en-cours' });
        const r = await deposer(props.projet);
        if (r.sorte === 'depose') {
            props.onChanger(r.projet);
            setEtat({ quoi: 'fait', adresse: adressePartagee(r.projet.lien ?? '', location.origin) });
            return;
        }
        setEtat({
            quoi: 'raté',
            pourquoi: r.sorte === 'pas-de-reseau'
                ? props.t.pasDeReseau
                : r.sorte === 'refuse' ? r.pourquoi : props.t.partageEchoue,
        });
    }
    return (_jsxs("div", { class: "partage", children: [_jsx("button", { type: "button", class: "partager", disabled: etat.quoi === 'en-cours', onClick: () => void envoyer(), children: etat.quoi === 'en-cours'
                    ? props.t.envoiEnCours
                    : props.projet.lien === undefined
                        ? props.t.sauvegarder
                        : props.t.mettreAJour }), etat.quoi === 'fait' && (_jsxs("div", { class: "partage-lien", children: [_jsx("p", { class: "mot", children: props.t.gardeCeLien }), _jsx("code", { class: "adresse", children: etat.adresse }), _jsxs("div", { class: "partage-actions", children: [_jsx("button", { type: "button", onClick: () => {
                                    void navigator.clipboard?.writeText(etat.adresse).then(() => setCopie(true), 
                                    // Le presse-papier peut être refusé : l'adresse reste lisible
                                    // à l'écran, et on ne prétend pas l'avoir copiée.
                                    () => setCopie(false));
                                }, children: copie ? props.t.copie : props.t.copier }), _jsx("a", { class: "whatsapp", href: `https://wa.me/?text=${encodeURIComponent(`${props.projet.nom} — ${etat.adresse}`)}`, target: "_blank", rel: "noopener noreferrer", children: props.t.surWhatsApp })] })] })), etat.quoi === 'raté' && _jsx("p", { class: "mot alerte", children: etat.pourquoi })] }));
}
