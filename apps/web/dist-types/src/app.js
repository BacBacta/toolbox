import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { CATALOGUE, classer } from '@a237/engine';
import { useEffect, useState } from 'preact/hooks';
import { Diffusion } from './diffusion.js';
import { CHARGEURS, outilDisponible } from './outils.js';
import { creerOutil, listerOutils, lireOutil, majEtat, supprimerOutil } from './stockage.js';
/**
 * La coquille.
 *
 * Elle ne connaît aucun outil : elle liste des squelettes, range des états, et
 * charge à la demande le fragment qui sait dessiner celui qu'on ouvre. C'est ce
 * découpage qui tient le budget de 120 Ko avec dix-sept outils.
 */
/** Les squelettes dont le moteur de rendu est écrit. */
const DISPONIBLES = CATALOGUE.filter((f) => outilDisponible(f.id));
function Accueil(props) {
    const [recherche, setRecherche] = useState('');
    // Étage 1 du moteur : correspondance de mots-clés, zéro jeton (§ 4).
    const proposes = recherche.trim() === ''
        ? DISPONIBLES
        : classer(recherche, DISPONIBLES).map((c) => c.squelette);
    return (_jsxs(_Fragment, { children: [_jsx("h1", { class: "titre-app", children: "Atelier 237" }), _jsxs("label", { class: "champ", for: "recherche", children: [_jsx("span", { class: "champ-libelle", children: "De quoi as-tu besoin ?" }), _jsx("input", { id: "recherche", type: "search", value: recherche, placeholder: "il me faut un devis, noter le njangi\u2026", onInput: (e) => setRecherche(e.target.value) })] }), proposes.length === 0 ? (_jsx("p", { class: "note", children: "Rien ne correspond encore. Les autres outils du prototype arrivent ; en attendant, essaie \u00AB devis \u00BB, \u00AB facture \u00BB ou \u00AB njangi \u00BB." })) : (_jsx("div", { class: "grille", children: proposes.map((s) => (_jsxs("button", { type: "button", class: "carte-squelette", onClick: () => props.onCreer(s.id), children: [_jsx("b", { children: s.title }), _jsx("span", { children: s.group })] }, s.id))) })), _jsx("h2", { class: "outil-surtitre", children: "Mes outils" }), props.outils.length === 0 ? (_jsx("p", { class: "note", children: "Rien pour l\u2019instant. Choisis un outil ci-dessus." })) : (_jsx("div", { class: "outil-rangees", children: props.outils.map((o) => (_jsxs("div", { class: "outil-rangee", children: [_jsx("button", { type: "button", class: "identite lien-outil", onClick: () => props.onOuvrir(o.id), children: _jsxs("span", { class: "nom", children: [_jsx("span", { class: "n1", children: o.nom }), _jsx("span", { class: "n2", children: o.skeleton })] }) }), _jsx("button", { type: "button", class: "outil-retirer", "aria-label": `Supprimer ${o.nom}`, onClick: () => props.onSupprimer(o.id), children: "\u00D7" })] }, o.id))) }))] }));
}
export function App() {
    const [outils, setOutils] = useState([]);
    const [ouvert, setOuvert] = useState(null);
    const [module, setModule] = useState(null);
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
    async function creer(skeleton) {
        const chargeur = CHARGEURS[skeleton];
        if (chargeur === undefined)
            throw new Error(`aucun écran pour « ${skeleton} »`);
        const maintenant = new Date();
        const neuf = (await chargeur()).creer(maintenant);
        const outil = await creerOutil(skeleton, neuf.nom, neuf.etat, maintenant);
        setOutils(await listerOutils());
        setOuvert(outil);
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
        setOuvert(await lireOutil(id));
    }
    if (ouvert === null) {
        return (_jsxs("main", { class: "app", children: [erreur !== '' && _jsx("div", { class: "alerte", children: erreur }), _jsx(Accueil, { outils: outils, onCreer: (s) => tenter(() => creer(s), 'Création impossible'), onOuvrir: (id) => tenter(() => ouvrir(id), 'Ouverture impossible'), onSupprimer: (id) => tenter(() => supprimer(id), 'Suppression impossible') })] }));
    }
    const ctx = { lien: `atl.cm/a/${ouvert.id.slice(0, 4)}`, maintenant: new Date() };
    return (_jsxs("main", { class: "app", children: [_jsx("button", { type: "button", class: "retour", onClick: () => {
                    setOuvert(null);
                    setErreur('');
                }, children: "\u2190 Mes outils" }), erreur !== '' && _jsx("div", { class: "alerte", children: erreur }), module === null ? (_jsx("p", { class: "note", children: "Chargement de l\u2019outil\u2026" })) : (_jsx(module.Outil, { outil: ouvert, ctx: ctx, onChange: (etat) => tenter(() => changer(etat), 'Enregistrement impossible'), onDiffuser: setPartage })), partage !== null && _jsx(Diffusion, { partage: partage, onFermer: () => setPartage(null) })] }));
}
