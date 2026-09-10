import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { EXTRAIT_VIDE, composeDe, coutF, ebaucheFinie, squeletteDe } from '@a237/engine';
import { PageFormulaire, PageVitrine } from '@a237/render/page';
import '@a237/render/styles/vitrine.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { parler } from './agent.js';
const NOM_FAMILLE = {
    registre: 'un registre',
    calcul: 'une calculatrice',
    page: 'une page',
    formulaire: 'un formulaire',
    refus: '',
};
export function EcranAgent(props) {
    const [messages, setMessages] = useState([
        { qui: 'personne', texte: props.demande },
    ]);
    const [ebauche, setEbauche] = useState(null);
    /**
     * Le dernier tour, quel qu'il soit — et l'outil, seulement s'il s'ouvre.
     *
     * Deux états et non un, parce que ce ne sont pas les mêmes questions. La
     * fenêtre montre **ce que le dernier tour a donné**, y compris un refus ; le
     * bouton n'apparaît que s'il y a un écran derrière. Confondre les deux
     * laissait la fenêtre annoncer « ton outil apparaîtra ici » juste après un
     * « je ne sais pas faire ça » — ce qui est faux, et se lit comme une attente
     * qui n'aboutira jamais.
     */
    const [dernier, setDernier] = useState(null);
    const [outil, setOutil] = useState(null);
    const [conversation, setConversation] = useState(undefined);
    const [etat, setEtat] = useState('repos');
    const [saisie, setSaisie] = useState('');
    const [cout, setCout] = useState(0);
    /*
     * Le tour en cours, pour pouvoir l'abandonner.
     *
     * Quitter l'écran pendant que l'agent écrit doit couper le flux : sans ça, la
     * lecture continue dans le vide, et sur un téléphone qui compte ses
     * mégaoctets ça se paie.
     */
    const enCours = useRef(null);
    const filDeLaConversation = useRef(null);
    useEffect(() => {
        return () => enCours.current?.abort();
    }, []);
    // La conversation suit ce qui s'écrit, comme dans WhatsApp.
    useEffect(() => {
        const fil = filDeLaConversation.current;
        if (fil !== null)
            fil.scrollTop = fil.scrollHeight;
    }, [messages, ebauche]);
    async function jouer(suite) {
        enCours.current?.abort();
        const abandon = new AbortController();
        enCours.current = abandon;
        setEtat('ecoute');
        setEbauche(null);
        for await (const signe of parler({
            messages: suite,
            ...(outil === null ? {} : { outil: brutDe(outil.tour) }),
            ...(conversation === undefined ? {} : { conversation }),
        }, abandon.signal)) {
            if (signe.sorte === 'ebauche') {
                setEbauche(signe.ebauche);
                continue;
            }
            if (signe.sorte === 'fin') {
                setConversation(signe.conversation);
                setCout((c) => c + signe.fcfa);
                setMessages([...suite, { qui: 'agent', texte: signe.tour.mot }]);
                setEbauche(null);
                setDernier(signe.tour);
                /*
                 * Un refus n'est pas un outil, même s'il en occupe la place.
                 *
                 * La condition était « ce n'est pas invalide », et un refus ne l'est
                 * pas : le bouton « Ouvrir cet outil » s'affichait donc après un
                 * « je ne sais pas faire ça », et ne faisait rien. Un bouton mort est
                 * pire qu'un bouton absent — on clique deux fois avant de comprendre
                 * que c'est l'application qui a un problème, et ce n'en est pas un.
                 *
                 * Ce qui décide est ce qui décidera à l'ouverture : y a-t-il un écran
                 * derrière ?
                 */
                if (signe.tour.sorte === 'outil' && squeletteDe(signe.tour.outil) !== null) {
                    setOutil({ tour: signe.tour });
                }
                setEtat('repos');
                return;
            }
            setEbauche(null);
            setEtat({ fini: motDePanne(signe) });
            return;
        }
        setEtat('repos');
    }
    function envoyer(texte) {
        const propre = texte.trim();
        if (propre === '' || etat === 'ecoute')
            return;
        setSaisie('');
        const suite = [...messages, { qui: 'personne', texte: propre }];
        setMessages(suite);
        void jouer(suite);
    }
    // Le premier tour part tout seul : la phrase a déjà été tapée dans l'atelier.
    useEffect(() => {
        void jouer(messages);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const pret = outil !== null && outil.tour.sorte === 'outil';
    return (_jsxs("section", { class: "agent", children: [_jsxs("header", { class: "agent-tete", children: [_jsx("button", { type: "button", class: "retour", onClick: props.onFermer, children: "\u2190 Mes outils" }), cout > 0 && _jsx("span", { class: "agent-cout", children: coutF(cout) })] }), _jsx("div", { class: "agent-fenetre", children: _jsx(Fenetre, { ebauche: ebauche, tour: dernier, ecoute: etat === 'ecoute' }) }), _jsxs("div", { class: "agent-fil", ref: filDeLaConversation, children: [messages.map((m, i) => (_jsx("p", { class: m.qui === 'agent' ? 'dit-agent' : 'dit-personne', children: m.texte }, `${i}-${m.texte}`))), ebauche !== null && ebauche.mot !== '' && _jsx("p", { class: "dit-agent", children: ebauche.mot }), etat === 'ecoute' && ebauche === null && _jsx("p", { class: "dit-agent attente", children: "\u2026" }), typeof etat === 'object' && _jsx("p", { class: "dit-panne", children: etat.fini })] }), pret && (_jsx("button", { type: "button", class: "agent-ouvrir", onClick: () => ouvrir(outil.tour, props.onCreer, cout), children: "Ouvrir cet outil" })), _jsxs("form", { class: "agent-saisie", onSubmit: (e) => {
                    e.preventDefault();
                    envoyer(saisie);
                }, children: [_jsx("input", { type: "text", enterkeyhint: "send", autocomplete: "off", value: saisie, placeholder: pret ? 'Change quelque chose…' : 'Dis-m’en plus…', "aria-label": "R\u00E9pondre \u00E0 l\u2019atelier", onInput: (e) => setSaisie(e.target.value) }), _jsx("button", { type: "submit", disabled: etat === 'ecoute' || saisie.trim() === '', children: "Envoyer" })] })] }));
}
/**
 * La fenêtre où l'on voit ce qui est en train d'être fabriqué.
 *
 * Trois états, et le premier compte autant que les autres : **avant** que le
 * modèle ait dit quoi que ce soit, elle dit ce qu'elle attend plutôt que de
 * rester blanche. Un rectangle vide pendant huit secondes se lit comme une
 * panne, et sur une connexion qui hoquette huit secondes deviennent trente.
 */
function Fenetre(props) {
    /*
     * Une seule forme à dessiner, avant comme après.
     *
     * La fenêtre se vidait à l'instant précis où l'outil était prêt : l'ébauche
     * est effacée quand le flux se termine, et il n'y avait plus rien derrière.
     * On voyait donc l'outil s'écrire, puis disparaître au moment de le
     * regarder — c'est-à-dire au seul moment où on le regarde vraiment.
     */
    const termine = props.tour?.sorte === 'outil' && props.tour.outil.sorte !== 'invalide'
        ? ebaucheFinie(props.tour.mot, props.tour.outil)
        : null;
    const e = props.ebauche ?? termine;
    if (e === null) {
        return (_jsx("div", { class: "fenetre vide", children: _jsx("p", { class: "fenetre-attente", children: props.ecoute ? 'Je regarde ce que tu demandes…' : 'Ton outil apparaîtra ici.' }) }));
    }
    const { famille, titre, pieces } = e;
    if (famille === 'refus') {
        return (_jsx("div", { class: "fenetre vide", children: _jsx("p", { class: "fenetre-attente", children: "Ce n\u2019est pas un outil que je sais fabriquer." }) }));
    }
    /*
     * Une fois fini, on montre **la chose elle-même** quand elle se dessine sans
     * état : une page et un formulaire se rendent à partir de leur seule
     * configuration, et c'est ce qu'un client verra. Un registre et une
     * calculatrice, eux, sont des écrans qu'on remplit — leur essence est la
     * liste de leurs colonnes, et c'est déjà ce qui est affiché.
     */
    const vraie = props.ebauche === null ? vraieVue(props.tour) : null;
    if (vraie !== null) {
        return (_jsxs("div", { class: "fenetre montre", children: [_jsx("p", { class: "fenetre-famille", children: famille === null ? '' : NOM_FAMILLE[famille] }), _jsx("div", { class: "fenetre-vue", children: vraie })] }));
    }
    return (_jsxs("div", { class: props.ecoute ? 'fenetre ecrit' : 'fenetre', children: [famille !== null && _jsx("p", { class: "fenetre-famille", children: NOM_FAMILLE[famille] }), _jsx("p", { class: "fenetre-titre", children: titre === '' ? '…' : titre }), pieces.length > 0 && (_jsx("ul", { class: "fenetre-pieces", children: pieces.map((p, i) => (_jsx("li", { children: p }, `${i}-${p}`))) })), props.ecoute && _jsx("p", { class: "fenetre-encours", children: "j\u2019\u00E9cris\u2026" })] }));
}
/**
 * Ce que le lecteur verra, quand ça se dessine sans état.
 *
 * Le formulaire est rendu **sans `action`** : ses champs sont inertes, et il ne
 * poste nulle part. Un aperçu qui envoie vraiment ajouterait la réponse de
 * celui qui fabrique le formulaire à celles qu'il attend.
 */
function vraieVue(tour) {
    if (tour === null || tour.sorte !== 'outil')
        return null;
    const outil = tour.outil;
    if (outil.sorte === 'page') {
        const ctx = { lien: '', maintenant: new Date() };
        return _jsx(PageVitrine, { page: outil.page, maintenant: ctx.maintenant });
    }
    if (outil.sorte === 'formulaire')
        return _jsx(PageFormulaire, { formulaire: outil.formulaire });
    return null;
}
/** La configuration brute, telle qu'elle repart au serveur au tour suivant. */
function brutDe(tour) {
    if (tour.sorte !== 'outil')
        return undefined;
    const c = composeDe(tour.outil);
    return c === null ? undefined : (c.registre ?? c.calcul ?? c.page ?? c.formulaire);
}
function ouvrir(tour, onCreer, fcfa) {
    if (tour.sorte !== 'outil')
        return;
    const skeleton = squeletteDe(tour.outil);
    const compose = composeDe(tour.outil);
    if (skeleton === null || compose === null)
        return;
    onCreer(skeleton, EXTRAIT_VIDE, compose, fcfa);
}
function motDePanne(signe) {
    if (signe.sorte === 'pas-ouvert') {
        return 'L’atelier n’est pas encore ouvert. En attendant, prends l’outil le plus proche dans la liste.';
    }
    if (signe.sorte === 'sans-credit') {
        const pourquoi = signe.pourquoi === undefined || signe.pourquoi === ''
            ? 'Il n’y a plus de crédit pour composer.'
            : signe.pourquoi;
        return `${pourquoi} Les outils que tu as déjà continuent de marcher.`;
    }
    if (signe.sorte === 'abonnement-requis') {
        return signe.pourquoi === undefined || signe.pourquoi === ''
            ? 'Cette demande vaut plusieurs outils d’un coup.'
            : signe.pourquoi;
    }
    return `Je n’ai pas pu continuer — ${signe.pourquoi ?? 'le modèle n’a pas répondu'}.`;
}
