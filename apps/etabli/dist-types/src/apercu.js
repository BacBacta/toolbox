import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { BAC_A_SABLE, expliquer, lireMessageDApercu, pourApercu } from '@a237/etabli';
import { useEffect, useRef, useState } from 'preact/hooks';
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
    const [ouverte, setOuverte] = useState(false);
    // Chaque lancement repart d'une console vide : mélanger deux exécutions fait
    // chercher une erreur qu'on vient déjà de corriger.
    useEffect(() => setJournal([]), [props.tour]);
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
            setJournal((j) => [...j, message].slice(-MAX_LIGNES));
        }
        addEventListener('message', recevoir);
        return () => removeEventListener('message', recevoir);
    }, []);
    const erreurs = journal.filter((m) => m.sorte === 'erreur').length;
    return (_jsxs("div", { class: "apercu", children: [_jsx("iframe", { ref: cadre, class: "apercu-cadre", title: props.t.cadreTitre, sandbox: BAC_A_SABLE, srcdoc: pourApercu(props.projet, props.langue) }, props.tour), _jsxs("button", { type: "button", class: erreurs > 0 ? 'console-titre a-des-erreurs' : 'console-titre', onClick: () => setOuverte((o) => !o), children: [_jsxs("span", { children: [ouverte ? '▾' : '▸', " ", props.t.console] }), _jsx("span", { class: "console-compte", children: erreurs > 0 ? props.t.erreurs(erreurs) : `${journal.length}` })] }), ouverte && (_jsx("div", { class: "console", role: "log", children: journal.length === 0 ? (_jsxs("p", { class: "console-vide", children: [props.t.consoleVide, " ", _jsx("code", { children: "console.log(\"hello\")" }), " ", props.t.consoleVideExemple] })) : (journal.map((m, i) => (_jsx(Ligne, { message: m, langue: props.langue }, i)))) }))] }));
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
