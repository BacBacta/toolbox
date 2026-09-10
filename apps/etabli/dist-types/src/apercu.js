import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { BAC_A_SABLE, correction, enMegaoctets, estProjetPython, expliquer, juger, lireMessageDApercu, lireResultat, pourApercu, pourApercuPython, } from '@a237/etabli';
import { useEffect, useRef, useState } from 'preact/hooks';
import { dejaDescendu, manifestePython, moteurPython, posterMoteur } from './python-moteur.js';
/**
 * Ce que le code fait, et ce qu'il dit.
 *
 * Le cadre est isolé — voir `BAC_A_SABLE` : sans `allow-same-origin`, le code
 * exécuté ici n'atteint ni le stockage de l'Établi, ni ses cookies, ni son DOM.
 * C'est ce qui rend acceptable d'ouvrir un projet reçu de quelqu'un d'autre.
 *
 * La console en dessous n'est pas un ornement. Sur un ordinateur, une erreur
 * s'ouvre dans les outils du navigateur ; sur un Android d'entrée de gamme il
 * n'y a ni touche F12 ni outils, et une page blanche ressemble exactement à une
 * page qui charge. Sans cet écran-là, quelqu'un qui apprend conclut qu'il n'y
 * arrive pas, alors qu'il lui manquait une virgule.
 */
export function Apercu(props) {
    const cadre = useRef(null);
    const [journal, setJournal] = useState([]);
    const [resultats, setResultats] = useState([]);
    const [ouverte, setOuverte] = useState(false);
    const python = estProjetPython(props.projet);
    const moteur = useMoteurPython(python);
    // Chaque lancement repart d'une console vide : mélanger deux exécutions fait
    // chercher une erreur qu'on vient déjà de corriger.
    useEffect(() => { setJournal([]); setResultats([]); }, [props.tour]);
    useEffect(() => {
        function recevoir(e) {
            /*
             * L'identité du cadre, et non l'origine du message.
             *
             * Le cadre n'a pas d'origine — c'est le prix de l'isolement, et son
             * message arrive donc avec « null ». Ce qui l'identifie est sa fenêtre :
             * n'importe quelle page, n'importe quelle extension peut poster dans
             * celle-ci, et sans cette ligne leur texte s'afficherait comme s'il
             * venait du code de la personne.
             */
            if (cadre.current === null || e.source !== cadre.current.contentWindow)
                return;
            const message = lireMessageDApercu(e.data);
            if (message === null)
                return;
            /*
             * La correction ne s'affiche pas dans la console.
             *
             * Elle y écrit une ligne par épreuve. Les laisser passer noierait la
             * sortie de la personne sous la nôtre — et c'est sa sortie à elle qu'elle
             * regarde pour comprendre ce que son code fait.
             */
            const resultat = lireResultat(message.texte);
            if (resultat !== null) {
                setResultats((r) => [...r, resultat]);
                return;
            }
            setJournal((j) => [...j, message].slice(-MAX_LIGNES));
        }
        addEventListener('message', recevoir);
        return () => removeEventListener('message', recevoir);
    }, []);
    const erreurs = journal.filter((m) => m.sorte === 'erreur').length;
    const verdict = props.lecon === undefined ? null : juger(props.lecon.epreuves, resultats);
    /*
     * La correction est un fichier de plus, ajouté au moment de l'aperçu et
     * jamais rangé dans le projet.
     *
     * `assembler` met les scripts bout à bout dans l'ordre : ajouté en dernier,
     * le nôtre s'exécute après celui de la personne, donc ses fonctions existent
     * quand on les appelle. Et comme il ne touche pas au projet, il n'apparaît
     * pas dans les onglets et ne part pas dans l'export.
     */
    const aExecuter = props.lecon === undefined ? props.projet : {
        ...props.projet,
        fichiers: [...props.projet.fichiers,
            { nom: 'correction.js', contenu: correction(props.lecon.epreuves) }],
    };
    useEffect(() => {
        if (verdict?.reussi === true && props.lecon !== undefined)
            props.onReussie(props.lecon.id);
    }, [verdict?.reussi]);
    /*
     * Un projet Python n'affiche rien tant que le moteur n'est pas là.
     *
     * Le proposer avant de l'avoir serait un bouton qui échoue ; le télécharger
     * sans demander serait dépenser le forfait de quelqu'un à sa place. Entre les
     * deux, il n'y a qu'une chose honnête à faire : dire le prix.
     */
    if (python && moteur.envoi === null) {
        return (_jsx("div", { class: "apercu", children: _jsx(Python, { moteur: moteur, langue: props.langue, t: props.t }) }));
    }
    return (_jsxs("div", { class: "apercu", children: [_jsx("iframe", { ref: cadre, class: "apercu-cadre", title: props.t.cadreTitre, sandbox: BAC_A_SABLE, srcdoc: python
                    ? pourApercuPython(aExecuter, props.langue)
                    : pourApercu(aExecuter, props.langue), onLoad: () => {
                    /*
                     * Le moteur part **après** que le cadre est là, jamais avant.
                     *
                     * Poster dans un cadre qui n'a pas fini de charger fait disparaître le
                     * message sans erreur : l'écouteur n'existe pas encore. C'est le genre
                     * de panne qui ne se reproduit que sur un téléphone lent.
                     */
                    if (moteur.envoi === null || cadre.current === null)
                        return;
                    const fenetre = cadre.current.contentWindow;
                    if (fenetre !== null)
                        posterMoteur(fenetre, moteur.envoi);
                } }, props.tour), verdict !== null && props.lecon !== undefined && (_jsx(Copie, { verdict: verdict, lecon: props.lecon, t: props.t })), _jsxs("button", { type: "button", class: erreurs > 0 ? 'console-titre a-des-erreurs' : 'console-titre', onClick: () => setOuverte((o) => !o), children: [_jsxs("span", { children: [ouverte ? '▾' : '▸', " ", props.t.console] }), _jsx("span", { class: "console-compte", children: erreurs > 0 ? props.t.erreurs(erreurs) : `${journal.length}` })] }), ouverte && (_jsx("div", { class: "console", role: "log", children: journal.length === 0 ? (_jsxs("p", { class: "console-vide", children: [props.t.consoleVide, ' ', _jsx("code", { children: python ? 'print("hello")' : 'console.log("hello")' }), ' ', props.t.consoleVideExemple] })) : (journal.map((m, i) => (_jsx(Ligne, { message: m, langue: props.langue }, i)))) }))] }));
}
/**
 * Une ligne de console, et sa traduction quand on la connaît.
 *
 * C'est la pièce qui change l'outil de nature. `Uncaught SyntaxError:
 * Unexpected token '{'` ne dit rien à quelqu'un qui apprend — et rien du tout
 * s'il ne lit pas l'anglais. Or c'est précisément le moment où il conclut qu'il
 * n'y arrive pas, alors qu'il lui manquait une virgule.
 *
 * Le message d'origine reste affiché au-dessus : il faudra bien le reconnaître
 * le jour où on cherchera dans un moteur de recherche, et le cacher
 * apprendrait à dépendre de l'Établi.
 */
function Ligne(props) {
    const brut = props.message.sorte === 'erreur' ? expliquer(props.message.texte, props.langue) : null;
    return (_jsxs("div", { class: props.message.sorte === 'erreur' ? 'console-ligne erreur' : 'console-ligne', children: [_jsx("p", { class: "console-brut", children: props.message.texte }), brut !== null && (_jsxs("div", { class: "console-explication", children: [_jsx("p", { class: "quoi", children: brut.quoi }), _jsx("p", { class: "faire", children: brut.faire })] }))] }));
}
/**
 * Deux cents lignes gardées, les plus récentes.
 *
 * Une boucle qui journalise en écrit des milliers en une seconde. Toutes les
 * garder ferait ramer l'écran de celui qui essaie justement de comprendre
 * pourquoi sa boucle s'emballe — et c'est la fin de la ligne qui l'intéresse.
 */
const MAX_LIGNES = 200;
/**
 * Python, cherché puis descendu — jamais sans qu'on l'ait demandé.
 *
 * `manifeste` vaut `undefined` tant qu'on cherche, `null` quand cette
 * installation n'a pas Python du tout. Les deux ne se confondent pas : le
 * premier est passager, le second est définitif, et afficher « indisponible »
 * pendant qu'on cherche encore ferait renoncer quelqu'un pour rien.
 */
function useMoteurPython(actif) {
    const [manifeste, setManifeste] = useState(undefined);
    const [envoi, setEnvoi] = useState(null);
    const [avancement, setAvancement] = useState(null);
    const [echoue, setEchoue] = useState(false);
    const [demande, setDemande] = useState(0);
    useEffect(() => {
        if (!actif)
            return;
        let vivant = true;
        void (async () => {
            const m = await manifestePython();
            if (!vivant)
                return;
            setManifeste(m);
            // Déjà sur le téléphone : on le charge sans rien demander. Le prix a
            // été payé une fois, il n'y a plus de choix à poser.
            if (m !== null && (await dejaDescendu(m)))
                setDemande((d) => (d === 0 ? 1 : d));
        })();
        return () => { vivant = false; };
    }, [actif]);
    useEffect(() => {
        if (demande === 0 || manifeste === null || manifeste === undefined)
            return;
        let vivant = true;
        setEchoue(false);
        void (async () => {
            try {
                const e = await moteurPython(manifeste, (a) => { if (vivant)
                    setAvancement(a); });
                if (vivant)
                    setEnvoi(e);
            }
            catch {
                // Le réseau a coupé, ou un fichier est arrivé tronqué. Ce qui est déjà
                // gardé l'est bien : reprendre ne repart pas de zéro.
                if (vivant) {
                    setEchoue(true);
                    setAvancement(null);
                }
            }
        })();
        return () => { vivant = false; };
    }, [demande, manifeste]);
    return { manifeste, envoi, avancement, echoue, descendre: () => setDemande((d) => d + 1) };
}
/**
 * Le prix, puis le bouton.
 *
 * Cinq mégaoctets sur un forfait compté à l'octet, ce n'est pas un détail
 * technique : c'est de l'argent, et quelqu'un qui ne l'apprend qu'en voyant son
 * solde ne reviendra pas. Le chiffre est donc écrit avant, en gros, et il vient
 * du manifeste mesuré à la construction — pas d'une constante tapée à la main
 * qui mentirait à la version suivante.
 */
function Python(props) {
    const { manifeste, avancement, echoue } = props.moteur;
    if (manifeste === undefined)
        return _jsx("p", { class: "vide", children: props.t.unInstant });
    if (manifeste === null)
        return _jsx("p", { class: "vide", children: props.t.pythonIndisponible });
    const taille = enMegaoctets(manifeste.surLeFil, props.langue);
    if (avancement !== null && !echoue) {
        const fait = Math.min(100, Math.round((avancement.recus / avancement.total) * 100));
        return (_jsxs("div", { class: "python", children: [_jsx("p", { class: "python-etat", children: props.t.pythonEnCours(fait) }), _jsx("div", { class: "python-jauge", role: "progressbar", "aria-valuenow": fait, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": props.t.pythonEnCours(fait), children: _jsx("div", { class: "python-jauge-faite", style: `width: ${fait}%` }) })] }));
    }
    return (_jsxs("div", { class: "python", children: [_jsx("h2", { class: "python-titre", children: props.t.pythonTitre }), _jsx("p", { class: "python-pourquoi", children: props.t.pythonPourquoi(taille) }), _jsx("p", { class: "python-fois", children: props.t.pythonUneSeuleFois }), echoue && _jsx("p", { class: "python-echoue", children: props.t.pythonEchoue }), _jsx("button", { type: "button", class: "python-oui", onClick: props.moteur.descendre, children: echoue ? props.t.pythonReessayer : props.t.pythonTelecharger(taille) })] }));
}
/**
 * La copie rendue : réussi, ou bien où regarder.
 *
 * Jamais « faux ». Quelqu'un qui apprend seul n'a personne pour relativiser un
 * refus, et « faux » sans rien d'autre est ce qui fait fermer l'application.
 * On montre donc ce qui a été demandé, ce que son code a rendu, et une piste —
 * les trois choses qu'un professeur dirait en se penchant sur le cahier.
 */
function Copie(props) {
    if (props.verdict.reussi) {
        return (_jsxs("div", { class: "copie reussie", role: "status", children: [_jsx("b", { children: props.t.leconReussie }), _jsx("span", { children: props.t.leconSuivante })] }));
    }
    return (_jsxs("div", { class: "copie", role: "status", children: [_jsx("b", { children: props.t.leconPasEncore }), _jsx("ul", { class: "copie-manque", children: props.verdict.manque.map((m) => (_jsxs("li", { children: [_jsx("code", { children: m.appel }), _jsx("span", { children: props.t.leconAttendu(m.attendu, m.obtenu) })] }, m.appel))) }), _jsx("p", { class: "copie-indice", children: props.lecon.indice })] }));
}
