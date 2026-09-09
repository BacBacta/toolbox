import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { cartePng, dessinerCarte } from '@a237/render/carte';
import { useEffect, useRef, useState } from 'preact/hooks';
import { lienWhatsApp } from './whatsapp.js';
/**
 * La feuille de diffusion.
 *
 * La carte est dessinée **ici, sur le téléphone du propriétaire**, puis
 * partagée en image (BRIEF.md § 3.1). Aucun rendu d'image côté serveur : on
 * réutilise du code déjà écrit et déjà vérifié à l'œil.
 *
 * Les relances partent une par une, du pouce du propriétaire, par `wa.me`
 * (invariant § 2.4). Rien ne s'envoie tout seul.
 */
async function copier(texte) {
    try {
        await navigator.clipboard.writeText(texte);
        return true;
    }
    catch {
        return false;
    }
}
export function Diffusion(props) {
    const canvas = useRef(null);
    const [poids, setPoids] = useState(null);
    const [message, setMessage] = useState('');
    useEffect(() => {
        const element = canvas.current;
        if (element === null)
            return;
        try {
            dessinerCarte(element, props.partage.card);
            void cartePng(element).then((blob) => setPoids(Math.round(blob.size / 1024)), () => setPoids(null));
        }
        catch {
            setMessage('La carte n’a pas pu être dessinée sur cet appareil.');
        }
    }, [props.partage]);
    async function partager() {
        const element = canvas.current;
        if (element === null)
            return;
        try {
            const blob = await cartePng(element);
            const fichier = new File([blob], `${props.partage.name}.png`, { type: 'image/png' });
            if (navigator.canShare?.({ files: [fichier] }) === true) {
                await navigator.share({ files: [fichier], text: props.partage.txt });
                return;
            }
        }
        catch {
            // Le partage natif a été refusé ou n'existe pas : on retombe sur le texte.
        }
        setMessage((await copier(props.partage.txt))
            ? 'Texte copié. Appuie longuement sur l’image pour l’enregistrer.'
            : 'Copie impossible sur cet appareil.');
    }
    return (_jsxs("div", { class: "feuille", role: "dialog", "aria-label": "Diffuser", children: [_jsxs("div", { class: "feuille-tete", children: [_jsx("b", { children: "Diffuser" }), _jsx("button", { type: "button", class: "feuille-fermer", onClick: props.onFermer, "aria-label": "Fermer", children: "\u00D7" })] }), props.partage.warn !== null && _jsx("div", { class: "alerte", children: props.partage.warn }), _jsx("canvas", { ref: canvas, class: "carte-apercu", "aria-label": props.partage.desc }), poids !== null && _jsxs("p", { class: "champ-aide", children: ["PNG de ", poids, " Ko"] }), _jsx("pre", { class: "resume", children: props.partage.txt }), _jsxs("div", { class: "outil-actions", children: [_jsx("button", { type: "button", class: "outil-action principale", onClick: () => void partager(), children: "Partager la carte" }), _jsx("button", { type: "button", class: "outil-action", onClick: () => {
                            void copier(props.partage.txt).then((ok) => setMessage(ok ? 'Résumé copié.' : 'Copie impossible sur cet appareil.'));
                        }, children: "Copier le texte" })] }), message !== '' && _jsx("p", { class: "note", children: message }), _jsx("h3", { class: "outil-surtitre", children: "Relances" }), props.partage.relances.length === 0 ? (_jsx("p", { class: "note", children: props.partage.relancesVides })) : (_jsx("div", { class: "outil-rangees", children: props.partage.relances.map((r) => {
                    const lien = r.tel === null ? null : lienWhatsApp(r.tel, r.message);
                    return (_jsxs("div", { class: "outil-rangee", children: [_jsx("div", { class: "identite", children: _jsxs("span", { class: "nom", children: [_jsx("span", { class: "n1", children: r.nom }), _jsx("span", { class: "n2", children: lien === null ? 'numéro inconnu' : r.tel })] }) }), lien === null ? (_jsx("button", { type: "button", class: "outil-bascule", onClick: () => {
                                    void copier(r.message).then((ok) => setMessage(ok ? `Message pour ${r.nom} copié.` : 'Copie impossible.'));
                                }, children: "Copier" })) : (_jsx("a", { class: "outil-bascule", href: lien, target: "_blank", rel: "noreferrer", children: "Relancer" }))] }, r.nom));
                }) }))] }));
}
