import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
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
    // Au-delà de cent vingt caractères on écrit un paragraphe, pas une ligne.
    if ((props.schema.maxLength ?? 0) > 120) {
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
    if (schema.type === 'object') {
        const valeur = props.valeur;
        return (_jsx(_Fragment, { children: Object.entries(schema.properties).map(([clef, sous]) => (_jsx(ChampsSchema, { schema: sous, chemin: `${chemin}.${clef}`, masques: masques, valeur: typeof valeur === 'object' && valeur !== null
                    ? valeur[clef]
                    : undefined, onChange: (v) => props.onChange(objetAvec(valeur, clef, v)) }, clef))) }));
    }
    if (schema.type === 'array') {
        const liste = Array.isArray(props.valeur) ? props.valeur : [];
        const plein = schema.maxItems !== undefined && liste.length >= schema.maxItems;
        return (_jsxs("fieldset", { class: "champ-groupe", children: [_jsx("legend", { children: libelle(schema, chemin) }), liste.length === 0 && _jsx("p", { class: "champ-vide", children: "Rien pour l\u2019instant." }), liste.map((element, i) => (_jsxs("div", { class: "champ-element", children: [_jsx(ChampsSchema, { schema: schema.items, chemin: `${chemin}[]`, masques: masques, valeur: element, onChange: (v) => props.onChange(liste.map((x, j) => (j === i ? v : x))) }), _jsx("button", { type: "button", class: "champ-retirer", "aria-label": `Retirer la ligne ${i + 1}`, onClick: () => props.onChange(liste.filter((_, j) => j !== i)), children: "Retirer" })] }, `${chemin}-${i}`))), _jsx("button", { type: "button", class: "champ-ajouter", disabled: plein, onClick: () => props.onChange([...liste, valeurNeuve(schema.items)]), children: "Ajouter une ligne" })] }));
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
                    } }), schema.description !== undefined && _jsx("span", { class: "champ-aide", children: schema.description })] }));
    }
    if (schema.type === 'string') {
        return (_jsxs("label", { class: "champ", for: id, children: [_jsx("span", { class: "champ-libelle", children: libelle(schema, chemin) }), _jsx(ChampTexte, { schema: schema, id: id, valeur: props.valeur, onChange: props.onChange }), schema.description !== undefined && _jsx("span", { class: "champ-aide", children: schema.description })] }));
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
