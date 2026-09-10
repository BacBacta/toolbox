import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
/**
 * Ce champ a-t-il lieu d'être montré, vu ce que valent ses voisins ?
 *
 * Une section de page porte `texte` **ou** `lignes`, jamais les deux, et le
 * schéma ne sait dire que « facultatif ». L'éditeur montrait donc une zone de
 * texte vide sous chaque liste de prix, et une liste vide sous chaque
 * paragraphe : ce qu'on y tape ne s'affiche jamais sur la page, et rien ne le
 * dit.
 */
function pertinent(schema, voisins) {
    const regle = schema.ecran?.montrerSi;
    if (regle === undefined)
        return true;
    if (typeof voisins !== 'object' || voisins === null)
        return true;
    const valeur = voisins[regle.champ];
    return typeof valeur === 'string' && regle.vaut.includes(valeur);
}
function libelle(schema, clef) {
    return schema.title ?? clef;
}
function objetAvec(source, clef, valeur) {
    const base = typeof source === 'object' && source !== null ? source : {};
    return { ...base, [clef]: valeur };
}
function ChampTexte(props) {
    const valeur = typeof props.valeur === 'string' ? props.valeur : '';
    if (props.schema.enum !== undefined) {
        return (_jsx("select", { id: props.id, value: valeur, onChange: (e) => props.onChange(e.target.value), children: props.schema.enum.map((o) => (_jsx("option", { value: o, children: o }, o))) }));
    }
    /*
     * À partir de cent caractères on écrit une phrase, pas une étiquette.
     *
     * Le seuil était à cent vingt, et l'accroche d'une page en fait exactement
     * cent vingt : elle tombait donc du mauvais côté, dans un champ d'une ligne
     * qui n'en montrait que la moitié. On ne relit pas une phrase qu'on ne voit
     * pas en entier.
     */
    if ((props.schema.maxLength ?? 0) >= 100) {
        return (_jsx("textarea", { id: props.id, rows: 4, value: valeur, onInput: (e) => props.onChange(e.target.value) }));
    }
    return (_jsx("input", { id: props.id, type: "text", value: valeur, maxLength: props.schema.maxLength ?? undefined, onInput: (e) => props.onChange(e.target.value) }));
}
export function ChampsSchema(props) {
    const chemin = props.chemin ?? '$';
    const masques = props.masques ?? [];
    if (masques.includes(chemin))
        return null;
    const schema = props.schema;
    if (!pertinent(schema, props.voisins))
        return null;
    // Les aides se disent une fois par liste, pas une fois par ligne.
    const premier = props.premier ?? true;
    const aide = premier ? schema.description : undefined;
    if (schema.type === 'object') {
        const valeur = props.valeur;
        const champs = Object.entries(schema.properties).map(([clef, sous]) => (_jsx(ChampsSchema, { schema: sous, chemin: `${chemin}.${clef}`, masques: masques, voisins: valeur, premier: premier, valeur: typeof valeur === 'object' && valeur !== null
                ? valeur[clef]
                : undefined, onChange: (v) => props.onChange(objetAvec(valeur, clef, v)) }, clef)));
        /*
         * Un objet imbriqué qui se nomme devient un bloc.
         *
         * Sans ça, un devis est un ruban de dix-sept champs où « Téléphone » —
         * celui de l'entreprise — et « Téléphone du client » se ressemblent trop
         * pour qu'on sache lequel on remplit. Le schéma porte déjà les noms des
         * blocs (« Ton entreprise », « Le client ») : il n'y a rien à inventer.
         *
         * La racine, elle, reste à plat : un cadre autour de tout le formulaire
         * n'entoure rien.
         */
        if (chemin !== '$' && schema.title !== undefined) {
            return (_jsxs("fieldset", { class: "champ-groupe", children: [_jsx("legend", { children: schema.title }), champs] }));
        }
        return _jsx(_Fragment, { children: champs });
    }
    if (schema.type === 'array') {
        const liste = Array.isArray(props.valeur) ? props.valeur : [];
        const plein = schema.maxItems !== undefined && liste.length >= schema.maxItems;
        /*
         * Une section de page contient une liste de lignes : les deux sont des
         * listes, et les deux boutons disaient la même chose. Deux boutons
         * identiques qui détruisent des choses différentes se distinguent au
         * moment où on s'est trompé.
         */
        const ajout = schema.ecran?.ajout ?? 'Ajouter une ligne';
        /*
         * Le bouton dit ce qu'il retire, et non « Retirer ».
         *
         * Le mot seul était clair tant qu'il n'y avait qu'une liste à l'écran. Une
         * section de page en contient une deuxième : deux boutons identiques,
         * l'un qui retire une ligne et l'autre la section entière. Sur un
         * téléphone, la différence se découvrait après.
         */
        const retrait = schema.ecran?.retrait ?? 'Retirer la ligne';
        return (_jsxs("fieldset", { class: "champ-groupe", children: [_jsx("legend", { children: libelle(schema, chemin) }), liste.length === 0 && _jsx("p", { class: "champ-vide", children: "Rien pour l\u2019instant." }), liste.map((element, i) => (_jsxs("div", { class: "champ-element", children: [_jsx(ChampsSchema, { schema: schema.items, chemin: `${chemin}[]`, masques: masques, premier: i === 0, valeur: element, onChange: (v) => props.onChange(liste.map((x, j) => (j === i ? v : x))) }), _jsx("button", { type: "button", class: "champ-retirer", "aria-label": `${retrait} ${i + 1}`, onClick: () => props.onChange(liste.filter((_, j) => j !== i)), children: retrait })] }, `${chemin}-${i}`))), _jsx("button", { type: "button", class: "champ-ajouter", disabled: plein, onClick: () => props.onChange([...liste, valeurNeuve(schema.items)]), children: ajout })] }));
    }
    const id = `champ-${chemin.replace(/[^a-zA-Z0-9]+/g, '-')}`;
    if (schema.type === 'boolean') {
        return (_jsxs("label", { class: "champ champ-case", for: id, children: [_jsx("input", { id: id, type: "checkbox", checked: props.valeur === true, onChange: (e) => props.onChange(e.target.checked) }), _jsx("span", { children: libelle(schema, chemin) })] }));
    }
    if (schema.type === 'integer' || schema.type === 'number') {
        return (_jsxs("label", { class: "champ", for: id, children: [_jsx("span", { class: "champ-libelle", children: libelle(schema, chemin) }), _jsx("input", { id: id, type: "text", inputMode: "decimal", value: typeof props.valeur === 'number' ? String(props.valeur) : '', onInput: (e) => {
                        // Les claviers d'Android d'entrée de gamme envoient volontiers des
                        // espaces et des virgules : on les accepte plutôt que de refuser.
                        const brut = e.target.value.replace(/\s/g, '').replace(',', '.');
                        const nombre = brut === '' ? 0 : Number(brut);
                        props.onChange(Number.isFinite(nombre) ? nombre : 0);
                    } }), aide !== undefined && _jsx("span", { class: "champ-aide", children: aide })] }));
    }
    if (schema.type === 'string') {
        return (_jsxs("label", { class: "champ", for: id, children: [_jsx("span", { class: "champ-libelle", children: libelle(schema, chemin) }), _jsx(ChampTexte, { schema: schema, id: id, valeur: props.valeur, onChange: props.onChange }), aide !== undefined && _jsx("span", { class: "champ-aide", children: aide })] }));
    }
    return null;
}
/** Une valeur neuve conforme au schéma, pour l'ajout d'une ligne. */
export function valeurNeuve(schema) {
    switch (schema.type) {
        case 'string':
            return schema.enum?.[0] ?? '';
        case 'number':
        case 'integer':
            return schema.minimum ?? 0;
        case 'boolean':
            return false;
        case 'array':
            return [];
        case 'object':
            return Object.fromEntries((schema.required ?? Object.keys(schema.properties)).map((clef) => [
                clef,
                valeurNeuve(schema.properties[clef] ?? { type: 'string' }),
            ]));
    }
}
