import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { MAX_FICHIERS, sorteDuFichier, verifierNomDeFichier } from '@a237/etabli';
import { useRef, useState } from 'preact/hooks';
/**
 * Écrire du code sur un téléphone.
 *
 * Il n'y a pas de bibliothèque d'édition ici, et ce n'est pas une économie de
 * bout de chandelle : les deux plus répandues pèsent deux cents kilo-octets et
 * cinq mégaoctets. Sur un forfait compté à l'octet, c'est le prix du repas de
 * midi pour ouvrir un éditeur. Une zone de texte pèse zéro, et sur un écran
 * tactile elle se comporte mieux — la sélection, le curseur et le clavier sont
 * ceux que la personne connaît déjà.
 *
 * Ce qui manquait vraiment sur un téléphone, ce n'est pas la coloration : ce
 * sont les accolades. Elles sont à trois appuis de profondeur sur un clavier
 * Android, derrière deux pages de symboles. La rangée au-dessus du clavier les
 * ramène à un appui, et c'est elle qui rend l'exercice supportable.
 */
/*
 * Les caractères qu'un clavier de téléphone enterre.
 *
 * Choisis en écrivant les trois modèles à la main sur un écran de 360 pixels :
 * ce sont ceux qu'on va chercher, pas ceux qu'on imagine. L'espace se passe de
 * bouton, les lettres aussi.
 */
/**
 * Ce qu'un clavier de téléphone ne doit surtout pas faire à du code.
 *
 * Un clavier Android met une majuscule après chaque point, corrige les mots
 * qu'il ne connaît pas, propose la suite, et remplace les guillemets droits par
 * des courbes. Appliqué à du code, ça donne `Const`, `document.GetElementById`,
 * et des chaînes que le navigateur refuse. La personne voit son travail cassé
 * sans comprendre par quoi — et elle n'a rien fait.
 *
 * Écrit en chaînes et non en booléens : Preact retire un attribut qui vaut
 * `false`, et `spellcheck` ne redeviendrait un attribut que sur les moteurs qui
 * en font une propriété réfléchie. En toutes lettres, il n'y a rien à parier.
 *
 * Un seul endroit, parce que la règle vaut pour toute saisie de code — la zone
 * comme le nom d'un fichier.
 */
const SANS_CORRECTION = {
    spellcheck: 'false',
    autocapitalize: 'off',
    autocorrect: 'off',
    autocomplete: 'off',
};
const SYMBOLES = ['{', '}', '(', ')', '[', ']', '<', '>', ';', '=', '"', "'", ':', '.', '/', '_'];
export function Editeur(props) {
    const zone = useRef(null);
    const [nouveau, setNouveau] = useState(null);
    const [reproche, setReproche] = useState('');
    const fichier = props.projet.fichiers.find((f) => f.nom === props.ouvert);
    /**
     * Insère au curseur, et rend la main au clavier.
     *
     * Sans le `focus()`, le clavier se referme à chaque symbole : on tape une
     * accolade, l'écran remonte, et il faut retoucher la zone pour continuer.
     * C'est le genre de détail qui fait abandonner au bout de dix minutes.
     */
    function inserer(texte) {
        const z = zone.current;
        if (z === null || fichier === undefined)
            return;
        const debut = z.selectionStart;
        const fin = z.selectionEnd;
        const avant = fichier.contenu.slice(0, debut);
        const apres = fichier.contenu.slice(fin);
        const suite = `${avant}${texte}${apres}`;
        /*
         * On pose la valeur et le curseur tout de suite, avant de prévenir le
         * parent.
         *
         * Le faire à la frame suivante marchait *presque* : un humain met plus de
         * seize millisecondes entre deux appuis, donc on ne le voyait pas. Mais le
         * caractère suivant partait où le curseur se trouvait encore — et sur un
         * clavier qui prédit, ou pour quelqu'un qui tape vite, ça donne du code
         * mélangé qu'on ne peut pas s'expliquer. Un essai au navigateur l'a
         * attrapé, en tapant plus vite qu'une main.
         *
         * Le rendu qui suit trouve la même valeur que celle du DOM et n'y touche
         * pas : le curseur reste où on vient de le mettre.
         */
        z.value = suite;
        z.setSelectionRange(debut + texte.length, debut + texte.length);
        z.focus();
        props.onEcrire(fichier.nom, suite);
    }
    function ajouter() {
        const nom = (nouveau ?? '').trim();
        const probleme = verifierNomDeFichier(nom, props.projet.fichiers.map((f) => f.nom));
        if (probleme !== null) {
            setReproche(probleme);
            return;
        }
        props.onAjouter({ nom, contenu: '' });
        setNouveau(null);
        setReproche('');
    }
    return (_jsxs("div", { class: "editeur", children: [_jsxs("div", { class: "onglets", role: "tablist", children: [props.projet.fichiers.map((f) => (_jsx("button", { type: "button", role: "tab", "aria-selected": f.nom === props.ouvert, class: f.nom === props.ouvert ? 'onglet actif' : 'onglet', onClick: () => props.onOuvrir(f.nom), children: f.nom }, f.nom))), props.projet.fichiers.length < MAX_FICHIERS && (_jsx("button", { type: "button", class: "onglet ajout", onClick: () => setNouveau(''), children: "+" }))] }), nouveau !== null && (_jsxs("div", { class: "nouveau-fichier", children: [_jsx("input", { type: "text", value: nouveau, placeholder: "page.html", ...SANS_CORRECTION, onInput: (e) => setNouveau(e.target.value) }), _jsx("button", { type: "button", onClick: ajouter, children: "Ajouter" }), _jsx("button", { type: "button", class: "discret", onClick: () => { setNouveau(null); setReproche(''); }, children: "Annuler" }), reproche !== '' && _jsx("p", { class: "reproche", children: reproche })] })), fichier === undefined ? (_jsx("p", { class: "vide", children: "Ce projet n\u2019a pas encore de fichier." })) : (_jsx("textarea", { ref: zone, class: "zone", value: fichier.contenu, onInput: (e) => props.onEcrire(fichier.nom, e.target.value), "aria-label": `Contenu de ${fichier.nom}`, "data-sorte": sorteDuFichier(fichier.nom), ...SANS_CORRECTION, 
                /*
                 * Le texte revient à la ligne, contrairement à tout éditeur de code.
                 *
                 * Un éditeur de bureau ne replie pas : la structure se lit mieux, et
                 * il reste de la largeur pour aller voir la fin d'une ligne. Sur
                 * trois cent quatre-vingt-dix pixels il n'en reste pas : une capture
                 * d'écran de cet éditeur montrait `<button id="bouton">Appuie
                 * ici</button>` coupé net au bord droit. Du texte qu'on ne voit pas
                 * est pire qu'une indentation en escalier — surtout pour quelqu'un
                 * qui apprend, et qui ne sait pas encore qu'il faut faire défiler.
                 */
                wrap: "soft" })), _jsx("div", { class: "symboles", "aria-label": "Caract\u00E8res du clavier", children: SYMBOLES.map((s) => (_jsx("button", { type: "button", class: "symbole", 
                    /* Empêche la zone de perdre le focus : le clavier resterait fermé. */
                    onMouseDown: (e) => e.preventDefault(), onClick: () => inserer(s), children: s }, s))) })] }));
}
