import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { MODELES, fichierAExporter } from '@a237/etabli';
import { useEffect, useState } from 'preact/hooks';
import { Apercu } from './apercu.js';
import { Editeur } from './editeur.js';
import { enregistrer, lireProjets, supprimer } from './stockage.js';
export function App() {
    const [projets, setProjets] = useState(null);
    const [ecran, setEcran] = useState({ quoi: 'liste' });
    useEffect(() => {
        void lireProjets().then(setProjets);
    }, []);
    function creer(modeleId) {
        const modele = MODELES.find((m) => m.id === modeleId);
        if (modele === undefined)
            return;
        const projet = {
            id: `p${Date.now().toString(36)}`,
            nom: modele.nom,
            fichiers: modele.fichiers.map((f) => ({ ...f })),
            maj: Date.now(),
        };
        setProjets((p) => [projet, ...(p ?? [])]);
        setEcran({ quoi: 'projet', id: projet.id });
        void enregistrer(projet);
    }
    function remplacer(projet) {
        setProjets((p) => (p ?? []).map((autre) => (autre.id === projet.id ? projet : autre)));
        void enregistrer(projet);
    }
    function effacer(id) {
        setProjets((p) => (p ?? []).filter((autre) => autre.id !== id));
        void supprimer(id);
    }
    if (projets === null)
        return _jsx("main", { class: "chargement", children: "Un instant\u2026" });
    if (ecran.quoi === 'projet') {
        const projet = projets.find((p) => p.id === ecran.id);
        if (projet === undefined)
            return _jsx("main", { class: "chargement", children: "Ce projet n\u2019existe plus." });
        return (_jsx(EcranProjet, { projet: projet, onChanger: remplacer, onFermer: () => setEcran({ quoi: 'liste' }) }));
    }
    return (_jsxs("main", { class: "liste", children: [_jsx("h1", { children: "\u00C9tabli" }), _jsx("p", { class: "sous-titre", children: "\u00C9cris du code, ici, sans r\u00E9seau." }), _jsx("h2", { children: "Commencer" }), _jsx("div", { class: "modeles", children: MODELES.map((m) => (_jsxs("button", { type: "button", class: "modele", onClick: () => creer(m.id), children: [_jsx("b", { children: m.nom }), _jsx("span", { children: m.dit })] }, m.id))) }), projets.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Tes projets" }), _jsx("ul", { class: "projets", children: projets.map((p) => (_jsxs("li", { children: [_jsxs("button", { type: "button", class: "projet", onClick: () => setEcran({ quoi: 'projet', id: p.id }), children: [_jsx("b", { children: p.nom }), _jsxs("span", { children: [p.fichiers.length, " fichier", p.fichiers.length > 1 ? 's' : ''] })] }), _jsx("button", { type: "button", class: "effacer", "aria-label": `Effacer ${p.nom}`, onClick: () => effacer(p.id), children: "\u2715" })] }, p.id))) })] }))] }));
}
/**
 * Un projet ouvert : on écrit, ou on regarde. Jamais les deux en même temps.
 *
 * Trois cent soixante pixels ne se partagent pas entre un éditeur et un aperçu
 * — chacun devient trop étroit pour servir. Sur un téléphone, on bascule ; c'est
 * ce que font toutes les applications que ces téléphones font déjà tourner.
 *
 * Le lancement est un geste, pas un rafraîchissement continu : une boucle
 * infinie relancée à chaque frappe fige l'appareil, et un aperçu qui se
 * redessine sans arrêt vide la batterie de quelqu'un qui n'a pas forcément de
 * quoi la recharger ce soir.
 */
function EcranProjet(props) {
    const [vue, setVue] = useState('ecrire');
    const [ouvert, setOuvert] = useState(props.projet.fichiers[0]?.nom ?? '');
    const [tour, setTour] = useState(0);
    function ecrire(nom, contenu) {
        props.onChanger({
            ...props.projet,
            maj: Date.now(),
            fichiers: props.projet.fichiers.map((f) => (f.nom === nom ? { ...f, contenu } : f)),
        });
    }
    function ajouter(fichier) {
        props.onChanger({
            ...props.projet,
            maj: Date.now(),
            fichiers: [...props.projet.fichiers, fichier],
        });
        setOuvert(fichier.nom);
    }
    function lancer() {
        setTour((t) => t + 1);
        setVue('voir');
    }
    return (_jsxs("main", { class: "projet-ouvert", children: [_jsxs("header", { class: "barre", children: [_jsx("button", { type: "button", class: "retour", onClick: props.onFermer, children: "\u2190 Mes projets" }), _jsx("b", { class: "nom", children: props.projet.nom }), vue === 'ecrire' ? (_jsx("button", { type: "button", class: "lancer", onClick: lancer, children: "\u25B6 Lancer" })) : (_jsx("button", { type: "button", class: "lancer", onClick: () => setVue('ecrire'), children: "\u00C9crire" }))] }), vue === 'ecrire' ? (_jsx(Editeur, { projet: props.projet, ouvert: ouvert, onOuvrir: setOuvert, onEcrire: ecrire, onAjouter: ajouter })) : (_jsxs(_Fragment, { children: [_jsx(Apercu, { projet: props.projet, tour: tour }), _jsxs("div", { class: "actions", children: [_jsx("button", { type: "button", onClick: () => setTour((t) => t + 1), children: "\u27F3 Relancer" }), _jsx("button", { type: "button", onClick: () => telecharger(props.projet), children: "Exporter en un fichier" })] })] }))] }));
}
/**
 * Le fichier part sur le téléphone, et de là sur WhatsApp.
 *
 * Ce qu'il contient et comment il s'appelle se décide dans `fichierAExporter`,
 * qui est pur et éprouvé — le nom d'un projet écrit en français demande plus de
 * soin qu'il n'y paraît. Ce qui reste ici est la plomberie du navigateur, et
 * rien d'autre.
 */
function telecharger(projet) {
    const { nom, contenu } = fichierAExporter(projet);
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/html' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    lien.click();
    URL.revokeObjectURL(url);
}
