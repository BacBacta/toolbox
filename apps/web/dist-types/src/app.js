import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { CATALOGUE, EXTRAIT_VIDE, montantF } from '@a237/engine';
import { useEffect, useState } from 'preact/hooks';
import { Diffusion } from './diffusion.js';
import { CHARGEURS, outilDisponible } from './outils.js';
import { creerOutil, listerOutils, lireOutil, majEtat, supprimerOutil } from './stockage.js';
import { Atelier } from './atelier.js';
/**
 * La coquille.
 *
 * Elle ne connaît aucun outil : elle liste des squelettes, range des états, et
 * charge à la demande le fragment qui sait dessiner celui qu'on ouvre. C'est ce
 * découpage qui tient le budget de 120 Ko avec dix-sept outils.
 */
/** Les squelettes dont le moteur de rendu est écrit. */
const DISPONIBLES = CATALOGUE.filter((f) => outilDisponible(f.id));
/**
 * Le signe d'un outil ouvert.
 *
 * Un registre composé par le modèle n'est dans aucun catalogue : il porte son
 * propre signe, l'astérisque, et non le losange de repli. Ce losange dit « je
 * ne connais pas cet outil » — vrai pour un état enregistré par une version
 * plus ancienne, faux pour un registre composé, qui est un cas normal.
 */
function glyphePour(skeleton) {
    if (skeleton.startsWith('compose'))
        return '✳';
    return CATALOGUE.find((f) => f.id === skeleton)?.glyphe ?? '◇';
}
function Accueil(props) {
    return (_jsxs(_Fragment, { children: [_jsxs("header", { class: "app-entete", children: [_jsx("h1", { class: "titre-app", children: "Atelier 237" }), _jsx("span", { class: "app-baseline", children: "hors ligne, sur ton t\u00E9l\u00E9phone" })] }), _jsx(Atelier, { fiches: DISPONIBLES, onCreer: props.onCreer }), _jsx("h2", { class: "outil-surtitre", children: "Tous les outils" }), _jsx("div", { class: "grille", children: DISPONIBLES.map((s) => (_jsxs("button", { type: "button", class: "carte-squelette", onClick: () => props.onCreer(s.id, EXTRAIT_VIDE), children: [_jsx("span", { class: "marque", "aria-hidden": "true", children: s.glyphe }), _jsxs("span", { class: "texte", children: [_jsx("b", { children: s.title }), _jsx("span", { children: s.group })] })] }, s.id))) }), _jsx("h2", { class: "outil-surtitre", children: "Mes outils" }), props.outils.length === 0 ? (_jsx("p", { class: "note", children: "Rien pour l\u2019instant. Choisis un outil ci-dessus." })) : (_jsx("div", { class: "outil-rangees", children: props.outils.map((o) => (_jsxs("div", { class: "outil-rangee", children: [_jsx("button", { type: "button", class: "identite lien-outil", onClick: () => props.onOuvrir(o.id), children: _jsxs("span", { class: "nom", children: [_jsx("span", { class: "n1", children: o.nom }), _jsx("span", { class: "n2", children: o.skeleton })] }) }), _jsx("button", { type: "button", class: "outil-retirer", "aria-label": `Supprimer ${o.nom}`, onClick: () => props.onSupprimer(o.id), children: "\u00D7" })] }, o.id))) }))] }));
}
export function App() {
    const [outils, setOutils] = useState([]);
    const [ouvert, setOuvert] = useState(null);
    const [module, setModule] = useState(null);
    const [coutDernier, setCoutDernier] = useState(null);
    const [partage, setPartage] = useState(null);
    const [erreur, setErreur] = useState('');
    useEffect(() => {
        void listerOutils().then(setOutils);
    }, []);
    useEffect(() => {
        if (ouvert === null) {
            setModule(null);
            return;
        }
        const chargeur = CHARGEURS[ouvert.skeleton];
        if (chargeur === undefined) {
            setErreur(`Cet outil n’a pas encore d’écran : ${ouvert.skeleton}.`);
            return;
        }
        void chargeur().then(setModule, () => setErreur('Cet outil n’a pas pu être chargé. Réessaie une fois en ligne.'));
    }, [ouvert]);
    /**
     * Un `void promesse()` avale les rejets, et l'écran reste alors figé sans
     * rien dire — le pire des comportements pour quelqu'un qui a un réseau
     * capricieux et un téléphone plein. Tout ce qui est asynchrone passe par ici.
     */
    function tenter(travail, quoi) {
        void travail().catch((cause) => {
            setErreur(`${quoi} : ${cause instanceof Error ? cause.message : String(cause)}`);
        });
    }
    async function creer(skeleton, extrait, compose, fcfa) {
        const chargeur = CHARGEURS[skeleton];
        if (chargeur === undefined)
            throw new Error(`aucun écran pour « ${skeleton} »`);
        const maintenant = new Date();
        const neuf = (await chargeur()).creer(skeleton, maintenant, extrait, compose);
        const outil = await creerOutil(skeleton, neuf.nom, neuf.etat, maintenant, compose);
        setOutils(await listerOutils());
        setOuvert(outil);
        /*
         * Ce que la composition a coûté, dit une fois.
         *
         * La consommation se paie à l'appel : une dépense qu'on ne voit pas est
         * une dépense qu'on découvre à la fin du mois. Elle s'affiche sur l'outil
         * qu'elle vient d'ouvrir, puis disparaît au suivant.
         */
        setCoutDernier(fcfa ?? null);
    }
    async function changer(etat) {
        if (ouvert === null)
            return;
        const suivant = await majEtat(ouvert, etat, new Date());
        setOuvert(suivant);
        setOutils(await listerOutils());
    }
    async function supprimer(id) {
        await supprimerOutil(id);
        setOutils(await listerOutils());
    }
    async function ouvrir(id) {
        // Le coût affiché appartient à la composition qui vient d'avoir lieu, pas
        // à l'outil qu'on rouvre : il s'efface dès qu'on passe à autre chose.
        setCoutDernier(null);
        setOuvert(await lireOutil(id));
    }
    if (ouvert === null) {
        return (_jsxs("main", { class: "app", children: [erreur !== '' && _jsx("div", { class: "alerte", children: erreur }), _jsx(Accueil, { outils: outils, onCreer: (s, extrait, compose, fcfa) => tenter(() => creer(s, extrait, compose, fcfa), 'Création impossible'), onOuvrir: (id) => tenter(() => ouvrir(id), 'Ouverture impossible'), onSupprimer: (id) => tenter(() => supprimer(id), 'Suppression impossible') })] }));
    }
    /**
     * Le lien est vide tant que la publication n'existe pas.
     *
     * Il serait facile d'écrire `atl.cm/a/1234` sur la carte et dans les
     * relances : ce serait un lien mort, envoyé par le trésorier à ses membres,
     * sous son nom. Le moteur sait taire un lien vide ; la phase 2 le remplira
     * avec l'adresse que le serveur aura vraiment attribuée.
     */
    const ctx = { lien: '', maintenant: new Date() };
    return (_jsxs("main", { class: "app", children: [_jsx("button", { type: "button", class: "retour", onClick: () => {
                    setOuvert(null);
                    setErreur('');
                }, children: "\u2190 Mes outils" }), erreur !== '' && _jsx("div", { class: "alerte", children: erreur }), coutDernier !== null && (_jsxs("p", { class: "note cout-compose", children: ["Compos\u00E9 par le mod\u00E8le pour ", montantF(coutDernier), "."] })), module === null ? (_jsx("p", { class: "note", children: "Chargement de l\u2019outil\u2026" })) : (_jsx(module.Outil, { outil: ouvert, glyphe: glyphePour(ouvert.skeleton), ctx: ctx, onChange: (etat) => tenter(() => changer(etat), 'Enregistrement impossible'), onDiffuser: setPartage })), partage !== null && _jsx(Diffusion, { partage: partage, onFermer: () => setPartage(null) })] }));
}
