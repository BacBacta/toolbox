import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { CATALOGUE, EXTRAIT_VIDE, lienPublic, montantF } from '@a237/engine';
import { useEffect, useState } from 'preact/hooks';
import { dernierEtatConnu } from './compte.js';
import { Diffusion } from './diffusion.js';
import { viderLaFile } from './file.js';
import { publier, televerserCarte } from './publier.js';
import { CHARGEURS, outilDisponible } from './outils.js';
import { numeroter } from './numeros.js';
import { creerOutil, filerPublication, listerOutils, lireOutil, majEtat, noterPublication, nouvelIdentifiant, supprimerOutil, } from './stockage.js';
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
    const [compte, setCompte] = useState(null);
    /*
     * L'écran du compte se charge à la demande, comme les outils.
     *
     * Il n'est sur le chemin de personne : on y arrive par une ligne discrète, et
     * la plupart des gens ne l'ouvriront jamais. Deux kilo-octets dans la
     * coquille initiale pour ça, c'est deux kilo-octets payés par tout le monde
     * avant le premier affichage, sur la connexion qu'ils ont.
     */
    const [surLeCompte, setSurLeCompte] = useState(false);
    const [ecranCompte, setEcranCompte] = useState(null);
    const [ouvert, setOuvert] = useState(null);
    const [module, setModule] = useState(null);
    const [coutDernier, setCoutDernier] = useState(null);
    const [partage, setPartage] = useState(null);
    const [erreur, setErreur] = useState('');
    /** Ce que la dernière tentative de dépôt a donné, dit dans la feuille. */
    const [motPublication, setMotPublication] = useState('');
    useEffect(() => {
        void listerOutils().then(setOutils);
        // Le dernier état connu, gardé sur l'appareil : la ligne s'affiche en mode
        // avion, et se rafraîchit quand une composition la met à jour.
        void dernierEtatConnu().then(setCompte);
    }, []);
    /*
     * Ce qui n'est pas parti repart, au lancement et au retour du réseau.
     *
     * Une file dans laquelle on dépose sans jamais rien retirer n'est pas une
     * file d'attente, c'est un tiroir. Rien ne s'affiche : la publication est
     * une conséquence de « Diffuser », pas une tâche que l'utilisateur suit. Ce
     * qui change, c'est que l'outil a désormais son adresse.
     */
    useEffect(() => {
        const reprendre = () => {
            void viderLaFile(new Date()).then(async (bilan) => {
                if (bilan.publies > 0)
                    setOutils(await listerOutils());
            });
        };
        reprendre();
        globalThis.addEventListener('online', reprendre);
        return () => globalThis.removeEventListener('online', reprendre);
    }, []);
    useEffect(() => {
        if (!surLeCompte)
            return;
        void import('./ecran-compte.js').then((m) => setEcranCompte(() => m.EcranCompte));
    }, [surLeCompte]);
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
    /**
     * Diffuser, c'est d'abord publier.
     *
     * L'ordre n'est pas indifférent : la carte porte le lien, donc il faut que
     * le lien existe avant de la dessiner. Un dépôt refusé, en conflit ou
     * simplement hors ligne n'empêche pas de partager — la carte part sans
     * adresse, comme avant, et l'écran dit pourquoi.
     */
    async function diffuser(batir, outil) {
        const maintenant = new Date();
        const avec = (lien) => batir({
            lien: lien === undefined ? '' : lienPublic(location.host, lien),
            maintenant,
        });
        if (outil.lien !== undefined && outil.versionPubliee === outil.version) {
            // Rien n'a bougé depuis le dernier dépôt : le lien vaut toujours, et on
            // ne dépense pas une requête pour le redire.
            setMotPublication('');
            setPartage(avec(outil.lien));
            return;
        }
        const issue = await publier(outil, maintenant, outil.lien);
        if (issue.sorte === 'publie') {
            const suivant = await noterPublication(outil, issue.lien, outil.version);
            setOuvert(suivant);
            setOutils(await listerOutils());
            setMotPublication('');
            setPartage(avec(issue.lien));
            return;
        }
        if (issue.sorte === 'refuse')
            setMotPublication(issue.pourquoi);
        else if (issue.sorte === 'conflit') {
            setMotPublication(`Une version plus récente de cet outil est déjà publiée (version ${issue.versionServeur}). ` +
                'Ouvre-la, compare, puis modifie ici pour la remplacer.');
        }
        else {
            await filerPublication({
                id: nouvelIdentifiant(),
                outilId: outil.id,
                version: outil.version,
                creeLe: Date.now(),
            });
            setMotPublication('Pas de réseau : la publication attend son tour. La carte part sans lien pour l’instant.');
        }
        // La carte part sans adresse plutôt que d'en porter une qui ne répond pas.
        setPartage(avec(issue.sorte === 'refuse' ? undefined : outil.lien));
    }
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
        /*
         * Le squelette a posé un numéro de gabarit : il connaît son préfixe et
         * l'année, pas ce que ce compte a déjà émis. Celui qui compte se réserve
         * ici, sur un registre qu'une suppression ne fait pas reculer — sans quoi
         * effacer la dernière facture réattribuerait son numéro à la suivante.
         */
        const etat = await numeroter(skeleton, neuf.etat, maintenant);
        const outil = await creerOutil(skeleton, neuf.nom, etat, maintenant, compose);
        setOutils(await listerOutils());
        setOuvert(outil);
        /*
         * Le solde a peut-être changé, et l'écran doit le voir.
         *
         * Une composition rapporte le solde avec sa réponse, et `composer` le range
         * sur l'appareil — mais l'état affiché avait été lu une fois, au montage.
         * La ligne du compte restait donc absente jusqu'au lancement suivant : on
         * venait de dépenser un crédit sans que rien ne le dise.
         *
         * On relit après chaque création, y compris celles qui ne coûtent rien :
         * une lecture d'IndexedDB ne se sent pas, et distinguer les deux cas ici
         * ferait dépendre l'affichage d'une règle qui se décide ailleurs.
         */
        setCompte(await dernierEtatConnu());
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
    if (surLeCompte) {
        const Ecran = ecranCompte;
        return (_jsx("main", { class: "app", children: Ecran === null ? (_jsx("p", { class: "note", children: "Un instant\u2026" })) : (_jsx(Ecran, { etat: compte, onEtat: setCompte, onRetour: () => setSurLeCompte(false) })) }));
    }
    if (ouvert === null) {
        return (_jsxs("main", { class: "app", children: [erreur !== '' && _jsx("div", { class: "alerte", children: erreur }), _jsx(Accueil, { outils: outils, onCreer: (s, extrait, compose, fcfa) => tenter(() => creer(s, extrait, compose, fcfa), 'Création impossible'), onOuvrir: (id) => tenter(() => ouvrir(id), 'Ouverture impossible'), onSupprimer: (id) => tenter(() => supprimer(id), 'Suppression impossible') }), compte !== null && (_jsx("button", { type: "button", class: "compte-ligne", onClick: () => setSurLeCompte(true), children: compte.plan === 'atelier'
                        ? `Atelier · ${compte.credits} compositions`
                        : compte.credits === 0
                            ? 'Essai · plus de composition'
                            : `Essai · ${compte.credits} composition${compte.credits > 1 ? 's' : ''}` }))] }));
    }
    /**
     * Le lien de l'outil ouvert, ou rien.
     *
     * Il ne s'écrit qu'une fois le dépôt accepté. Inventer `atl.cm/a/1234` sur
     * la carte et dans les relances ferait un lien mort, envoyé par le trésorier
     * à ses membres, sous son nom. Le moteur sait taire un lien vide.
     */
    const ctx = {
        lien: ouvert.lien === undefined ? '' : lienPublic(location.host, ouvert.lien),
        maintenant: new Date(),
    };
    return (_jsxs("main", { class: "app", children: [_jsx("button", { type: "button", class: "retour", onClick: () => {
                    setOuvert(null);
                    setErreur('');
                }, children: "\u2190 Mes outils" }), erreur !== '' && _jsx("div", { class: "alerte", children: erreur }), coutDernier !== null && (_jsxs("p", { class: "note cout-compose", children: ["Compos\u00E9 par le mod\u00E8le pour ", montantF(coutDernier), "."] })), module === null ? (_jsx("p", { class: "note", children: "Chargement de l\u2019outil\u2026" })) : (_jsx(module.Outil, { outil: ouvert, glyphe: glyphePour(ouvert.skeleton), ctx: ctx, onChange: (etat) => tenter(() => changer(etat), 'Enregistrement impossible'), onDiffuser: (batir) => tenter(() => diffuser(batir, ouvert), 'Diffusion impossible') })), partage !== null && (_jsx(Diffusion, { partage: partage, mot: motPublication, 
                /*
                 * La carte suit le dépôt, elle ne le précède pas. Ce qui rate ici ne
                 * se dit pas : sans image, l'aperçu WhatsApp porte le titre et la
                 * description, ce qui est moins bien et n'est pas une panne.
                 */
                onCarte: (png) => {
                    if (ouvert.lien !== undefined)
                        void televerserCarte(ouvert.lien, png);
                }, onFermer: () => setPartage(null) }))] }));
}
