import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { PRIX_MENSUEL_XAF } from '@a237/comptes';
import { dateLongue, montantF } from '@a237/engine';
import { useEffect, useState } from 'preact/hooks';
import { demanderCode, demarrerPaiement, lireCompte, reprendreAvecCode, retenirEtat, suivrePaiement, } from './compte.js';
function joursRestants(expire, maintenant) {
    if (expire === null)
        return 0;
    return Math.max(0, Math.ceil((expire - maintenant) / 86_400_000));
}
export function EcranCompte(props) {
    const [etape, setEtape] = useState({ sorte: 'repos' });
    const [mot, setMot] = useState('');
    const [occupe, setOccupe] = useState(false);
    const [saisi, setSaisi] = useState('');
    const [copie, setCopie] = useState(false);
    const etat = props.etat;
    // On rafraîchit à l'ouverture, et seulement là : c'est le seul moment où
    // quelqu'un regarde ce nombre.
    useEffect(() => {
        void lireCompte().then(async (issue) => {
            if (issue.sorte === 'ok') {
                await retenirEtat(issue.valeur);
                props.onEtat(issue.valeur);
            }
            else if (issue.sorte === 'differe') {
                setMot('Pas de réseau : voici ce qu’on savait la dernière fois.');
            }
        });
        // Une seule fois, à l'ouverture de l'écran.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    /** Tant qu'un paiement est en cours, on redemande où il en est. */
    useEffect(() => {
        if (etape.sorte !== 'attente')
            return;
        const id = etape.id;
        const minuteur = setInterval(() => {
            void suivrePaiement(id).then(async (issue) => {
                if (issue.sorte !== 'ok' || issue.valeur.etat === 'attente')
                    return;
                clearInterval(minuteur);
                if (issue.valeur.etat === 'reussi') {
                    const frais = await lireCompte();
                    if (frais.sorte === 'ok') {
                        await retenirEtat(frais.valeur);
                        props.onEtat(frais.valeur);
                    }
                    setMot('C’est bon. Ton atelier est ouvert pour un mois.');
                }
                else {
                    setMot('Le paiement n’a pas abouti. Rien n’a été prélevé.');
                }
                setEtape({ sorte: 'repos' });
            });
        }, 3000);
        return () => clearInterval(minuteur);
    }, [etape, props]);
    async function tirerUnCode() {
        setOccupe(true);
        const issue = await demanderCode();
        setOccupe(false);
        if (issue.sorte === 'ok')
            setEtape({ sorte: 'code', code: issue.valeur.code });
        else
            setMot(issue.sorte === 'differe' ? 'Pas de réseau.' : issue.pourquoi);
    }
    async function reprendre() {
        setOccupe(true);
        const issue = await reprendreAvecCode(saisi);
        setOccupe(false);
        if (issue.sorte === 'ok') {
            await retenirEtat(issue.valeur);
            props.onEtat(issue.valeur);
            setEtape({ sorte: 'repos' });
            setSaisi('');
            setMot('Ton atelier est revenu sur ce téléphone.');
            return;
        }
        setMot(issue.sorte === 'differe'
            ? 'Pas de réseau.'
            : 'Ce code ne correspond à aucun atelier. Vérifie les seize lettres.');
    }
    async function payer() {
        setOccupe(true);
        const issue = await demarrerPaiement(saisi);
        setOccupe(false);
        if (issue.sorte === 'ok') {
            setEtape({ sorte: 'attente', id: issue.valeur.id, consigne: issue.valeur.consigne });
            setSaisi('');
            setMot('');
            return;
        }
        setMot(issue.sorte === 'differe'
            ? 'Pas de réseau. Réessaie quand ça revient.'
            : issue.pourquoi);
    }
    return (_jsxs("div", { class: "compte", children: [_jsx("button", { type: "button", class: "retour", onClick: props.onRetour, children: "\u2190 Mes outils" }), _jsx("h2", { class: "outil-surtitre", children: "Mon atelier" }), etat === null ? (_jsx("p", { class: "note", children: "On ne sait pas encore. Il faut du r\u00E9seau une fois." })) : etat.plan === 'atelier' ? (_jsxs("p", { class: "compte-etat", children: [_jsx("b", { children: "Atelier" }), _jsxs("span", { children: [joursRestants(etat.expire, Date.now()), " jours restants", etat.expire === null ? '' : ` · jusqu’au ${dateLongue(new Date(etat.expire))}`] }), _jsxs("span", { children: [etat.credits, " compositions"] })] })) : (_jsxs("p", { class: "compte-etat", children: [_jsx("b", { children: "Essai" }), _jsx("span", { children: etat.credits === 0
                            ? 'Plus de composition'
                            : `${etat.credits} composition${etat.credits > 1 ? 's' : ''} restante${etat.credits > 1 ? 's' : ''}` }), _jsx("span", { children: "Tout le reste de l\u2019atelier marche sans rien payer." })] })), mot !== '' && _jsx("p", { class: "note", children: mot }), etape.sorte === 'code' && (_jsxs("div", { class: "compte-code", children: [_jsx("p", { class: "etiquette", children: "Ton code de r\u00E9cup\u00E9ration" }), _jsx("p", { class: "compte-code-valeur", children: etape.code }), _jsx("p", { class: "note", children: "\u00C9cris-le quelque part maintenant. Il ne sera plus jamais affich\u00E9, et c\u2019est lui qui te rendra ton atelier si tu changes de t\u00E9l\u00E9phone." }), _jsx("button", { type: "button", class: "atelier-option", onClick: () => {
                            void navigator.clipboard
                                ?.writeText(etape.code)
                                .then(() => setCopie(true))
                                .catch(() => setCopie(false));
                        }, children: _jsx("span", { class: "texte", children: _jsx("b", { children: copie ? 'Copié' : 'Copier le code' }) }) }), _jsx("button", { type: "button", class: "atelier-option principale", onClick: () => {
                            setCopie(false);
                            setEtape({ sorte: 'repos' });
                        }, children: _jsx("span", { class: "texte", children: _jsx("b", { children: "C\u2019est not\u00E9" }) }) })] })), etape.sorte === 'reprendre' && (_jsxs("div", { class: "compte-saisie", children: [_jsx("label", { class: "etiquette", for: "compte-code", children: "Le code de ton autre t\u00E9l\u00E9phone" }), _jsx("input", { id: "compte-code", class: "atelier-demande", value: saisi, placeholder: "A2B3-C4D5-E6F7-G8H9", autocomplete: "off", onInput: (e) => setSaisi(e.currentTarget.value) }), _jsx("button", { type: "button", class: "atelier-option principale", disabled: occupe, onClick: () => void reprendre(), children: _jsx("span", { class: "texte", children: _jsx("b", { children: "Reprendre mon atelier" }) }) })] })), etape.sorte === 'payer' && (_jsxs("div", { class: "compte-saisie", children: [_jsx("label", { class: "etiquette", for: "compte-tel", children: "Ton num\u00E9ro Mobile Money" }), _jsx("input", { id: "compte-tel", class: "atelier-demande", type: "tel", inputMode: "tel", value: saisi, placeholder: "6 99 41 27 08", onInput: (e) => setSaisi(e.currentTarget.value) }), _jsx("button", { type: "button", class: "atelier-option principale", disabled: occupe, onClick: () => void payer(), children: _jsxs("span", { class: "texte", children: [_jsxs("b", { children: ["Payer ", montantF(PRIX_MENSUEL_XAF)] }), _jsx("span", { children: "Un mois, quarante compositions" })] }) })] })), etape.sorte === 'attente' && (_jsxs("div", { class: "compte-saisie", children: [_jsx("p", { class: "note", children: etape.consigne }), _jsx("p", { class: "note", children: "On regarde. Tu peux fermer, \u00E7a continue." })] })), etape.sorte === 'repos' && (_jsxs("div", { class: "compte-choix", children: [_jsxs("button", { type: "button", class: etat?.plan === 'atelier' ? 'atelier-option' : 'atelier-option principale', onClick: () => setEtape({ sorte: 'payer' }), children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: "\u25C8" }), _jsxs("span", { class: "texte", children: [_jsxs("b", { children: [etat?.plan === 'atelier' ? 'Ajouter un mois' : 'Prendre un mois', " \u2014", ' ', montantF(PRIX_MENSUEL_XAF)] }), _jsx("span", { children: etat?.plan === 'atelier'
                                            ? 'Les jours qui te restent ne sont pas perdus : ils s’ajoutent'
                                            : 'Quarante compositions, et les demandes qui valent plusieurs outils' })] })] }), _jsxs("button", { type: "button", class: etat?.plan === 'atelier' && etat.aUnCode === false
                            ? 'atelier-option principale'
                            : 'atelier-option', disabled: occupe, onClick: () => void tirerUnCode(), children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: "\u25EB" }), _jsxs("span", { class: "texte", children: [_jsx("b", { children: etat?.aUnCode === true ? 'Un nouveau code de récupération' : 'Mon code de récupération' }), _jsx("span", { children: etat?.aUnCode === true
                                            ? 'Le précédent ne marchera plus'
                                            : 'Sans lui, un téléphone perdu emporte l’atelier' })] })] }), _jsxs("button", { type: "button", class: "atelier-option", onClick: () => setEtape({ sorte: 'reprendre' }), children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: "\u25F7" }), _jsxs("span", { class: "texte", children: [_jsx("b", { children: "J\u2019ai d\u00E9j\u00E0 un atelier" }), _jsx("span", { children: "Le reprendre avec son code" })] })] })] }))] }));
}
