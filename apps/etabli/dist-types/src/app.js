import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { fichierAExporter, langueDuNavigateur, modeles, textes } from '@a237/etabli';
import { lienDemande, recuperer } from './partage.js';
import { useEffect, useState } from 'preact/hooks';
import { Apercu } from './apercu.js';
import { Partage } from './partage-vue.js';
import { Editeur } from './editeur.js';
import { enregistrer, lireProjets, supprimer } from './stockage.js';
/**
 * La langue, devinée une fois puis retenue.
 *
 * Le français est le repli parce qu'il est majoritaire dans le pays, mais un
 * anglophone n'a pas à le subir : le téléphone dit déjà sa langue, et le choix
 * se change à l'écran. Il tient d'une visite à l'autre — le redemander à chaque
 * ouverture serait le lui redemander tous les jours.
 *
 * `localStorage` peut jeter (navigation privée, stockage refusé) : on retombe
 * alors sur ce que dit le téléphone, ce qui est déjà la bonne réponse presque
 * partout.
 */
const CLEF_LANGUE = 'etabli:langue';
function langueRetenue() {
    try {
        const retenue = localStorage.getItem(CLEF_LANGUE);
        if (retenue === 'fr' || retenue === 'en')
            return retenue;
    }
    catch {
        /* stockage refusé : le téléphone décide */
    }
    return langueDuNavigateur(navigator.language);
}
export function App() {
    const [langue, setLangue] = useState(langueRetenue());
    const t = textes(langue);
    const [projets, setProjets] = useState(null);
    const [ecran, setEcran] = useState({ quoi: 'liste' });
    const [ouverture, setOuverture] = useState('non');
    useEffect(() => {
        void lireProjets().then(setProjets);
    }, []);
    /*
     * Un lien reçu s'ouvre tout seul.
     *
     * Quelqu'un reçoit l'adresse sur WhatsApp et la touche : il doit voir le
     * projet, pas un écran d'accueil où il faudrait deviner quoi faire. Le projet
     * arrive comme une copie à lui — il l'ouvre, le modifie, et sauvegardera sous
     * son propre lien s'il le veut. Celui qui a partagé ne risque rien.
     */
    useEffect(() => {
        const lien = lienDemande(location.search);
        if (lien === null)
            return;
        setOuverture('en-cours');
        void recuperer(lien).then((r) => {
            if (r.sorte !== 'ouvert') {
                setOuverture(r.sorte === 'introuvable' ? 'introuvable' : 'echouee');
                return;
            }
            const copie = {
                id: `p${Date.now().toString(36)}`,
                nom: r.nom,
                fichiers: r.fichiers.map((f) => ({ ...f })),
                maj: Date.now(),
            };
            setProjets((p) => [copie, ...(p ?? [])]);
            setEcran({ quoi: 'projet', id: copie.id });
            setOuverture('faite');
            void enregistrer(copie);
            history.replaceState(null, '', location.pathname);
        });
    }, []);
    function creer(modeleId) {
        const modele = modeles(langue).find((m) => m.id === modeleId);
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
    function changerLangue(vers) {
        setLangue(vers);
        try {
            localStorage.setItem(CLEF_LANGUE, vers);
        }
        catch {
            /* stockage refusé : le choix tient pour cette visite, et c'est déjà ça */
        }
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
        return _jsx("main", { class: "chargement", children: t.unInstant });
    if (ecran.quoi === 'projet') {
        const projet = projets.find((p) => p.id === ecran.id);
        if (projet === undefined)
            return _jsx("main", { class: "chargement", children: t.projetDisparu });
        return (_jsx(EcranProjet, { projet: projet, langue: langue, t: t, onChanger: remplacer, onFermer: () => setEcran({ quoi: 'liste' }) }));
    }
    return (_jsxs("main", { class: "liste", children: [_jsxs("div", { class: "entete", children: [_jsx("h1", { children: "\u00C9tabli" }), _jsx("button", { type: "button", class: "langue", onClick: () => changerLangue(langue === 'fr' ? 'en' : 'fr'), children: t.langue })] }), _jsx("p", { class: "sous-titre", children: t.accroche }), ouverture === 'en-cours' && _jsx("p", { class: "mot", children: t.ouvertureEnCours }), ouverture === 'introuvable' && _jsx("p", { class: "mot alerte", children: t.lienMort }), ouverture === 'echouee' && _jsx("p", { class: "mot alerte", children: t.lienIllisible }), _jsx("h2", { children: t.commencer }), _jsx("div", { class: "modeles", children: modeles(langue).map((m) => (_jsxs("button", { type: "button", class: "modele", onClick: () => creer(m.id), children: [_jsx("b", { children: m.nom }), _jsx("span", { children: m.dit })] }, m.id))) }), projets.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h2", { children: t.tesProjets }), _jsx("ul", { class: "projets", children: projets.map((p) => (_jsxs("li", { children: [_jsxs("button", { type: "button", class: "projet", onClick: () => setEcran({ quoi: 'projet', id: p.id }), children: [_jsx("b", { children: p.nom }), _jsx("span", { children: t.fichiers(p.fichiers.length) })] }), _jsx("button", { type: "button", class: "effacer", "aria-label": t.effacer(p.nom), onClick: () => effacer(p.id), children: "\u2715" })] }, p.id))) })] }))] }));
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
    return (_jsxs("main", { class: "projet-ouvert", children: [_jsxs("header", { class: "barre", children: [_jsx("button", { type: "button", class: "retour", onClick: props.onFermer, children: props.t.mesProjets }), _jsx("b", { class: "nom", children: props.projet.nom }), vue === 'ecrire' ? (_jsx("button", { type: "button", class: "lancer", onClick: lancer, children: props.t.lancer })) : (_jsx("button", { type: "button", class: "lancer", onClick: () => setVue('ecrire'), children: props.t.ecrire }))] }), vue === 'ecrire' ? (_jsx(Editeur, { projet: props.projet, ouvert: ouvert, onOuvrir: setOuvert, onEcrire: ecrire, onAjouter: ajouter, langue: props.langue, t: props.t })) : (_jsxs(_Fragment, { children: [_jsx(Apercu, { projet: props.projet, tour: tour, langue: props.langue, t: props.t }), _jsxs("div", { class: "actions", children: [_jsx("button", { type: "button", onClick: () => setTour((n) => n + 1), children: props.t.relancer }), _jsx("button", { type: "button", onClick: () => telecharger(props.projet), children: props.t.exporter })] }), _jsx(Partage, { projet: props.projet, onChanger: props.onChanger, t: props.t })] }))] }));
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
