//#region ../legal-cm/src/mentions.ts
function vide(s) {
	return s === null || s === void 0 || s.trim() === "";
}
/**
* Le pied de page légal, tel qu'il s'imprime sous le document.
*
* Les mentions absentes sont sautées plutôt que d'imprimer une étiquette
* orpheline : sur un document qu'on vient d'ouvrir, « RCCM  · NIU  · » ne
* renseigne personne et donne l'air d'un bug. Ce qui manque est signalé par
* `mentionsManquantes`, à l'écran, pas sur le papier.
*/
function piedLegal(e) {
	return [
		[e.nom, e.forme].filter((x) => !vide(x)).join(" — "),
		vide(e.rccm) ? null : `RCCM ${e.rccm}`,
		vide(e.niu) ? null : `NIU ${e.niu}`,
		e.adresse
	].filter((x) => x !== null && !vide(x)).join(" · ");
}
//#endregion
//#region ../legal-cm/src/tva.ts
/**
* TVA camerounaise.
*
* Le taux de 19,25 % et l'obligation de l'afficher ligne par ligne puis en bloc
* HT / TVA / TTC sont des faits vérifiés du brief (BRIEF.md § 5). Ne pas les
* redériver ni les « corriger » sans source.
*/
/** Le taux, exprimé en dix-millièmes, pour calculer en entiers. 1925 = 19,25 %. */
var TAUX_TVA_CM_POUR_10000 = 1925;
TAUX_TVA_CM_POUR_10000 / 1e4;
/** Le libellé tel qu'il doit apparaître sur le document. */
var LIBELLE_TVA_CM = "TVA 19,25 %";
/**
* TVA due sur un montant hors taxes, arrondie au franc.
*
* Le calcul passe par des entiers (`ht × 1925 / 10000`) : à ces ordres de
* grandeur le produit reste très en deçà de 2^53, donc pas de dérive flottante.
* La demie est arrondie vers le haut, comme `Math.round` : jamais moins que dû.
*
* @throws RangeError sur un montant négatif, non entier ou non fini. Les
*   montants sont arrondis au franc *avant* d'arriver ici ; l'avoir (montant
*   négatif) n'est pas au périmètre v1.
*/
function tvaSur(montantHT) {
	if (!Number.isSafeInteger(montantHT)) throw new RangeError(`montant HT non entier ou hors bornes : ${montantHT}`);
	if (montantHT < 0) throw new RangeError(`montant HT négatif : ${montantHT}`);
	return Math.round(montantHT * TAUX_TVA_CM_POUR_10000 / 1e4);
}
//#endregion
//#region ../engine/src/compute/document.ts
/**
* Analyse une date ISO.
* @throws RangeError si la chaîne n'est pas exploitable — mieux vaut une erreur
*   qu'un document daté de « Invalid Date ».
*/
function dateIso(valeur, quoi) {
	const d = new Date(valeur);
	if (Number.isNaN(d.getTime())) throw new RangeError(`${quoi} illisible : « ${valeur} »`);
	return d;
}
/**
* Date d'émission du document.
*
* Elle vit dans l'état, jamais dans l'horloge : un devis réédité six mois plus
* tard porte toujours sa date d'origine.
*/
function dateEmission(doc) {
	return dateIso(doc.emisLe, "date d'émission");
}
//#endregion
//#region ../engine/src/compute/tva.ts
/**
* Calcule un tableau de lignes, TVA comprise.
*
* **Règle d'arrondi, et c'est un choix :** chaque ligne est arrondie au franc,
* puis les totaux sont la somme des lignes arrondies. L'inverse — sommer puis
* arrondir — donne parfois un franc de plus, et ce franc-là ne se retrouve nulle
* part quand un contrôleur recalcule le document ligne à ligne. Le papier doit
* tomber juste sous son stylo. Le test `tva.test.ts` fige ce choix.
*
* @throws RangeError sur une quantité ou un prix unitaire négatif.
*/
function calculerLignes(lignes) {
	const calculees = lignes.map((l) => {
		if (!Number.isFinite(l.quantite) || l.quantite < 0) throw new RangeError(`quantité invalide sur « ${l.designation} » : ${l.quantite}`);
		if (!Number.isSafeInteger(l.prixUnitaire) || l.prixUnitaire < 0) throw new RangeError(`prix unitaire invalide sur « ${l.designation} » : ${l.prixUnitaire}`);
		const montantHT = Math.round(l.quantite * l.prixUnitaire);
		const tva = tvaSur(montantHT);
		return {
			...l,
			montantHT,
			tva,
			montantTTC: montantHT + tva
		};
	});
	const totalHT = calculees.reduce((a, l) => a + l.montantHT, 0);
	const totalTVA = calculees.reduce((a, l) => a + l.tva, 0);
	return {
		lignes: calculees,
		totalHT,
		totalTVA,
		totalTTC: totalHT + totalTVA
	};
}
/**
* Acompte demandé à la commande, en francs, arrondi au franc.
*
* @throws RangeError si le pourcentage sort de 0–100.
*/
function montantAcompte(totalTTC, pourcentage) {
	if (!Number.isFinite(pourcentage) || pourcentage < 0 || pourcentage > 100) throw new RangeError(`pourcentage d'acompte hors de 0–100 : ${pourcentage}`);
	return Math.round(totalTTC * pourcentage / 100);
}
//#endregion
//#region ../engine/src/compute/devis.ts
/** Le chiffrage complet : lignes, TVA, totaux, acompte et solde. */
function chiffrer(etat) {
	const totaux = calculerLignes(etat.lignes);
	const acompteDu = montantAcompte(totaux.totalTTC, etat.acompte);
	return {
		...totaux,
		acompteDu,
		soldeDu: totaux.totalTTC - acompteDu
	};
}
var MOIS = [
	"janvier",
	"février",
	"mars",
	"avril",
	"mai",
	"juin",
	"juillet",
	"août",
	"septembre",
	"octobre",
	"novembre",
	"décembre"
];
/**
* Décalage d'Africa/Douala : UTC+1, toute l'année, sans heure d'été.
*
* Les dates sont mises en forme dans ce fuseau et pas dans celui de la machine.
* Sans ça, un document publié à 23 h 30 à Douala porterait la veille sur la page
* rendue par un Worker qui vit en UTC.
*/
var DECALAGE_WAT_MS = 36e5;
function partsWAT(d) {
	const t = d.getTime();
	if (!Number.isFinite(t)) throw new RangeError("date invalide");
	const wat = new Date(t + DECALAGE_WAT_MS);
	return {
		jour: wat.getUTCDate(),
		mois: wat.getUTCMonth(),
		annee: wat.getUTCFullYear(),
		heures: wat.getUTCHours(),
		minutes: wat.getUTCMinutes()
	};
}
function nom(mois) {
	const m = MOIS[mois];
	if (m === void 0) throw new RangeError(`mois hors table : ${mois}`);
	return m;
}
/**
* Nombre groupé par milliers : `nf(353000)` → `353 000` (espaces insécables).
* Le montant est arrondi au franc.
*/
function nf(n) {
	if (!Number.isFinite(n)) throw new RangeError(`nombre non représentable : ${n}`);
	const arrondi = Math.round(n);
	const signe = arrondi < 0 ? "-" : "";
	const chiffres = Math.abs(arrondi).toString();
	let out = "";
	for (let i = 0; i < chiffres.length; i += 1) {
		if (i > 0 && (chiffres.length - i) % 3 === 0) out += "\xA0";
		out += chiffres.charAt(i);
	}
	return signe + out;
}
/** `montantF(353000)` → `353 000 F`. */
function montantF(n) {
	return `${nf(n)} F`;
}
/** `dateLongue()` → `9 septembre 2026`. */
function dateLongue(d) {
	const p = partsWAT(d);
	return `${p.jour} ${nom(p.mois)} ${p.annee}`;
}
/**
* La date longue d'une chaîne ISO, ou `null` si elle n'en est pas une.
*
* `dateLongue` refuse une date invalide, et elle a raison : dessiner « Invalid
* Date » sur un document serait pire. Mais une date que l'utilisateur est en
* train de saisir n'est pas encore une date, et le rendu ne doit pas se
* casser en l'attendant. Le rendu choisit alors de ne rien écrire.
*/
function dateLongueSiValide(iso) {
	if (iso.trim() === "") return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return dateLongue(d);
}
/** Minuit du jour civil de Douala qui contient `d`, en millisecondes. */
function minuitWAT(d) {
	const t = d.getTime();
	if (!Number.isFinite(t)) throw new RangeError("date invalide");
	const wat = new Date(t + DECALAGE_WAT_MS);
	return Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate());
}
/**
* Nombre de jours civils entre deux dates, comptés sur le calendrier de Douala.
*
* Compté en jours et non en millisecondes : une facture échue hier est en
* retard d'un jour, qu'il soit 1 h du matin ou 23 h. Négatif si `fin` précède
* `debut`.
*/
function joursEntre(debut, fin) {
	return Math.round((minuitWAT(fin) - minuitWAT(debut)) / 864e5);
}
//#endregion
//#region ../engine/src/compute/facture.ts
var LIBELLE_MOYEN = {
	momo: "MTN Mobile Money",
	"orange-money": "Orange Money",
	especes: "Espèces",
	virement: "Virement"
};
function dateEcheance(etat) {
	return dateIso(etat.echeance, "date d'échéance");
}
/** Le chiffrage complet : lignes, TVA, totaux, encaissé et reste dû. */
function chiffrerFacture(etat) {
	const totaux = calculerLignes(etat.lignes);
	const verse = etat.reglements.reduce((a, r) => {
		if (!Number.isSafeInteger(r.montant) || r.montant < 0) throw new RangeError(`règlement invalide du ${r.date} : ${r.montant}`);
		return a + r.montant;
	}, 0);
	const reste = Math.max(0, totaux.totalTTC - verse);
	return {
		...totaux,
		verse,
		reste,
		tropPercu: Math.max(0, verse - totaux.totalTTC),
		partReglee: totaux.totalTTC === 0 ? 1 : Math.min(1, verse / totaux.totalTTC),
		estSoldee: verse >= totaux.totalTTC
	};
}
/** Jours civils de retard à Douala. Zéro tant que l'échéance n'est pas passée. */
function joursDeRetard(etat, maintenant) {
	return Math.max(0, joursEntre(dateEcheance(etat), maintenant));
}
//#endregion
//#region ../engine/src/lettres.ts
/**
* Montant en toutes lettres, en français.
*
* Obligatoire sur une reconnaissance de dette (BRIEF.md § 5) et utilisé sur les
* reçus. Porté depuis `reference/atelier-prototype.html:524-554`, avec trois
* corrections : le milliard (le prototype produisait « dix cents millions » pour
* 10^9), l'accord de « cent » et « vingt » devant « mille », et le refus explicite
* des entrées non représentables.
*
* Convention d'écriture, celle du prototype : « et » soudé par des traits d'union
* (`vingt-et-un`), mais pas de trait d'union après « cent » ni « mille »
* (`cent un`, `mille un`). Elle est cohérente d'un bout à l'autre du produit ;
* la réforme de 1990 hyphénerait tout, l'usage administratif camerounais ne le
* fait pas.
*
* Accord de « cent » et « vingt » : ils prennent le `s` quand ils sont multipliés
* et que rien ne suit, ou qu'un nom les suit (« deux cents millions »), mais pas
* devant l'adjectif numéral invariable « mille » (« deux cent mille »,
* « quatre-vingt mille »). C'est le rôle du paramètre `pluriel`.
*/
var UNITES = [
	"zéro",
	"un",
	"deux",
	"trois",
	"quatre",
	"cinq",
	"six",
	"sept",
	"huit",
	"neuf",
	"dix",
	"onze",
	"douze",
	"treize",
	"quatorze",
	"quinze",
	"seize"
];
var DIZAINES = {
	20: "vingt",
	30: "trente",
	40: "quarante",
	50: "cinquante",
	60: "soixante"
};
function unite(i) {
	const mot = UNITES[i];
	if (mot === void 0) throw new RangeError(`unité hors table : ${i}`);
	return mot;
}
function dizaine(i) {
	const mot = DIZAINES[i];
	if (mot === void 0) throw new RangeError(`dizaine hors table : ${i}`);
	return mot;
}
/** 0 à 99. */
function c99(n, pluriel) {
	if (n < 17) return unite(n);
	if (n < 20) return `dix-${unite(n - 10)}`;
	if (n < 70) {
		const d = Math.floor(n / 10) * 10;
		const r = n % 10;
		if (r === 0) return dizaine(d);
		if (r === 1) return `${dizaine(d)}-et-un`;
		return `${dizaine(d)}-${unite(r)}`;
	}
	if (n < 80) {
		const r = n - 60;
		if (r === 11) return "soixante-et-onze";
		return `soixante-${c99(r, false)}`;
	}
	const r = n - 80;
	if (r === 0) return pluriel ? "quatre-vingts" : "quatre-vingt";
	return `quatre-vingt-${c99(r, false)}`;
}
/** 0 à 999. */
function c999(n, pluriel) {
	if (n < 100) return c99(n, pluriel);
	const c = Math.floor(n / 100);
	const r = n % 100;
	const tete = c > 1 ? `${unite(c)} cent` : "cent";
	if (r === 0) return c > 1 && pluriel ? `${tete}s` : tete;
	return `${tete} ${c99(r, pluriel)}`;
}
/** 1 à 999 999 999. Le zéro est traité par l'appelant. */
function souMilliard(n, pluriel) {
	const millions = Math.floor(n / 1e6);
	const milliers = Math.floor(n % 1e6 / 1e3);
	const reste = n % 1e3;
	const bouts = [];
	if (millions > 0) bouts.push(millions === 1 ? "un million" : `${c999(millions, true)} millions`);
	if (milliers > 0) bouts.push(milliers === 1 ? "mille" : `${c999(milliers, false)} mille`);
	if (reste > 0) bouts.push(c999(reste, pluriel));
	return bouts.join(" ");
}
/**
* Écrit un entier en toutes lettres. Le montant est arrondi au franc : le XAF
* n'a pas de subdivision.
*
* @throws RangeError si le nombre est négatif, non fini, ou au-delà de ce que
*   JavaScript représente exactement — mieux vaut une erreur qu'un acte signé
*   portant un montant faux.
*/
function lettres(montant) {
	if (!Number.isFinite(montant)) throw new RangeError(`montant non représentable : ${montant}`);
	const n = Math.round(montant);
	if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`montant hors bornes : ${montant}`);
	if (n === 0) return "zéro";
	const milliards = Math.floor(n / 1e9);
	const reste = n % 1e9;
	const bouts = [];
	if (milliards > 0) bouts.push(milliards === 1 ? "un milliard" : `${souMilliard(milliards, true)} milliards`);
	if (reste > 0) bouts.push(souMilliard(reste, true));
	return bouts.join(" ");
}
/**
* La formule telle qu'elle est imprimée sur l'acte : « cent cinquante mille
* francs CFA ». Zéro et un restent au singulier.
*/
function montantEnLettres(montant) {
	return `${lettres(montant)} franc${Math.round(montant) > 1 ? "s" : ""} CFA`;
}
//#endregion
//#region ../engine/src/compute/actes.ts
/**
* Le compte du reçu.
*
* `reste` ne descend jamais sous zéro : un client qui verse plus que dû a un
* crédit, pas une dette négative, et « −5 000 F à payer » sur un papier signé
* est le genre de phrase qu'on ne peut plus expliquer une fois qu'elle est
* imprimée.
*/
function totauxRecu(etat) {
	const total = etat.lignes.reduce((a, l) => a + Math.max(0, Math.round(l.montant)), 0);
	const avance = Math.max(0, Math.round(etat.avance));
	return {
		total,
		avance,
		reste: Math.max(0, total - avance)
	};
}
//#endregion
//#region ../engine/src/compute/cv.ts
/**
* Les intitulés de section, dans les deux langues.
*
* Le prototype traduisait aussi le contenu — mais il ne pouvait le faire que
* pour le CV d'exemple qu'il portait en dur. Ici la bascule ne touche que les
* étiquettes : quelqu'un qui postule à l'international écrit son texte en
* anglais lui-même, et l'atelier ne prétend pas le traduire.
*/
var INTITULES = {
	fr: {
		profil: "Profil",
		experience: "Expérience professionnelle",
		formation: "Formation",
		competences: "Compétences",
		langues: "Langues",
		contact: "Contact"
	},
	en: {
		profil: "Profile",
		experience: "Experience",
		formation: "Education",
		competences: "Skills",
		langues: "Languages",
		contact: "Contact"
	}
};
var MOTIF_LIEN = new RegExp(`^[23456789ABCDEFGHJKLMNPQRSTVWXYZ]{12}$`);
function lienValide(lien) {
	return MOTIF_LIEN.test(lien);
}
//#endregion
//#region ../../node_modules/.pnpm/preact@10.29.8_preact-render-to-string@6.7.0/node_modules/preact/dist/preact.module.js
var n;
var l$1;
var u$2;
var i$2;
var r$1;
var o$1;
var e;
var f$2;
var c$1;
var a$1;
var s$1;
var h$1;
var p$1;
var v$1;
var d$1 = {};
var w$1 = [];
var _$1 = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var g$1 = Array.isArray;
function m$1(n, l) {
	for (var u in l) n[u] = l[u];
	return n;
}
function b$1(n) {
	n && n.parentNode && n.parentNode.removeChild(n);
}
function k$1(l, u, t) {
	var i, r, o, e = {};
	for (o in u) "key" == o ? i = u[o] : "ref" == o ? r = u[o] : e[o] = u[o];
	if (arguments.length > 2 && (e.children = arguments.length > 3 ? n.call(arguments, 2) : t), "function" == typeof l && null != l.defaultProps) for (o in l.defaultProps) void 0 === e[o] && (e[o] = l.defaultProps[o]);
	return x$1(l, e, i, r, null);
}
function x$1(n, t, i, r, o) {
	var e = {
		type: n,
		props: t,
		key: i,
		ref: r,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		constructor: void 0,
		__v: null == o ? ++u$2 : o,
		__i: -1,
		__u: 0
	};
	return null == o && null != l$1.vnode && l$1.vnode(e), e;
}
function S(n) {
	return n.children;
}
function C$1(n, l) {
	this.props = n, this.context = l;
}
function $$1(n, l) {
	if (null == l) return n.__ ? $$1(n.__, n.__i + 1) : null;
	for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e;
	return "function" == typeof n.type ? $$1(n) : null;
}
function I$1(n) {
	if (n.__P && n.__d) {
		var u = n.__v, t = u.__e, i = [], r = [], o = m$1({}, u);
		o.__v = u.__v + 1, l$1.vnode && l$1.vnode(o), q$1(n.__P, o, u, n.__n, n.__P.namespaceURI, 32 & u.__u ? [t] : null, i, null == t ? $$1(u) : t, !!(32 & u.__u), r), o.__v = u.__v, o.__.__k[o.__i] = o, D$1(i, o, r), u.__e = u.__ = null, o.__e != t && P$1(o);
	}
}
function P$1(n) {
	if (null != (n = n.__) && null != n.__c) return n.__e = n.__c.base = null, n.__k.some(function(l) {
		if (null != l && null != l.__e) return n.__e = n.__c.base = l.__e;
	}), P$1(n);
}
function A$1(n) {
	(!n.__d && (n.__d = !0) && i$2.push(n) && !H$1.__r++ || r$1 != l$1.debounceRendering) && ((r$1 = l$1.debounceRendering) || o$1)(H$1);
}
function H$1() {
	try {
		for (var n, l = 1; i$2.length;) i$2.length > l && i$2.sort(e), n = i$2.shift(), l = i$2.length, I$1(n);
	} finally {
		i$2.length = H$1.__r = 0;
	}
}
function L(n, l, u, t, i, r, o, e, f, c, a) {
	var s, h, p, v, y, _, g = t && t.__k || w$1, m = l.length;
	for (f = T(u, l, g, f, m), s = 0; s < m; s++) null != (p = u.__k[s]) && (h = -1 != p.__i && g[p.__i] || d$1, p.__i = s, _ = q$1(n, p, h, i, r, o, e, f, c, a), v = p.__e, p.ref && h.ref != p.ref && (h.ref && J$1(h.ref, null, p), a.push(p.ref, p.__c || v, p)), null == y && null != v && (y = v), 4 & p.__u ? (f = j(p, f, n), h.__e && (h.__e = null)) : "function" == typeof p.type && void 0 !== _ ? f = _ : v && (f = v.nextSibling), p.__u &= -7);
	return u.__e = y, f;
}
function T(n, l, u, t, i) {
	var r, o, e, f, c, a = u.length, s = a, h = 0;
	for (n.__k = new Array(i), r = 0; r < i; r++) null != (o = l[r]) && "boolean" != typeof o && "function" != typeof o ? ("string" == typeof o || "number" == typeof o || "bigint" == typeof o || o.constructor == String ? o = n.__k[r] = x$1(null, o, null, null, null) : g$1(o) ? o = n.__k[r] = x$1(S, { children: o }, null, null, null) : void 0 === o.constructor && o.__b > 0 ? o = n.__k[r] = x$1(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v) : n.__k[r] = o, f = r + h, o.__ = n, o.__b = n.__b + 1, e = null, -1 != (c = o.__i = O$1(o, u, f, s)) && (s--, (e = u[c]) && (e.__u |= 2)), null == e || null == e.__v ? (-1 == c && (i > a ? h-- : i < a && h++), "function" != typeof o.type && (o.__u |= 4)) : c != f && (c == f - 1 ? h-- : c == f + 1 ? h++ : (c > f ? h-- : h++, o.__u |= 4))) : n.__k[r] = null;
	if (s) for (r = 0; r < a; r++) null != (e = u[r]) && 0 == (2 & e.__u) && (e.__e == t && (t = $$1(e)), K$1(e, e));
	return t;
}
function j(n, l, u) {
	var t, i;
	if ("function" == typeof n.type) {
		for (t = n.__k, i = 0; t && i < t.length; i++) t[i] && (t[i].__ = n, l = j(t[i], l, u));
		return l;
	}
	n.__e != l && (l && n.type && !l.parentNode && (l = $$1(n)), l = u.insertBefore(n.__e, l || null));
	do
		l = l && l.nextSibling;
	while (null != l && 8 == l.nodeType);
	return l;
}
function O$1(n, l, u, t) {
	var i, r, o, e = n.key, f = n.type, c = l[u], a = null != c && 0 == (2 & c.__u);
	if (null === c && null == e || a && e == c.key && f == c.type) return u;
	if (t > (a ? 1 : 0)) {
		for (i = u - 1, r = u + 1; i >= 0 || r < l.length;) if (null != (c = l[o = i >= 0 ? i-- : r++]) && 0 == (2 & c.__u) && e == c.key && f == c.type) return o;
	}
	return -1;
}
function z$1(n, l, u) {
	"-" == l[0] ? n.setProperty(l, null == u ? "" : u) : n[l] = null == u ? "" : "number" != typeof u || _$1.test(l) ? u : u + "px";
}
function N$1(n, l, u, t, i) {
	var r, o;
	n: if ("style" == l) if ("string" == typeof u) n.style.cssText = u;
	else {
		if ("string" == typeof t && (n.style.cssText = t = ""), t) for (l in t) u && l in u || z$1(n.style, l, "");
		if (u) for (l in u) t && u[l] == t[l] || z$1(n.style, l, u[l]);
	}
	else if ("o" == l[0] && "n" == l[1]) r = l != (l = l.replace(s$1, "$1")), o = l.toLowerCase(), l = o in n || "onFocusOut" == l || "onFocusIn" == l ? o.slice(2) : l.slice(2), n.l || (n.l = {}), n.l[l + r] = u, u ? t ? u[a$1] = t[a$1] : (u[a$1] = h$1, n.addEventListener(l, r ? v$1 : p$1, r)) : n.removeEventListener(l, r ? v$1 : p$1, r);
	else {
		if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
		else if ("width" != l && "height" != l && "href" != l && "list" != l && "form" != l && "tabIndex" != l && "download" != l && "rowSpan" != l && "colSpan" != l && "role" != l && "popover" != l && l in n) try {
			n[l] = null == u ? "" : u;
			break n;
		} catch (n) {}
		"function" == typeof u || (null == u || !1 === u && "-" != l[4] ? n.removeAttribute(l) : n.setAttribute(l, "popover" == l && 1 == u ? "" : u));
	}
}
function V$1(n) {
	return function(u) {
		if (this.l) {
			var t = this.l[u.type + n];
			if (null == u[c$1]) u[c$1] = h$1++;
			else if (u[c$1] < t[a$1]) return;
			return t(l$1.event ? l$1.event(u) : u);
		}
	};
}
function q$1(n, u, t, i, r, o, e, f, c, a) {
	var s, h, p, v, y, d, _, k, x, M, I, P, A, H, T, j, F = u.type;
	if (void 0 !== u.constructor) return null;
	128 & t.__u && (c = !!(32 & t.__u), o = [f = u.__e = t.__e]), (s = l$1.__b) && s(u);
	n: if ("function" == typeof F) {
		h = e.length;
		try {
			if (x = u.props, M = F.prototype && F.prototype.render, I = (s = F.contextType) && i[s.__c], P = s ? I ? I.props.value : s.__ : i, t.__c ? k = (p = u.__c = t.__c).__ = p.__E : (M ? u.__c = p = new F(x, P) : (u.__c = p = new C$1(x, P), p.constructor = F, p.render = Q), I && I.sub(p), p.state || (p.state = {}), p.__n = i, v = p.__d = !0, p.__h = [], p._sb = []), M && null == p.__s && (p.__s = p.state), M && null != F.getDerivedStateFromProps && (p.__s == p.state && (p.__s = m$1({}, p.__s)), m$1(p.__s, F.getDerivedStateFromProps(x, p.__s))), y = p.props, d = p.state, p.__v = u, v) M && null == F.getDerivedStateFromProps && null != p.componentWillMount && p.componentWillMount(), M && null != p.componentDidMount && p.__h.push(p.componentDidMount);
			else {
				if (M && null == F.getDerivedStateFromProps && x !== y && null != p.componentWillReceiveProps && p.componentWillReceiveProps(x, P), u.__v == t.__v || !p.__e && null != p.shouldComponentUpdate && !1 === p.shouldComponentUpdate(x, p.__s, P)) {
					u.__v != t.__v && (p.props = x, p.state = p.__s, p.__d = !1), u.__e = t.__e, u.__k = t.__k, u.__k.some(function(n) {
						n && (n.__ = u);
					}), w$1.push.apply(p.__h, p._sb), p._sb = [], p.__h.length && e.push(p), f = $$1(t);
					break n;
				}
				null != p.componentWillUpdate && p.componentWillUpdate(x, p.__s, P), M && null != p.componentDidUpdate && p.__h.push(function() {
					p.componentDidUpdate(y, d, _);
				});
			}
			if (p.context = P, p.props = x, p.__P = n, p.__e = !1, A = l$1.__r, H = 0, M) p.state = p.__s, p.__d = !1, A && A(u), s = p.render(p.props, p.state, p.context), w$1.push.apply(p.__h, p._sb), p._sb = [];
			else do
				p.__d = !1, A && A(u), s = p.render(p.props, p.state, p.context), p.state = p.__s;
			while (p.__d && ++H < 25);
			p.state = p.__s, null != p.getChildContext && (i = m$1(m$1({}, i), p.getChildContext())), M && !v && null != p.getSnapshotBeforeUpdate && (_ = p.getSnapshotBeforeUpdate(y, d)), T = null != s && s.type === S && null == s.key ? E(s.props.children) : s, f = L(n, g$1(T) ? T : [T], u, t, i, r, o, e, f, c, a), p.base = u.__e, u.__u &= -161, p.__h.length && e.push(p), k && (p.__E = p.__ = null);
		} catch (n) {
			if (e.length = h, u.__v = null, c || null != o) {
				if (n.then) {
					for (u.__u |= c ? 160 : 128; f && 8 == f.nodeType && f.nextSibling;) f = f.nextSibling;
					null != o && (o[o.indexOf(f)] = null), u.__e = f;
				} else if (null != o) for (j = o.length; j--;) b$1(o[j]);
			} else u.__e = t.__e;
			u.__k ??= t.__k || [], n.then || B$1(u), l$1.__e(n, u, t);
		}
	} else null == o && u.__v == t.__v ? (u.__k = t.__k, u.__e = t.__e) : f = u.__e = G(t.__e, u, t, i, r, o, e, c, a);
	return (s = l$1.diffed) && s(u), 128 & u.__u ? void 0 : f;
}
function B$1(n) {
	n && (n.__c && (n.__c.__e = !0), n.__k && n.__k.some(B$1));
}
function D$1(n, u, t) {
	for (var i = 0; i < t.length; i++) J$1(t[i], t[++i], t[++i]);
	l$1.__c && l$1.__c(u, n), n.some(function(u) {
		try {
			n = u.__h, u.__h = [], n.some(function(n) {
				n.call(u);
			});
		} catch (n) {
			l$1.__e(n, u.__v);
		}
	});
}
function E(n) {
	return "object" != typeof n || null == n || n.__b > 0 ? n : g$1(n) ? n.map(E) : void 0 !== n.constructor ? null : m$1({}, n);
}
function G(u, t, i, r, o, e, f, c, a) {
	var s, h, p, v, y, w, _, m = i.props || d$1, k = t.props, x = t.type;
	if ("svg" == x ? o = "http://www.w3.org/2000/svg" : "math" == x ? o = "http://www.w3.org/1998/Math/MathML" : o || (o = "http://www.w3.org/1999/xhtml"), null != e) {
		for (s = 0; s < e.length; s++) if ((y = e[s]) && "setAttribute" in y == !!x && (x ? y.localName == x : 3 == y.nodeType)) {
			u = y, e[s] = null;
			break;
		}
	}
	if (null == u) {
		if (null == x) return document.createTextNode(k);
		u = document.createElementNS(o, x, k.is && k), c && (l$1.__m && l$1.__m(t, e), c = !1), e = null;
	}
	if (null == x) m === k || c && u.data == k || (u.data = k);
	else {
		if (e = "textarea" == x && null != k.defaultValue ? null : e && n.call(u.childNodes), !c && null != e) for (m = {}, s = 0; s < u.attributes.length; s++) m[(y = u.attributes[s]).name] = y.value;
		for (s in m) y = m[s], "dangerouslySetInnerHTML" == s ? p = y : "children" == s || s in k || "value" == s && "defaultValue" in k || "checked" == s && "defaultChecked" in k || N$1(u, s, null, y, o);
		for (s in k) y = k[s], "children" == s ? v = y : "dangerouslySetInnerHTML" == s ? h = y : "value" == s ? w = y : "checked" == s ? _ = y : c && "function" != typeof y || m[s] === y || N$1(u, s, y, m[s], o);
		if (h) c || p && (h.__html == p.__html || h.__html == u.innerHTML) || (u.innerHTML = h.__html), t.__k = [];
		else if (p && (u.innerHTML = ""), L("template" == t.type ? u.content : u, g$1(v) ? v : [v], t, i, r, "foreignObject" == x ? "http://www.w3.org/1999/xhtml" : o, e, f, e ? e[0] : i.__k && $$1(i, 0), c, a), null != e) for (s = e.length; s--;) b$1(e[s]);
		c && "textarea" != x || (s = "value", "progress" == x && null == w ? u.removeAttribute("value") : null != w && (w !== u[s] || "progress" == x && !w || "option" == x && w != m[s]) && N$1(u, s, w, m[s], o), s = "checked", null != _ && _ != u[s] && N$1(u, s, _, m[s], o));
	}
	return u;
}
function J$1(n, u, t) {
	try {
		if ("function" == typeof n) {
			var i = "function" == typeof n.__u;
			i && n.__u(), i && null == u || (n.__u = n(u));
		} else n.current = u;
	} catch (n) {
		l$1.__e(n, t);
	}
}
function K$1(n, u, t) {
	var i, r;
	if (l$1.unmount && l$1.unmount(n), (i = n.ref) && (i.current && i.current != n.__e || J$1(i, null, u)), null != (i = n.__c)) {
		if (i.componentWillUnmount) try {
			i.componentWillUnmount();
		} catch (n) {
			l$1.__e(n, u);
		}
		i.base = i.__P = i.__n = null;
	}
	if (i = n.__k) for (r = 0; r < i.length; r++) i[r] && K$1(i[r], u, t || "function" != typeof n.type);
	t || b$1(n.__e), n.__c = n.__ = n.__e = void 0;
}
function Q(n, l, u) {
	return this.constructor(n, u);
}
n = w$1.slice, l$1 = { __e: function(n, l, u, t) {
	for (var i, r, o; l = l.__;) if ((i = l.__c) && !i.__) try {
		if ((r = i.constructor) && null != r.getDerivedStateFromError && (i.setState(r.getDerivedStateFromError(n)), o = i.__d), null != i.componentDidCatch && (i.componentDidCatch(n, t || {}), o = i.__d), o) return i.__E = i;
	} catch (l) {
		n = l;
	}
	throw n;
} }, u$2 = 0, C$1.prototype.setState = function(n, l) {
	var u = null != this.__s && this.__s != this.state ? this.__s : this.__s = m$1({}, this.state);
	"function" == typeof n && (n = n(m$1({}, u), this.props)), n && m$1(u, n), null != n && this.__v && (l && this._sb.push(l), A$1(this));
}, C$1.prototype.forceUpdate = function(n) {
	this.__v && (this.__e = !0, n && this.__h.push(n), A$1(this));
}, C$1.prototype.render = S, i$2 = [], o$1 = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n, l) {
	return n.__v.__b - l.__v.__b;
}, H$1.__r = 0, f$2 = Math.random().toString(8), c$1 = "__d" + f$2, a$1 = "__a" + f$2, s$1 = /(PointerCapture)$|Capture$/i, h$1 = 0, p$1 = V$1(!1), v$1 = V$1(!0);
//#endregion
//#region ../../node_modules/.pnpm/preact-render-to-string@6.7.0_preact@10.29.8/node_modules/preact-render-to-string/dist/index.module.js
var r = "diffed";
var o = "__c";
var i$1 = "__s";
var a = "__c";
var c = "__k";
var u$1 = "__d";
var s = "__s";
var l = /[\s\n\\/='"\0<>]/;
var f$1 = /^(xlink|xmlns|xml)([A-Z])/;
var p = /^(?:accessK|auto[A-Z]|cell|ch|col|cont|cross|dateT|encT|form[A-Z]|frame|hrefL|inputM|maxL|minL|noV|playsI|popoverT|readO|rowS|src[A-Z]|tabI|useM|item[A-Z])/;
var h = /^ac|^ali|arabic|basel|cap|clipPath$|clipRule$|color|dominant|enable|fill|flood|font|glyph[^R]|horiz|image|letter|lighting|marker[^WUH]|overline|panose|pointe|paint|rendering|shape|stop|strikethrough|stroke|text[^L]|transform|underline|unicode|units|^v[^i]|^w|^xH/;
var d = /* @__PURE__ */ new Set(["draggable", "spellcheck"]);
function v(e) {
	void 0 !== e.__g ? e.__g |= 8 : e[u$1] = !0;
}
function m(e) {
	void 0 !== e.__g ? e.__g &= -9 : e[u$1] = !1;
}
function y(e) {
	return void 0 !== e.__g ? !!(8 & e.__g) : !0 === e[u$1];
}
var _ = /["&<]/;
function g(e) {
	if (0 === e.length || !1 === _.test(e)) return e;
	for (var t = 0, n = 0, r = "", o = ""; n < e.length; n++) {
		switch (e.charCodeAt(n)) {
			case 34:
				o = "&quot;";
				break;
			case 38:
				o = "&amp;";
				break;
			case 60:
				o = "&lt;";
				break;
			default: continue;
		}
		n !== t && (r += e.slice(t, n)), r += o, t = n + 1;
	}
	return n !== t && (r += e.slice(t, n)), r;
}
var b = {};
var x = /* @__PURE__ */ new Set([
	"animation-iteration-count",
	"border-image-outset",
	"border-image-slice",
	"border-image-width",
	"box-flex",
	"box-flex-group",
	"box-ordinal-group",
	"column-count",
	"fill-opacity",
	"flex",
	"flex-grow",
	"flex-negative",
	"flex-order",
	"flex-positive",
	"flex-shrink",
	"flood-opacity",
	"font-weight",
	"grid-column",
	"grid-row",
	"line-clamp",
	"line-height",
	"opacity",
	"order",
	"orphans",
	"stop-opacity",
	"stroke-dasharray",
	"stroke-dashoffset",
	"stroke-miterlimit",
	"stroke-opacity",
	"stroke-width",
	"tab-size",
	"widows",
	"z-index",
	"zoom"
]);
var k = /[A-Z]/g;
function w(e) {
	var t = "";
	for (var n in e) {
		var r = e[n];
		if (null != r && "" !== r) {
			var o = "-" == n[0] ? n : b[n] || (b[n] = n.replace(k, "-$&").toLowerCase()), i = ";";
			"number" != typeof r || o.startsWith("--") || x.has(o) || (i = "px;"), t = t + o + ":" + r + i;
		}
	}
	return t || void 0;
}
function C() {
	this.__d = !0;
}
function A(e, t) {
	return {
		__v: e,
		context: t,
		props: e.props,
		setState: C,
		forceUpdate: C,
		__d: !0,
		__h: new Array(0)
	};
}
var D;
var P;
var $;
var U;
var F = {};
var M = [];
var W = Array.isArray;
var z = Object.assign;
var H = "";
var N = "<!--$s-->";
var q = "<!--/$s-->";
function B(e) {
	return "string" == typeof e ? N + e + q : W(e) ? (e.unshift(N), e.push(q), e) : e && "function" == typeof e.then ? e.then(B) : N + e + q;
}
function I(a, u, s) {
	var l = l$1[i$1];
	l$1[i$1] = !0, D = l$1.__b, P = l$1[r], $ = l$1.__r, U = l$1.unmount;
	var f = k$1(S, null);
	f[c] = [a];
	try {
		var p = R(a, u || F, !1, void 0, f, !1, s);
		return W(p) ? p.join(H) : p;
	} catch (e) {
		if (e.then) throw new Error("Use \"renderToStringAsync\" for suspenseful rendering.");
		throw e;
	} finally {
		l$1[o] && l$1[o](a, M), l$1[i$1] = l, M.length = 0;
	}
}
function O(e, t) {
	var n, r = e.type, o = !0;
	return e[a] ? (o = !1, (n = e[a]).state = n[s]) : n = new r(e.props, t), e[a] = n, n.__v = e, n.props = e.props, n.context = t, v(n), n.state ?? (n.state = F), n[s] ?? (n[s] = n.state), r.getDerivedStateFromProps ? n.state = z({}, n.state, r.getDerivedStateFromProps(n.props, n.state)) : o && n.componentWillMount ? (n.componentWillMount(), n.state = n[s] !== n.state ? n[s] : n.state) : !o && n.componentWillUpdate && n.componentWillUpdate(), $ && $(e), n.render(n.props, n.state, t);
}
function R(t, r, o, i, u, _, b) {
	if (null == t || !0 === t || !1 === t || t === H) return H;
	var x = typeof t;
	if ("object" != x) return "function" == x ? H : "string" == x ? g(t) : t + H;
	if (W(t)) {
		var k, C = H;
		u[c] = t;
		for (var S$2 = t.length, L = 0; L < S$2; L++) {
			var E = t[L];
			if (null != E && "boolean" != typeof E) {
				var j, T = R(E, r, o, i, u, _, b);
				"string" == typeof T ? C += T : (k || (k = new Array(S$2)), C && k.push(C), C = H, W(T) ? (j = k).push.apply(j, T) : k.push(T));
			}
		}
		return k ? (C && k.push(C), k) : C;
	}
	if (void 0 !== t.constructor) return H;
	t.__ = u, D && D(t);
	var Z = t.type, M = t.props;
	if ("function" == typeof Z) {
		var N, q, I, K = r;
		if (Z === S) {
			if ("tpl" in M) {
				for (var G = H, Q = 0; Q < M.tpl.length; Q++) if (G += M.tpl[Q], M.exprs && Q < M.exprs.length) {
					var X = M.exprs[Q];
					if (null == X) continue;
					"object" != typeof X || void 0 !== X.constructor && !W(X) ? G += X : G += R(X, r, o, i, t, _, b);
				}
				return G;
			}
			if ("UNSTABLE_comment" in M) return "<!--" + g(M.UNSTABLE_comment) + "-->";
			q = M.children;
		} else {
			if (null != (N = Z.contextType)) {
				var Y = r[N.__c];
				K = Y ? Y.props.value : N.__;
			}
			var ee = Z.prototype && "function" == typeof Z.prototype.render;
			if (ee) q = O(t, K), I = t[a];
			else {
				t[a] = I = A(t, K);
				for (var te = 0; y(I) && te++ < 25;) {
					m(I), $ && $(t);
					try {
						q = Z.call(I, M, K);
					} catch (e) {
						throw _ && e && "function" == typeof e.then && (t._suspended = !0), e;
					}
				}
				v(I);
			}
			if (null != I.getChildContext && (r = z({}, r, I.getChildContext())), ee && l$1.errorBoundaries && (Z.getDerivedStateFromError || I.componentDidCatch)) {
				q = null != q && q.type === S && null == q.key && null == q.props.tpl ? q.props.children : q;
				try {
					return R(q, r, o, i, t, _, !1);
				} catch (e) {
					return Z.getDerivedStateFromError && (I[s] = Z.getDerivedStateFromError(e)), I.componentDidCatch && I.componentDidCatch(e, F), y(I) ? (q = O(t, r), null != (I = t[a]).getChildContext && (r = z({}, r, I.getChildContext())), R(q = null != q && q.type === S && null == q.key && null == q.props.tpl ? q.props.children : q, r, o, i, t, _, b)) : H;
				} finally {
					P && P(t), U && U(t);
				}
			}
		}
		q = null != q && q.type === S && null == q.key && null == q.props.tpl ? q.props.children : q;
		try {
			var ne = R(q, r, o, i, t, _, b);
			return P && P(t), l$1.unmount && l$1.unmount(t), t._suspended ? B(ne) : ne;
		} catch (n) {
			if (!_ && b && b.onError) {
				var re = function e(n) {
					return b.onError(n, t, function(t, n) {
						try {
							return R(t, r, o, i, n, _, b);
						} catch (t) {
							return e(t);
						}
					});
				}(n);
				if (void 0 !== re) return re;
				var oe = l$1.__e;
				return oe && oe(n, t), H;
			}
			if (!_) throw n;
			if (!n || "function" != typeof n.then) throw n;
			return n.then(function e() {
				try {
					var n = R(q, r, o, i, t, _, b);
					return t._suspended ? B(n) : n;
				} catch (t) {
					if (!t || "function" != typeof t.then) throw t;
					return t.then(e);
				}
			});
		}
	}
	var ie, ae = "<" + Z, ce = H;
	for (var ue in M) {
		var se = M[ue];
		if ("function" != typeof (se = J(se) ? se.value : se) || "class" === ue || "className" === ue) {
			switch (ue) {
				case "children":
					ie = se;
					continue;
				case "key":
				case "ref":
				case "__self":
				case "__source": continue;
				case "htmlFor":
					if ("for" in M) continue;
					ue = "for";
					break;
				case "className":
					if ("class" in M) continue;
					ue = "class";
					break;
				case "defaultChecked":
					ue = "checked";
					break;
				case "defaultSelected":
					ue = "selected";
					break;
				case "defaultValue":
				case "value":
					switch (ue = "value", Z) {
						case "textarea":
							ie = se;
							continue;
						case "select":
							i = se;
							continue;
						case "option": i != se || "selected" in M || (ae += " selected");
					}
					break;
				case "dangerouslySetInnerHTML":
					ce = se && se.__html;
					continue;
				case "style":
					"object" == typeof se && (se = w(se));
					break;
				case "acceptCharset":
					ue = "accept-charset";
					break;
				case "httpEquiv":
					ue = "http-equiv";
					break;
				default:
					if (l.test(ue)) continue;
					f$1.test(ue) ? ue = ue.replace(f$1, "$1:$2").toLowerCase() : "-" !== ue[4] && !d.has(ue) || null == se ? o ? h.test(ue) && (ue = "panose1" === ue ? "panose-1" : ue.replace(/([A-Z])/g, "-$1").toLowerCase()) : p.test(ue) && (ue = ue.toLowerCase()) : se += H;
			}
			null != se && !1 !== se && (ae = !0 === se || se === H ? ae + " " + ue : ae + " " + ue + "=\"" + ("string" == typeof se ? g(se) : se + H) + "\"");
		}
	}
	if (l.test(Z)) throw new Error(Z + " is not a valid HTML tag name in " + ae + ">");
	if (ce || ("string" == typeof ie ? ce = g(ie) : null != ie && !1 !== ie && !0 !== ie && (ce = R(ie, r, "svg" === Z || "foreignObject" !== Z && o, i, t, _, b))), P && P(t), U && U(t), !ce && V.has(Z)) return ae + "/>";
	var le = "</" + Z + ">", fe = ae + ">";
	return W(ce) ? [fe].concat(ce, [le]) : "string" != typeof ce ? [
		fe,
		ce,
		le
	] : fe + ce + le;
}
var V = /* @__PURE__ */ new Set([
	"area",
	"base",
	"br",
	"col",
	"command",
	"embed",
	"hr",
	"img",
	"input",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr"
]);
var K = I;
function J(e) {
	return null !== e && "object" == typeof e && "function" == typeof e.peek && "value" in e;
}
//#endregion
//#region ../render/src/styles/a4.css?raw
var a4_default = "/*\n * Feuille A4 réelle, en millimètres.\n *\n * Le prototype dessinait un aperçu à l'échelle, en pixels minuscules (7,4 px\n * pour le corps de texte). Ça se voit à l'écran et ça s'imprime n'importe\n * comment. Ici la page fait ses 210 × 297 mm et le texte ses points : on rend à\n * la taille vraie, et c'est l'aperçu qui est mis à l'échelle par --echelle.\n *\n * **Cette feuille ignore le thème sombre, et c'est voulu** : un devis part à\n * l'impression et chez un client. Il est blanc chez tout le monde. Elle ne lit\n * donc aucun jeton de l'interface et se suffit à elle-même.\n *\n * Aucune police web : on prend ce que le téléphone a déjà (invariant § 2.6).\n */\n\n.a4-cadre {\n  --echelle: 1;\n  width: calc(210mm * var(--echelle));\n  overflow: hidden;\n}\n\n.a4-cadre > .a4 {\n  transform: scale(var(--echelle));\n  transform-origin: top left;\n  margin-bottom: calc((297mm * var(--echelle)) - 297mm);\n  box-shadow: 0 2px 18px rgb(18 23 16 / 12%);\n}\n\n.a4 {\n  --pa: #1f2a44;\n  --trait: #d7dce1;\n  --trait-fort: #aeb6bd;\n  --gris: #4e575e;\n  --gris-clair: #7b848b;\n\n  box-sizing: border-box;\n  position: relative;\n  width: 210mm;\n  min-height: 297mm;\n  padding: 15mm 16mm 20mm;\n  background: #fff;\n  color: #16191c;\n  font: 9.5pt/1.5 system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n  font-variant-numeric: tabular-nums lining-nums;\n  /* Les aplats d'accent doivent sortir de l'imprimante, pas être « économisés ». */\n  print-color-adjust: exact;\n  -webkit-print-color-adjust: exact;\n}\n\n.a4 * {\n  box-sizing: border-box;\n}\n\n/* ─────────────────────────────── entête ─────────────────────────────── */\n\n.a4-entete {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 10mm;\n  padding-bottom: 3.5mm;\n  border-bottom: 0.7mm solid var(--pa);\n}\n\n.a4-entete .raison {\n  font-size: 14pt;\n  font-weight: 700;\n  line-height: 1.15;\n  letter-spacing: -0.01em;\n  color: var(--pa);\n}\n\n.a4-entete .coordonnees,\n.a4-entete .immat {\n  margin-top: 1.5mm;\n  font-size: 8pt;\n  line-height: 1.55;\n  color: var(--gris);\n}\n\n.a4-entete .immat {\n  text-align: right;\n  white-space: nowrap;\n}\n\n/* ─────────────────────────────── titre ─────────────────────────────── */\n\n.a4-titre {\n  margin: 9mm 0 0;\n  font-size: 22pt;\n  font-weight: 700;\n  line-height: 1;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--pa);\n}\n\n.a4-sous-titre {\n  margin-top: 2mm;\n  font-size: 9pt;\n  color: var(--gris);\n}\n\n.a4-bloc-client {\n  margin-top: 7mm;\n  padding: 3.5mm 4mm;\n  border: 0.25mm solid var(--trait);\n  border-left: 1.2mm solid var(--pa);\n  border-radius: 0 1mm 1mm 0;\n  background: #fbfcfd;\n  font-size: 9pt;\n  line-height: 1.55;\n}\n\n.a4-bloc-client .etiquette {\n  margin-bottom: 0.8mm;\n  font-size: 7.5pt;\n  font-weight: 700;\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  color: var(--gris-clair);\n}\n\n/* ─────────────────────────────── tableau ─────────────────────────────── */\n\n.a4-tableau {\n  width: 100%;\n  margin-top: 7mm;\n  border-collapse: collapse;\n  font-size: 8.5pt;\n}\n\n.a4-tableau th {\n  padding: 2.4mm 2mm;\n  border-bottom: 0.6mm solid var(--pa);\n  font-size: 7.5pt;\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  text-align: left;\n  color: var(--pa);\n  white-space: nowrap;\n}\n\n.a4-tableau td {\n  padding: 2.4mm 2mm;\n  border-bottom: 0.2mm solid var(--trait);\n  vertical-align: top;\n}\n\n/* Une ligne de facture ne se coupe pas au milieu par un saut de page. */\n.a4-tableau tr {\n  break-inside: avoid;\n}\n\n.a4-tableau .nombre {\n  text-align: right;\n  white-space: nowrap;\n}\n\n.a4-tableau tbody tr:last-child td {\n  border-bottom: 0.4mm solid var(--trait-fort);\n}\n\n.a4-vide {\n  padding: 8mm 0;\n  color: var(--gris-clair);\n  font-style: italic;\n  text-align: center;\n}\n\n/* ─────────────────────────────── totaux ─────────────────────────────── */\n\n.a4-totaux {\n  margin-top: 5mm;\n  margin-left: auto;\n  width: 88mm;\n  font-size: 9pt;\n  break-inside: avoid;\n}\n\n.a4-totaux .ligne {\n  display: flex;\n  justify-content: space-between;\n  gap: 6mm;\n  padding: 1.6mm 1mm;\n}\n\n.a4-totaux .ligne + .ligne {\n  border-top: 0.2mm solid var(--trait);\n}\n\n.a4-totaux .fort {\n  margin-top: 1.5mm;\n  padding: 2.6mm 3mm;\n  border: 0;\n  border-radius: 1mm;\n  background: var(--pa);\n  color: #fff;\n  font-size: 11.5pt;\n  font-weight: 700;\n  letter-spacing: 0.01em;\n}\n\n.a4-en-lettres {\n  margin-top: 4mm;\n  font-size: 8.5pt;\n  font-style: italic;\n  line-height: 1.55;\n  color: var(--gris);\n  break-inside: avoid;\n}\n\n/* ─────────────────────── mentions, signatures, pied ─────────────────────── */\n\n.a4-mentions {\n  margin-top: 7mm;\n  font-size: 8pt;\n  line-height: 1.6;\n  color: var(--gris);\n  orphans: 2;\n  widows: 2;\n}\n\n.a4-mentions p {\n  margin: 0 0 2mm;\n}\n\n.a4-signatures {\n  display: flex;\n  gap: 10mm;\n  margin-top: 12mm;\n  break-inside: avoid;\n}\n\n.a4-signatures .zone {\n  flex: 1;\n}\n\n.a4-signatures .libelle {\n  font-size: 7.5pt;\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--pa);\n}\n\n.a4-signatures .mention {\n  margin-top: 0.8mm;\n  font-size: 7.5pt;\n  color: var(--gris-clair);\n}\n\n.a4-signatures .cadre {\n  margin-top: 2.5mm;\n  height: 24mm;\n  border: 0.25mm dashed var(--trait-fort);\n  border-radius: 1mm;\n}\n\n.a4-pied {\n  position: absolute;\n  left: 16mm;\n  right: 16mm;\n  bottom: 11mm;\n  padding-top: 2.5mm;\n  border-top: 0.2mm solid var(--trait);\n  font-size: 7pt;\n  line-height: 1.6;\n  color: var(--gris-clair);\n}\n\n.a4-numero-page {\n  position: absolute;\n  right: 16mm;\n  bottom: 6mm;\n  font-size: 7pt;\n  color: var(--gris-clair);\n}\n\n/* ─────────────────────────────── impression ─────────────────────────── */\n\n@page {\n  size: A4;\n  margin: 0;\n}\n\n@media print {\n  .a4-cadre {\n    --echelle: 1;\n    width: auto;\n    overflow: visible;\n  }\n\n  .a4-cadre > .a4 {\n    transform: none;\n    margin-bottom: 0;\n    box-shadow: none;\n  }\n}\n\n/* ────────────────────── actes et lettres ────────────────────── */\n/*\n * Ces quatre documents ne portent pas de tableau taxé. Ce qui les distingue,\n * c'est la disposition : un acte pose ses parties avant son corps, une lettre\n * française met l'expéditeur à gauche et le destinataire à droite. Le reste —\n * papier, titre, signatures, pied — vient des mêmes pièces que le devis.\n */\n\n/* Un corps de texte long : la mesure compte plus que la taille. */\n.a4-corps {\n  margin-top: 6mm;\n  font-size: 9.5pt;\n  line-height: 1.7;\n  color: var(--encre);\n  text-align: justify;\n}\n\n.a4-corps p {\n  margin: 0 0 3.5mm;\n}\n\n/* Les deux parties d'un acte, nommées avant le corps. */\n.a4-parties {\n  margin-top: 6mm;\n  font-size: 9.5pt;\n  line-height: 1.9;\n}\n\n.a4-parties .qui {\n  font-weight: 700;\n  color: var(--pa);\n}\n\n/* Le montant encadré : ce que l'œil doit trouver en premier sur l'acte. */\n.a4-encadre {\n  margin-top: 6mm;\n  padding: 4mm 5mm;\n  border: 0.5mm solid var(--pa);\n  border-radius: 1mm;\n  break-inside: avoid;\n}\n\n.a4-encadre .etiquette {\n  font-size: 7.5pt;\n  font-weight: 700;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--pa);\n}\n\n.a4-encadre .chiffre {\n  margin-top: 1mm;\n  font-size: 16pt;\n  font-weight: 800;\n  letter-spacing: -0.01em;\n}\n\n.a4-encadre .lettres {\n  margin-top: 0.8mm;\n  font-size: 9pt;\n  font-style: italic;\n  color: var(--gris);\n}\n\n.a4-encadre .echeance {\n  margin-top: 2.5mm;\n  font-size: 9pt;\n}\n\n/* La disposition d'une lettre française. */\n.a4-lettre-tete {\n  display: flex;\n  justify-content: space-between;\n  gap: 10mm;\n  font-size: 9pt;\n  line-height: 1.5;\n}\n\n.a4-lettre-tete .expediteur {\n  max-width: 70mm;\n}\n\n.a4-lettre-tete .destinataire {\n  max-width: 80mm;\n  text-align: right;\n  color: var(--gris);\n}\n\n.a4-lettre-date {\n  margin-top: 8mm;\n  font-size: 9pt;\n  text-align: right;\n  color: var(--gris);\n}\n\n.a4-lettre-objet {\n  display: inline-block;\n  margin-top: 6mm;\n  padding-bottom: 1mm;\n  border-bottom: 0.3mm solid var(--pa);\n  font-size: 10pt;\n  font-weight: 600;\n}\n\n.a4-lettre-signature {\n  margin-top: 10mm;\n  font-size: 10pt;\n  text-align: right;\n}\n\n/* ───────────────────────────── curriculum vitæ ─────────────────────────────\n *\n * Quatre gabarits pour une même feuille. Ils ne diffèrent que par la police,\n * la façon d'annoncer une section et la présence d'une colonne : la structure\n * du contenu est la même pour les quatre, et c'est ce qui permet de changer de\n * gabarit sans rien ressaisir.\n *\n * Aucune police web ici non plus (invariant § 2.6). « Serif » et « grotesque »\n * se jouent avec les familles génériques que tout téléphone possède.\n */\n\n.a4-cv {\n  --cv-inter: 1.5;\n  --cv-saut: 5mm;\n}\n\n.a4-cv.dense {\n  --cv-inter: 1.28;\n  --cv-saut: 3mm;\n  font-size: 9pt;\n}\n\n.a4-cv .cv-nom {\n  font-size: 20pt;\n  font-weight: 700;\n  letter-spacing: 0.02em;\n  line-height: 1.15;\n}\n\n.a4-cv .cv-titre {\n  margin-top: 1mm;\n  color: var(--pa);\n  font-size: 11pt;\n  font-weight: 600;\n}\n\n.a4-cv .cv-contact {\n  margin-top: 2mm;\n  color: var(--gris);\n  font-size: 9pt;\n}\n\n.a4-cv .cv-section {\n  margin: var(--cv-saut) 0 2mm;\n  color: var(--pa);\n  font-size: 9pt;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.a4-cv .cv-profil {\n  line-height: var(--cv-inter);\n  text-align: justify;\n}\n\n.a4-cv .cv-profil p {\n  margin: 0 0 2mm;\n}\n\n.a4-cv .cv-item {\n  margin-bottom: 3mm;\n  line-height: var(--cv-inter);\n}\n\n.a4-cv .cv-quoi {\n  font-size: 10pt;\n  font-weight: 600;\n}\n\n.a4-cv .cv-ou {\n  color: var(--gris);\n  font-size: 9pt;\n}\n\n/* La puce est dessinée, pas listée : un <ul> imprime des marges que le\n * gabarit ne contrôle pas d'un navigateur à l'autre. */\n.a4-cv .cv-fait {\n  position: relative;\n  margin-top: 1mm;\n  padding-left: 4mm;\n  font-size: 9.5pt;\n}\n\n.a4-cv .cv-fait::before {\n  content: \"\";\n  position: absolute;\n  top: 1.7mm;\n  left: 0.8mm;\n  width: 1.2mm;\n  height: 1.2mm;\n  background: var(--pa);\n}\n\n.a4-cv .cv-serie {\n  font-size: 9.5pt;\n  line-height: var(--cv-inter);\n}\n\n/* — Notaire : sérif, tout centré, pour une administration. — */\n.a4-cv.notaire {\n  font-family: Georgia, \"Times New Roman\", serif;\n}\n\n.a4-cv.notaire .cv-tete {\n  padding-bottom: 3mm;\n  border-bottom: 0.4mm solid var(--pa);\n  text-align: center;\n}\n\n.a4-cv.notaire .cv-section {\n  border-bottom: 0.2mm solid var(--trait);\n  padding-bottom: 1mm;\n  text-align: center;\n  letter-spacing: 0.14em;\n}\n\n.a4-cv.notaire .cv-serie {\n  text-align: center;\n}\n\n/* — Exécutif : grotesque, un filet de couleur, pour le privé. — */\n\n/*\n * Le filet sort dans la marge : posé dans la colonne de texte, il décalait le\n * nom de quatre millimètres vers la droite et l'entête ne s'alignait plus sur\n * les titres de section en dessous.\n */\n.a4-cv.executif .cv-tete {\n  /* 5 mm de retrait plus l'épaisseur du filet : sans elle, le nom reste décalé\n   * du filet lui-même et rate l'alignement d'un millimètre et demi. */\n  margin-left: -6.5mm;\n  border-left: 1.5mm solid var(--pa);\n  padding-left: 5mm;\n}\n\n.a4-cv.executif .cv-section {\n  border-bottom: 0.2mm solid var(--trait);\n  padding-bottom: 1mm;\n}\n\n/* — Éditorial : le nom en display, la date en marge, pour un métier créatif. — */\n.a4-cv.editorial .cv-nom {\n  font-size: 28pt;\n  font-weight: 300;\n  letter-spacing: -0.01em;\n}\n\n.a4-cv.editorial .cv-tete {\n  padding-bottom: 4mm;\n  border-bottom: 0.8mm solid var(--pa);\n}\n\n.a4-cv.editorial .cv-section {\n  color: var(--gris-clair);\n  letter-spacing: 0.18em;\n}\n\n/*\n * `column-gap`, pas `gap` : chaque fait occupe sa propre rangée de la grille,\n * et un `gap` de quatre millimètres les écartait tous les uns des autres —\n * trois puces séparées comme trois paragraphes.\n */\n.a4-cv.editorial .cv-item {\n  display: grid;\n  grid-template-columns: 28mm 1fr;\n  column-gap: 4mm;\n}\n\n.a4-cv.editorial .cv-marge {\n  grid-column: 1;\n  grid-row: 1;\n  color: var(--gris);\n  font-size: 9pt;\n  text-align: right;\n}\n\n.a4-cv.editorial .cv-quoi,\n.a4-cv.editorial .cv-ou,\n.a4-cv.editorial .cv-fait {\n  grid-column: 2;\n}\n\n/* — Bloc : une bande latérale porte le contact et les listes. — */\n\n/*\n * La hauteur est celle de la zone de texte de la feuille : 297 mm moins les\n * marges haute et basse. Sans elle, le filet de la bande s'arrête où le\n * contenu s'arrête, et un CV court montre un trait qui meurt au milieu de la\n * page — ce qui se lit comme un défaut de rendu, pas comme un parti pris.\n */\n.a4-cv.bloc {\n  display: grid;\n  grid-template-columns: 58mm 1fr;\n  gap: 8mm;\n  min-height: calc(297mm - 15mm - 20mm);\n}\n\n/* Justifier une colonne de cent millimètres ouvre des rivières entre les mots. */\n.a4-cv.bloc .cv-profil {\n  text-align: left;\n}\n\n.a4-cv.bloc .cv-bande {\n  padding-right: 6mm;\n  border-right: 0.3mm solid var(--trait);\n}\n\n.a4-cv.bloc .cv-bande .cv-nom {\n  font-size: 16pt;\n}\n\n.a4-cv.bloc .cv-bande .cv-titre {\n  font-size: 10pt;\n}\n\n.a4-cv.bloc .cv-ligne {\n  margin-top: 1mm;\n  font-size: 9pt;\n  line-height: 1.35;\n  overflow-wrap: anywhere;\n}\n\n.a4-cv.bloc .cv-principal .cv-section:first-child {\n  margin-top: 0;\n}\n";
//#endregion
//#region src/feuille.ts
/**
* La feuille de style, allégée de ce qui ne sert qu'à la relire.
*
* Le CSS est inliné dans la page publiée — une feuille séparée serait une
* requête de plus sur une connexion qui hoquette. Inlinée telle quelle, elle
* emportait aussi ses commentaires : **vingt-neuf pour cent de la page**, six
* kilo-octets qui expliquent au prochain lecteur du code pourquoi la feuille
* A4 fait ses millimètres. Le destinataire d'un devis, lui, les télécharge
* sans jamais les lire. Six mille octets de moins font deux mille trois cents
* octets de moins une fois comprimés, sur la seule page que le produit envoie
* à des gens qui ne l'ont pas demandée.
*
* Un lecteur caractère par caractère et non une expression régulière : `/*`
* dans une chaîne CSS — `content: "/*"` — est du texte, et une expression
* régulière qui ne compte pas les guillemets couperait la règle en deux. Le
* cas ne se présente pas aujourd'hui dans ces deux feuilles ; c'est justement
* pour qu'il puisse se présenter demain sans casser la page.
*/
function sansCommentaires(css) {
	let sortie = "";
	let i = 0;
	/** Le guillemet ouvrant en cours, ou '' hors chaîne. */
	let chaine = "";
	while (i < css.length) {
		const c = css[i] ?? "";
		if (chaine !== "") {
			sortie += c;
			if (c === "\\" && i + 1 < css.length) {
				sortie += css[i + 1];
				i += 2;
				continue;
			}
			if (c === chaine) chaine = "";
			i += 1;
			continue;
		}
		if (c === "\"" || c === "'") {
			chaine = c;
			sortie += c;
			i += 1;
			continue;
		}
		if (c === "/" && css[i + 1] === "*") {
			const fin = css.indexOf("*/", i + 2);
			if (fin === -1) break;
			i = fin + 2;
			if (css[i] === "\n" && /(^|\n)[ \t]*$/.test(sortie)) i += 1;
			continue;
		}
		sortie += c;
		i += 1;
	}
	return sortie;
}
//#endregion
//#region ../render/src/encres.ts
/**
* Les quatre encres des documents.
*
* Des aplats, jamais de dégradé : ça divise par trois le poids du PNG partagé
* (invariant § 2.6). Ces valeurs vivront dans `packages/ui` le jour où ce
* paquet aura une raison d'exister — c'est-à-dire quand il portera l'i18n et
* les composants partagés. Quatre couleurs ne justifient pas un paquet.
*/
var ENCRES = {
	encre: {
		hex: "#1F2A44",
		nom: "Encre"
	},
	bordeaux: {
		hex: "#6E1F2B",
		nom: "Bordeaux"
	},
	foret: {
		hex: "#1B4D3E",
		nom: "Forêt"
	},
	ardoise: {
		hex: "#39434A",
		nom: "Ardoise"
	}
};
function hexEncre(e) {
	return ENCRES[e].hex;
}
//#endregion
//#region ../../node_modules/.pnpm/preact@10.29.8_preact-render-to-string@6.7.0/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
var f = 0;
Array.isArray;
function u(e, t, n, o, i, u) {
	t || (t = {});
	var a, c, p = t;
	if ("ref" in p) for (c in p = {}, t) "ref" == c ? a = t[c] : p[c] = t[c];
	var l = {
		type: e,
		props: p,
		key: n,
		ref: a,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		constructor: void 0,
		__v: --f,
		__i: -1,
		__u: 0,
		__source: i,
		__self: u
	};
	if ("function" == typeof e && (a = e.defaultProps)) for (c in a) void 0 === p[c] && (p[c] = a[c]);
	return l$1.vnode && l$1.vnode(l), l;
}
//#endregion
//#region ../render/src/doc/chrome.tsx
/**
* Les pièces communes aux documents A4.
*
* Rien n'est injecté en HTML : tout passe par des enfants JSX, que Preact
* échappe. C'est l'invariant § 2.1 tenu à l'endroit où il compte — le rendu.
* Un test vérifie qu'aucune source de ce paquet n'appelle
* `dangerouslySetInnerHTML`.
*/
/** Une feuille A4 à la taille vraie. L'aperçu est mis à l'échelle par le CSS. */
function PageA4(props) {
	return /* @__PURE__ */ u("div", {
		class: "a4-cadre",
		children: /* @__PURE__ */ u("article", {
			class: "a4",
			style: { "--pa": hexEncre(props.encre) },
			children: props.children
		})
	});
}
/** Ne rend une ligne que si elle porte quelque chose. */
function Lignes(props) {
	return /* @__PURE__ */ u(S, { children: props.valeurs.filter((v) => v !== null && v.trim() !== "").map((v, i) => /* @__PURE__ */ u("div", { children: v }, `${i}-${v}`)) });
}
/**
* L'entête légal. Il porte les mentions de la section 5 du brief : raison
* sociale, forme juridique, activité, adresse, RCCM, NIU et centre des impôts.
* Un champ vide ne laisse pas une étiquette orpheline.
*/
function Entete(props) {
	const e = props.emetteur;
	return /* @__PURE__ */ u("header", {
		class: "a4-entete",
		children: [/* @__PURE__ */ u("div", { children: [/* @__PURE__ */ u("div", {
			class: "raison",
			children: e.nom
		}), /* @__PURE__ */ u("div", {
			class: "coordonnees",
			children: /* @__PURE__ */ u(Lignes, { valeurs: [
				e.activite,
				e.adresse,
				[e.tel && `Tél. ${e.tel}`, e.mail].filter(Boolean).join(" · ") || null
			] })
		})] }), /* @__PURE__ */ u("div", {
			class: "immat",
			children: /* @__PURE__ */ u(Lignes, { valeurs: [
				e.forme,
				e.rccm && `RCCM ${e.rccm}`,
				e.niu && `NIU ${e.niu}`,
				e.centre
			] })
		})]
	});
}
function TitreDocument(props) {
	return /* @__PURE__ */ u(S, { children: [/* @__PURE__ */ u("h1", {
		class: "a4-titre",
		children: props.titre
	}), /* @__PURE__ */ u("div", {
		class: "a4-sous-titre",
		children: props.sousTitre
	})] });
}
/**
* Le bloc destinataire. Le NIU du client y figure dès qu'on l'a : en B2B il est
* obligatoire, et sans lui le client ne peut pas déduire.
*/
function BlocClient(props) {
	return /* @__PURE__ */ u("section", {
		class: "a4-bloc-client",
		children: [
			/* @__PURE__ */ u("div", {
				class: "etiquette",
				children: "Client"
			}),
			/* @__PURE__ */ u("div", { children: /* @__PURE__ */ u("strong", { children: props.nom }) }),
			/* @__PURE__ */ u(Lignes, { valeurs: [props.niu && `NIU ${props.niu}`, props.complement] })
		]
	});
}
function ZonesSignature(props) {
	return /* @__PURE__ */ u("section", {
		class: "a4-signatures",
		children: props.zones.map((z) => /* @__PURE__ */ u("div", {
			class: "zone",
			children: [
				/* @__PURE__ */ u("div", {
					class: "libelle",
					children: z.libelle
				}),
				z.mention !== void 0 && /* @__PURE__ */ u("div", {
					class: "mention",
					children: z.mention
				}),
				/* @__PURE__ */ u("div", { class: "cadre" })
			]
		}, z.libelle))
	});
}
/** Le pied légal, obligatoire, plus d'éventuelles mentions propres au document. */
function PiedLegal(props) {
	return /* @__PURE__ */ u("footer", {
		class: "a4-pied",
		children: [/* @__PURE__ */ u("div", { children: piedLegal(props.emetteur) }), props.complement !== void 0 && /* @__PURE__ */ u("div", { children: props.complement })]
	});
}
function NumeroPage(props) {
	return /* @__PURE__ */ u("div", {
		class: "a4-numero-page",
		children: [
			props.page,
			"/",
			props.total
		]
	});
}
/** Un texte libre découpé en paragraphes sur les lignes vides. Jamais de HTML. */
function Paragraphes(props) {
	return /* @__PURE__ */ u(S, { children: props.texte.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b !== "").map((b, i) => /* @__PURE__ */ u("p", { children: b }, `${i}-${b.slice(0, 12)}`)) });
}
//#endregion
//#region ../render/src/doc/tableau.tsx
/**
* Le tableau des lignes, **avec la TVA colonne par colonne**.
*
* La section 5 du brief l'exige : « TVA 19,25 %, indiquée ligne par ligne, puis
* en bloc HT / TVA / TTC ». Le prototype n'affichait que le bloc. Un contrôleur
* doit pouvoir recalculer chaque ligne au stylo et retomber sur le total — d'où
* aussi la règle d'arrondi du moteur, qui arrondit à la ligne avant de sommer.
*/
/**
* Une ligne qui ne dit rien : ni désignation, ni montant.
*
* « Ajouter une ligne » en insère une vide, et c'est voulu — on la remplit
* ensuite. Reste qu'on peut être interrompu et diffuser sans y revenir : le
* client recevait alors un devis portant une rangée de cinq zéros sans
* désignation. La retirer ne change aucun total, une ligne à zéro n'apportant
* rien à la somme ; elle reste bien visible dans l'outil, où elle attend d'être
* remplie, et c'est le document qui ne l'imprime pas.
*
* Le montant compte autant que le nom : « Livraison offerte » à zéro franc dit
* quelque chose, et s'imprime.
*/
function neDitRien(ligne) {
	return ligne.designation.trim() === "" && ligne.montantTTC === 0;
}
function TableauLignes(props) {
	const lignes = props.totaux.lignes.filter((l) => !neDitRien(l));
	if (lignes.length === 0) return /* @__PURE__ */ u("div", {
		class: "a4-vide",
		children: "Aucune ligne pour l’instant."
	});
	return /* @__PURE__ */ u("table", {
		class: "a4-tableau",
		children: [/* @__PURE__ */ u("thead", { children: /* @__PURE__ */ u("tr", { children: [
			/* @__PURE__ */ u("th", { children: "Désignation" }),
			/* @__PURE__ */ u("th", {
				class: "nombre",
				children: "Qté"
			}),
			/* @__PURE__ */ u("th", {
				class: "nombre",
				children: "P.U. HT"
			}),
			/* @__PURE__ */ u("th", {
				class: "nombre",
				children: "Montant HT"
			}),
			/* @__PURE__ */ u("th", {
				class: "nombre",
				children: LIBELLE_TVA_CM
			}),
			/* @__PURE__ */ u("th", {
				class: "nombre",
				children: "Montant TTC"
			})
		] }) }), /* @__PURE__ */ u("tbody", { children: lignes.map((l, i) => /* @__PURE__ */ u("tr", { children: [
			/* @__PURE__ */ u("td", { children: l.designation }),
			/* @__PURE__ */ u("td", {
				class: "nombre",
				children: nf(l.quantite)
			}),
			/* @__PURE__ */ u("td", {
				class: "nombre",
				children: nf(l.prixUnitaire)
			}),
			/* @__PURE__ */ u("td", {
				class: "nombre",
				children: nf(l.montantHT)
			}),
			/* @__PURE__ */ u("td", {
				class: "nombre",
				children: nf(l.tva)
			}),
			/* @__PURE__ */ u("td", {
				class: "nombre",
				children: nf(l.montantTTC)
			})
		] }, `${i}-${l.designation}`)) })]
	});
}
/** Le bloc HT / TVA / TTC, plus ce que le document ajoute au-dessous. */
function BlocTotaux(props) {
	return /* @__PURE__ */ u("section", {
		class: "a4-totaux",
		children: props.lignes.map((l) => /* @__PURE__ */ u("div", {
			class: l.fort === true ? "ligne fort" : "ligne",
			children: [/* @__PURE__ */ u("span", { children: l.libelle }), /* @__PURE__ */ u("span", { children: montantF(l.montant) })]
		}, l.libelle))
	});
}
//#endregion
//#region ../render/src/doc/actes.tsx
/**
* Les quatre actes et lettres, sur A4.
*
* Rien n'est redessiné : tout se monte sur les pièces de `chrome.tsx`, déjà
* testées et déjà stylées par `a4.css`. Ce qui change d'un document à l'autre,
* c'est l'ordre des pièces et ce qu'on met dedans — pas le papier.
*
* Deux d'entre eux portent l'entête légal de l'entreprise, deux ne le portent
* pas. Ce n'est pas un oubli : un RCCM au-dessus d'une lettre de motivation
* serait une faute de registre, et un juge qui lit une reconnaissance de dette
* cherche deux personnes, pas une société.
*/
function DocumentAttestation(props) {
	const etat = props.etat;
	return /* @__PURE__ */ u(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u(Entete, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u(TitreDocument, {
				titre: etat.objet === "" ? "Attestation" : etat.objet,
				sousTitre: `N° ${etat.numero}`
			}),
			/* @__PURE__ */ u("section", {
				class: "a4-mentions a4-corps",
				children: etat.texte.trim() === "" ? /* @__PURE__ */ u("div", {
					class: "a4-vide",
					children: "Le corps de l’attestation reste à écrire."
				}) : /* @__PURE__ */ u(Paragraphes, { texte: etat.texte })
			}),
			/* @__PURE__ */ u(ZonesSignature, { zones: [{
				libelle: `${etat.emetteur.adresse === "" ? "Fait" : "Fait à " + villeDe(etat.emetteur.adresse)}, le ${dateLongue(dateEmission(etat))}`,
				mention: "Le responsable — cachet et signature"
			}] }),
			/* @__PURE__ */ u(PiedLegal, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u(NumeroPage, {
				page: 1,
				total: 1
			})
		]
	});
}
/**
* La ville, tirée de l'adresse.
*
* Approximatif et assumé : on prend le dernier mot, qui est la ville dans
* « Rue Bépanda-Omnisport, BP 4127 Douala ». Se tromper met un mot de travers
* sur une ligne de date ; demander une ville de plus dans le formulaire coûte
* un champ à tout le monde pour une ligne que personne ne relit.
*/
function villeDe(adresse) {
	const mots = adresse.trim().split(/[\s,]+/).filter((m) => m !== "");
	return mots[mots.length - 1] ?? "";
}
function DocumentRecu(props) {
	const etat = props.etat;
	const t = totauxRecu(etat);
	const lignes = etat.lignes.filter((l) => l.designation.trim() !== "" || l.montant !== 0);
	return /* @__PURE__ */ u(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u(Entete, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u(TitreDocument, {
				titre: "Reçu",
				sousTitre: `N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`
			}),
			/* @__PURE__ */ u("section", {
				class: "a4-bloc-client",
				children: [/* @__PURE__ */ u("div", {
					class: "etiquette",
					children: "Reçu de"
				}), /* @__PURE__ */ u("div", { children: /* @__PURE__ */ u("strong", { children: etat.recuDe }) })]
			}),
			lignes.length === 0 ? /* @__PURE__ */ u("div", {
				class: "a4-vide",
				children: "Aucune ligne pour l’instant."
			}) : /* @__PURE__ */ u("table", {
				class: "a4-tableau",
				children: [/* @__PURE__ */ u("thead", { children: /* @__PURE__ */ u("tr", { children: [/* @__PURE__ */ u("th", { children: "Désignation" }), /* @__PURE__ */ u("th", {
					class: "nombre",
					children: "Montant"
				})] }) }), /* @__PURE__ */ u("tbody", { children: lignes.map((l, i) => /* @__PURE__ */ u("tr", { children: [/* @__PURE__ */ u("td", { children: l.designation }), /* @__PURE__ */ u("td", {
					class: "nombre",
					children: nf(l.montant)
				})] }, `${i}-${l.designation}`)) })]
			}),
			/* @__PURE__ */ u(BlocTotaux, { lignes: [
				{
					libelle: "Total",
					montant: t.total
				},
				{
					libelle: "Somme reçue ce jour",
					montant: t.avance
				},
				{
					libelle: "Reste à payer",
					montant: t.reste,
					fort: true
				}
			] }),
			/* @__PURE__ */ u("div", {
				class: "a4-en-lettres",
				children: [
					"Somme reçue ce jour : ",
					montantEnLettres(t.avance),
					"."
				]
			}),
			/* @__PURE__ */ u(ZonesSignature, { zones: [{
				libelle: "Cachet et signature",
				mention: ""
			}] }),
			/* @__PURE__ */ u(PiedLegal, {
				emetteur: etat.emetteur,
				complement: "Reçu établi en francs CFA. Il atteste d’un paiement reçu, il ne remplace pas la facture."
			}),
			/* @__PURE__ */ u(NumeroPage, {
				page: 1,
				total: 1
			})
		]
	});
}
function DocumentDette(props) {
	const etat = props.etat;
	return /* @__PURE__ */ u(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u(TitreDocument, {
				titre: "Reconnaissance de dette",
				sousTitre: `Acte sous seing privé · ${dateLongue(dateEmission(etat))}`
			}),
			/* @__PURE__ */ u("section", {
				class: "a4-parties",
				children: [/* @__PURE__ */ u("div", { children: [
					/* @__PURE__ */ u("span", {
						class: "qui",
						children: "L’emprunteur"
					}),
					" ",
					etat.emprunteur.nom,
					etat.emprunteur.piece === "" ? "" : `, ${etat.emprunteur.piece}`
				] }), /* @__PURE__ */ u("div", { children: [
					/* @__PURE__ */ u("span", {
						class: "qui",
						children: "Le prêteur"
					}),
					" ",
					etat.preteur.nom,
					etat.preteur.piece === "" ? "" : `, ${etat.preteur.piece}`
				] })]
			}),
			/* @__PURE__ */ u("section", {
				class: "a4-mentions a4-corps",
				children: /* @__PURE__ */ u(Paragraphes, { texte: etat.texte })
			}),
			/* @__PURE__ */ u("section", {
				class: "a4-encadre",
				children: [
					/* @__PURE__ */ u("div", {
						class: "etiquette",
						children: "Montant du prêt"
					}),
					/* @__PURE__ */ u("div", {
						class: "chiffre",
						children: montantF(etat.montant)
					}),
					/* @__PURE__ */ u("div", {
						class: "lettres",
						children: [
							"Soit ",
							montantEnLettres(etat.montant),
							"."
						]
					}),
					etat.echeance === "" ? null : /* @__PURE__ */ u("div", {
						class: "echeance",
						children: ["Échéance de remboursement : ", /* @__PURE__ */ u("strong", { children: etat.echeance })]
					})
				]
			}),
			/* @__PURE__ */ u(ZonesSignature, { zones: [{
				libelle: "L’emprunteur",
				mention: "« Lu et approuvé », date et signature"
			}, {
				libelle: "Le prêteur",
				mention: "Date et signature"
			}] }),
			/* @__PURE__ */ u("footer", {
				class: "a4-pied",
				children: [/* @__PURE__ */ u("div", { children: [
					etat.lieu === "" ? "Fait" : `Fait à ${etat.lieu}`,
					" le",
					" ",
					dateLongue(dateEmission(etat)),
					", en deux exemplaires originaux, dont un remis à chaque partie."
				] }), /* @__PURE__ */ u("div", { children: "Acte sous seing privé. Pour un montant important, l’enregistrement auprès des impôts est conseillé." })]
			}),
			/* @__PURE__ */ u(NumeroPage, {
				page: 1,
				total: 1
			})
		]
	});
}
function DocumentMotivation(props) {
	const etat = props.etat;
	const e = etat.expediteur;
	return /* @__PURE__ */ u(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u("section", {
				class: "a4-lettre-tete",
				children: [/* @__PURE__ */ u("div", {
					class: "expediteur",
					children: [/* @__PURE__ */ u("strong", { children: e.nom }), [
						e.tel,
						e.mail,
						e.ville
					].filter((s) => s !== "").map((s) => /* @__PURE__ */ u("div", { children: s }, s))]
				}), /* @__PURE__ */ u("div", {
					class: "destinataire",
					children: etat.destinataire.split("\n").filter((l) => l.trim() !== "").map((l, i) => /* @__PURE__ */ u("div", { children: l }, `${i}-${l}`))
				})]
			}),
			/* @__PURE__ */ u("div", {
				class: "a4-lettre-date",
				children: [e.ville === "" ? "" : `${e.ville}, le `, dateLongue(dateEmission(etat))]
			}),
			/* @__PURE__ */ u("div", {
				class: "a4-lettre-objet",
				children: etat.objet
			}),
			/* @__PURE__ */ u("section", {
				class: "a4-mentions a4-corps",
				children: etat.corps.trim() === "" ? /* @__PURE__ */ u("div", {
					class: "a4-vide",
					children: "Le corps de la lettre reste à écrire."
				}) : /* @__PURE__ */ u(Paragraphes, { texte: etat.corps })
			}),
			/* @__PURE__ */ u("div", {
				class: "a4-lettre-signature",
				children: e.nom
			}),
			/* @__PURE__ */ u(NumeroPage, {
				page: 1,
				total: 1
			})
		]
	});
}
//#endregion
//#region ../render/src/doc/cv.tsx
/**
* Le CV sur A4, en quatre gabarits.
*
* Quatre mises en page pour un seul contenu : c'est le seul document de
* l'atelier où la forme est l'enjeu. Une facture se lit parce qu'il le faut ;
* un CV se lit parce qu'il donne envie, et un magasinier qui postule à la
* mairie n'envoie pas la même feuille qu'un graphiste qui postule en agence.
*
* Aucun n'emprunte à `chrome.tsx` autre chose que la feuille et le numéro de
* page : l'entête légal, le bloc client et les zones de signature n'ont rien à
* faire ici.
*
* Aucun ne réserve de place pour une photo. Le prototype dessinait un carré
* portant le mot « photo » : à l'écran c'est une intention, à l'impression
* c'est un carré vide marqué « photo » sur la feuille qu'on tend à un
* employeur. Tant que l'atelier ne sait pas stocker une image, il vaut mieux
* ne rien promettre.
*/
/** Les puces d'un poste. Une ligne vide ne laisse pas de puce orpheline. */
function Faits(props) {
	return /* @__PURE__ */ u(S, { children: props.points.filter((p) => p.trim() !== "").map((p, i) => /* @__PURE__ */ u("div", {
		class: "cv-fait",
		children: p
	}, `${i}-${p.slice(0, 12)}`)) });
}
/**
* La date d'une entrée : en marge dans le gabarit éditorial, sur la même ligne
* que l'employeur partout ailleurs.
*
* C'est la seule différence de structure entre les gabarits en dehors de la
* bande latérale du gabarit « bloc ». Mettre l'employeur en marge avec la date,
* comme on l'a d'abord fait, y produit un pavé ferré à droite sur trois lignes
* en face d'un titre d'une seule.
*/
function Marge(props) {
	if (!props.enMarge || props.quand.trim() === "") return null;
	return /* @__PURE__ */ u("div", {
		class: "cv-marge",
		children: props.quand
	});
}
function ligneOu(qui, quand, enMarge, separateur) {
	return [qui, enMarge ? "" : quand].filter((s) => s.trim() !== "").join(` ${separateur} `);
}
function Diplomes(props) {
	return /* @__PURE__ */ u(S, { children: props.diplomes.map((d, i) => /* @__PURE__ */ u("div", {
		class: "cv-item",
		children: [
			/* @__PURE__ */ u(Marge, {
				quand: d.annee,
				enMarge: props.enMarge
			}),
			/* @__PURE__ */ u("div", {
				class: "cv-quoi",
				children: d.intitule
			}),
			/* @__PURE__ */ u("div", {
				class: "cv-ou",
				children: ligneOu(d.etablissement, d.annee, props.enMarge, props.separateur)
			})
		]
	}, `${i}-${d.intitule}`)) });
}
function Postes(props) {
	return /* @__PURE__ */ u(S, { children: props.postes.map((p, i) => /* @__PURE__ */ u("div", {
		class: "cv-item",
		children: [
			/* @__PURE__ */ u(Marge, {
				quand: p.periode,
				enMarge: props.enMarge
			}),
			/* @__PURE__ */ u("div", {
				class: "cv-quoi",
				children: p.intitule
			}),
			/* @__PURE__ */ u("div", {
				class: "cv-ou",
				children: ligneOu(p.employeur, p.periode, props.enMarge, props.separateur)
			}),
			/* @__PURE__ */ u(Faits, { points: p.points })
		]
	}, `${i}-${p.intitule}`)) });
}
/** Le titre d'une section. Rien ne s'affiche si la section est vide. */
function Section(props) {
	if (props.vide) return null;
	return /* @__PURE__ */ u(S, { children: [/* @__PURE__ */ u("h4", {
		class: "cv-section",
		children: props.titre
	}), props.children] });
}
/** Le profil, écrit en paragraphes comme partout ailleurs dans l'atelier. */
function Profil(props) {
	if (props.texte.trim() === "") return null;
	return /* @__PURE__ */ u(S, { children: [/* @__PURE__ */ u("h4", {
		class: "cv-section",
		children: props.titre
	}), /* @__PURE__ */ u("div", {
		class: "cv-profil",
		children: /* @__PURE__ */ u(Paragraphes, { texte: props.texte })
	})] });
}
function Contact(props) {
	return /* @__PURE__ */ u("div", {
		class: "cv-contact",
		children: [
			props.id.tel,
			props.id.mail,
			props.id.ville
		].filter((s) => s.trim() !== "").join(" · ")
	});
}
function motsDe(langue) {
	return INTITULES[langue];
}
function DocumentCv(props) {
	const etat = props.etat;
	const t = motsDe(etat.langue);
	const id = etat.identite;
	const classes = `a4-cv ${etat.gabarit}${etat.dense ? " dense" : ""}`;
	const enMarge = etat.gabarit === "editorial";
	const separateur = etat.gabarit === "notaire" ? "—" : "·";
	const experience = /* @__PURE__ */ u(Section, {
		titre: t.experience,
		vide: etat.postes.length === 0,
		children: /* @__PURE__ */ u(Postes, {
			postes: etat.postes,
			enMarge,
			separateur
		})
	});
	const formation = /* @__PURE__ */ u(Section, {
		titre: t.formation,
		vide: etat.diplomes.length === 0,
		children: /* @__PURE__ */ u(Diplomes, {
			diplomes: etat.diplomes,
			enMarge,
			separateur
		})
	});
	if (etat.gabarit === "bloc") return /* @__PURE__ */ u(PageA4, {
		encre: etat.encre,
		children: [/* @__PURE__ */ u("div", {
			class: classes,
			children: [/* @__PURE__ */ u("aside", {
				class: "cv-bande",
				children: [
					/* @__PURE__ */ u("div", {
						class: "cv-nom",
						children: id.nom
					}),
					/* @__PURE__ */ u("div", {
						class: "cv-titre",
						children: id.titre
					}),
					/* @__PURE__ */ u(Section, {
						titre: t.contact,
						vide: false,
						children: /* @__PURE__ */ u(S, { children: [
							id.tel,
							id.mail,
							id.ville
						].filter((s) => s.trim() !== "").map((s) => /* @__PURE__ */ u("div", {
							class: "cv-ligne",
							children: s
						}, s)) })
					}),
					/* @__PURE__ */ u(Section, {
						titre: t.competences,
						vide: etat.competences.length === 0,
						children: /* @__PURE__ */ u(S, { children: etat.competences.map((c) => /* @__PURE__ */ u("div", {
							class: "cv-ligne",
							children: c
						}, c)) })
					}),
					/* @__PURE__ */ u(Section, {
						titre: t.langues,
						vide: etat.langues.length === 0,
						children: /* @__PURE__ */ u(S, { children: etat.langues.map((l) => /* @__PURE__ */ u("div", {
							class: "cv-ligne",
							children: l
						}, l)) })
					})
				]
			}), /* @__PURE__ */ u("div", {
				class: "cv-principal",
				children: [
					/* @__PURE__ */ u(Profil, {
						texte: etat.resume,
						titre: t.profil
					}),
					experience,
					formation
				]
			})]
		}), /* @__PURE__ */ u(NumeroPage, {
			page: 1,
			total: 1
		})]
	});
	return /* @__PURE__ */ u(PageA4, {
		encre: etat.encre,
		children: [/* @__PURE__ */ u("div", {
			class: classes,
			children: [
				/* @__PURE__ */ u("header", {
					class: "cv-tete",
					children: [
						/* @__PURE__ */ u("div", {
							class: "cv-nom",
							children: id.nom
						}),
						/* @__PURE__ */ u("div", {
							class: "cv-titre",
							children: id.titre
						}),
						/* @__PURE__ */ u(Contact, { id })
					]
				}),
				/* @__PURE__ */ u(Profil, {
					texte: etat.resume,
					titre: t.profil
				}),
				experience,
				formation,
				/* @__PURE__ */ u(Section, {
					titre: t.competences,
					vide: etat.competences.length === 0,
					children: /* @__PURE__ */ u("div", {
						class: "cv-serie",
						children: etat.competences.join(" · ")
					})
				}),
				/* @__PURE__ */ u(Section, {
					titre: t.langues,
					vide: etat.langues.length === 0,
					children: /* @__PURE__ */ u("div", {
						class: "cv-serie",
						children: etat.langues.join(" · ")
					})
				})
			]
		}), /* @__PURE__ */ u(NumeroPage, {
			page: 1,
			total: 1
		})]
	});
}
//#endregion
//#region ../render/src/doc/devis.tsx
/**
* Le devis, sur A4.
*
* Il propose : il porte une validité et un acompte demandé à la commande. Ce
* qui engage fiscalement, c'est la facture — voir `facture.tsx`, qui partage
* tout l'appareillage légal avec celui-ci.
*/
function DocumentDevis(props) {
	const etat = props.etat;
	const c = chiffrer(etat);
	const totaux = [
		{
			libelle: "Sous-total HT",
			montant: c.totalHT
		},
		{
			libelle: LIBELLE_TVA_CM,
			montant: c.totalTVA
		},
		{
			libelle: "Total TTC",
			montant: c.totalTTC,
			fort: true
		}
	];
	if (etat.acompte > 0) {
		totaux.push({
			libelle: `Acompte à la commande (${etat.acompte} %)`,
			montant: c.acompteDu
		});
		totaux.push({
			libelle: "Solde à la livraison",
			montant: c.soldeDu
		});
	}
	return /* @__PURE__ */ u(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u(Entete, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u(TitreDocument, {
				titre: "Devis",
				sousTitre: `N° ${etat.numero} · émis le ${dateLongue(dateEmission(etat))}`
			}),
			/* @__PURE__ */ u(BlocClient, {
				nom: etat.client.nom,
				niu: etat.client.niu,
				complement: etat.objet === void 0 ? null : `Objet : ${etat.objet}`
			}),
			/* @__PURE__ */ u(TableauLignes, { totaux: c }),
			/* @__PURE__ */ u(BlocTotaux, { lignes: totaux }),
			/* @__PURE__ */ u("div", {
				class: "a4-en-lettres",
				children: [
					"Soit ",
					montantEnLettres(c.totalTTC),
					", toutes taxes comprises."
				]
			}),
			/* @__PURE__ */ u("section", {
				class: "a4-mentions",
				children: [/* @__PURE__ */ u("p", { children: [
					"Validité de la présente offre : ",
					etat.validite,
					" à compter de la date d’émission."
				] }), etat.acompte > 0 && /* @__PURE__ */ u("p", { children: [
					"Acompte de ",
					etat.acompte,
					" % à la commande, solde à la livraison."
				] })]
			}),
			/* @__PURE__ */ u(ZonesSignature, { zones: [{
				libelle: "Le fournisseur",
				mention: "Cachet et signature"
			}, {
				libelle: "Bon pour accord — le client",
				mention: "Date, signature et cachet"
			}] }),
			/* @__PURE__ */ u(PiedLegal, {
				emetteur: etat.emetteur,
				complement: "Devis établi en francs CFA. Numérotation unique, continue et chronologique."
			}),
			/* @__PURE__ */ u(NumeroPage, {
				page: 1,
				total: 1
			})
		]
	});
}
//#endregion
//#region ../render/src/doc/facture.tsx
/**
* La facture, sur A4.
*
* C'est le document que la DGI contrôle : entête complet, NIU de l'émetteur et
* du client, TVA ligne par ligne puis en bloc, numérotation continue, pied
* légal. Une facture envoyée par WhatsApp est valable si le PDF est complet
* (BRIEF.md § 5) — d'où l'exigence que tout ce qui compte s'imprime ici.
*
* La date de rendu est passée en argument et non lue à l'horloge : le même
* document doit sortir pareil sur le téléphone qui l'édite et sur le serveur
* qui le rend.
*/
function DocumentFacture(props) {
	const etat = props.etat;
	const c = chiffrerFacture(etat);
	const retard = joursDeRetard(etat, props.maintenant);
	const echeance = dateLongue(dateEcheance(etat));
	const complementClient = [etat.objet === void 0 ? null : `Objet : ${etat.objet}`, etat.devisNumero === void 0 ? null : `En référence au devis N° ${etat.devisNumero}`].filter((x) => x !== null).join(" — ") || null;
	const totaux = [
		{
			libelle: "Sous-total HT",
			montant: c.totalHT
		},
		{
			libelle: LIBELLE_TVA_CM,
			montant: c.totalTVA
		},
		{
			libelle: "Total TTC",
			montant: c.totalTTC,
			fort: true
		}
	];
	if (c.verse > 0) {
		totaux.push({
			libelle: "Déjà réglé",
			montant: c.verse
		});
		totaux.push({
			libelle: "Reste à payer",
			montant: c.reste
		});
	}
	if (c.tropPercu > 0) totaux.push({
		libelle: "Trop-perçu à restituer",
		montant: c.tropPercu
	});
	return /* @__PURE__ */ u(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u(Entete, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u(TitreDocument, {
				titre: "Facture",
				sousTitre: `N° ${etat.numero} · émise le ${dateLongue(dateEmission(etat))} · échéance le ${echeance}`
			}),
			/* @__PURE__ */ u(BlocClient, {
				nom: etat.client.nom,
				niu: etat.client.niu,
				complement: complementClient
			}),
			/* @__PURE__ */ u(TableauLignes, { totaux: c }),
			/* @__PURE__ */ u(BlocTotaux, { lignes: totaux }),
			/* @__PURE__ */ u("div", {
				class: "a4-en-lettres",
				children: [
					"Arrêtée la présente facture à la somme de ",
					montantEnLettres(c.totalTTC),
					", toutes taxes comprises."
				]
			}),
			/* @__PURE__ */ u("section", {
				class: "a4-mentions",
				children: [
					c.estSoldee ? /* @__PURE__ */ u("p", { children: "Facture soldée. Reçu vaut quittance." }) : /* @__PURE__ */ u("p", { children: [
						"Montant à régler : ",
						montantF(c.reste),
						", au plus tard le ",
						echeance,
						".",
						retard > 0 && ` Échéance dépassée de ${retard} jour${retard > 1 ? "s" : ""}.`
					] }),
					etat.conditionsReglement !== "" && /* @__PURE__ */ u("p", { children: etat.conditionsReglement }),
					etat.reglements.length > 0 && /* @__PURE__ */ u("p", { children: [
						"Règlements reçus :",
						" ",
						etat.reglements.map((r) => {
							const quand = dateLongueSiValide(r.date);
							const ref = r.reference === void 0 || r.reference === "" ? "" : `, réf. ${r.reference}`;
							return `${montantF(r.montant)}${quand === null ? "" : ` le ${quand}`} (${LIBELLE_MOYEN[r.moyen]}${ref})`;
						}).join(" · "),
						"."
					] })
				]
			}),
			/* @__PURE__ */ u(ZonesSignature, { zones: [{
				libelle: "Cachet et signature",
				mention: "Pour l’entreprise"
			}] }),
			/* @__PURE__ */ u(PiedLegal, {
				emetteur: etat.emetteur,
				complement: "Facture établie en francs CFA. Numérotation unique, continue et chronologique."
			}),
			/* @__PURE__ */ u(NumeroPage, {
				page: 1,
				total: 1
			})
		]
	});
}
//#endregion
//#region src/rendu.tsx
/**
* Ce qu'on dessine derrière un lien, selon ce qui a été publié.
*
* Deux formes, et le squelette dit laquelle. Les sept documents A4 sont déjà
* des pages en lecture seule : on rend le document lui-même, celui que le
* client aurait reçu imprimé. C'est tout l'intérêt du lien — ouvrir un devis
* plutôt que recevoir une image qu'on ne peut ni chercher ni copier.
*
* Les registres, eux, sont des écrans avec des boutons. On ne les rejoue pas :
* on rend leur **carte**, que chaque squelette sait déjà produire et qui est
* déjà éprouvée. Elle dit l'essentiel — un titre, un grand chiffre, une liste —
* et ne prétend pas être l'outil.
*/
var DOCUMENTS = {
	devis: DocumentDevis,
	facture: DocumentFacture,
	attestation: DocumentAttestation,
	recu: DocumentRecu,
	dette: DocumentDette,
	motivation: DocumentMotivation,
	cv: DocumentCv
};
/** La facture a besoin de l'instant pour dire son retard ; les autres non. */
function estFacture(skeleton) {
	return skeleton === "facture";
}
function documentDe(instantane, ctx) {
	const Composant = Object.hasOwn(DOCUMENTS, instantane.skeleton) ? DOCUMENTS[instantane.skeleton] : void 0;
	if (Composant === void 0) return null;
	const etat = instantane.etat;
	return estFacture(instantane.skeleton) ? /* @__PURE__ */ u(DocumentFacture, {
		etat,
		maintenant: ctx.maintenant
	}) : /* @__PURE__ */ u(Composant, { etat });
}
//#endregion
//#region src/pdf.tsx
/**
* La page telle qu'elle part à l'imprimante, et rien d'autre.
*
* Ce n'est pas la page de lecture. Celle-là met la feuille à l'échelle de
* l'écran, l'entoure d'un pied et d'une marque, et dit « document en lecture
* seule » — trois choses qui n'ont rien à faire sur un papier qu'on remet à un
* client. Ici, la feuille A4 à sa taille vraie, seule.
*
* Le rendu se fait **une fois, sur le serveur**. C'est ce qui répond au critère
* du § 7 — « un même devis produit un PDF identique sur Windows, macOS et
* Android » : le fichier porte les glyphes, et la machine qui l'ouvre n'a plus
* rien à décider.
*
* La police est **nommée** et non devinée. À l'écran, `system-ui` est le bon
* choix : c'est la police que le téléphone a déjà, elle ne se télécharge pas et
* elle se lit comme le reste de l'appareil. Sur le serveur, `system-ui` est ce
* que l'image du jour contient — aujourd'hui DejaVu Sans, demain autre chose,
* et tous les devis changeraient d'allure sans que personne ait rien demandé.
* On nomme donc la chaîne, en s'arrêtant sur des polices de mêmes métriques.
*/
var CSS = sansCommentaires(a4_default);
/**
* `@page` dit à l'imprimante la taille de la feuille.
*
* Sans lui, le moteur choisit le format par défaut de sa locale — A4 ici,
* Letter ailleurs — et une feuille dessinée en 210 × 297 mm se retrouve
* recadrée. La marge est à zéro parce que la feuille porte déjà les siennes :
* en ajouter une deuxième les additionnerait.
*/
var IMPRESSION = `
@page { size: 210mm 297mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.a4 { font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; }
`;
/** Ce qui apparaît dans la boîte « enregistrer sous ». */
function nomFichier(instantane) {
	const etat = instantane.etat;
	const numero = typeof etat?.numero === "string" ? etat.numero : "";
	const propre = (numero !== "" ? `${instantane.skeleton}-${numero}` : instantane.skeleton).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/\.{2,}/g, ".").replace(/^[-.]+|[-.]+$/g, "");
	return `${propre === "" ? "document" : propre}.pdf`;
}
/**
* Rend `null` pour ce qui ne s'imprime pas.
*
* Les registres n'ont pas de feuille : leur lien mène à une carte, qui est un
* résumé d'écran. Un PDF d'un résumé serait un papier qui ne sert à rien —
* ni preuve, ni pièce comptable, ni chose qu'on classe.
*/
function pageAImprimer(instantane, ctx) {
	const document = documentDe(instantane, ctx);
	if (document === null) return null;
	return {
		html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}${IMPRESSION}</style></head><body>${K(document)}</body></html>`,
		nomFichier: nomFichier(instantane)
	};
}
//#endregion
//#region src/worker-pdf.ts
function texte(statut, message) {
	return new Response(message, {
		status: statut,
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
async function onRequest(contexte) {
	const brut = contexte.params.lien;
	const lien = Array.isArray(brut) ? brut[0] ?? "" : brut ?? "";
	if (!lienValide(lien)) return texte(404, "Ce lien ne mène à rien.");
	const instantane = await contexte.env.INSTANTANES.get(lien, "json");
	if (instantane === null) return texte(404, "Ce lien ne mène à rien.");
	const page = pageAImprimer(instantane, {
		lien: `${new URL(contexte.request.url).host}/d/${lien}`,
		maintenant: /* @__PURE__ */ new Date()
	});
	if (page === null) return texte(415, "Cet outil n’a pas de version imprimable : ouvre son lien pour le voir.");
	const navigateur = contexte.env.NAVIGATEUR;
	if (navigateur === void 0) return texte(503, "L’impression n’est pas encore ouverte.");
	let rendu;
	try {
		rendu = await navigateur.quickAction("pdf", {
			html: page.html,
			pdfOptions: {
				printBackground: true,
				preferCSSPageSize: true
			}
		});
	} catch (cause) {
		console.error("pdf_echoue", cause);
		return texte(502, "L’impression n’a pas abouti. Réessaie dans un instant.");
	}
	const corps = rendu instanceof Response ? await rendu.arrayBuffer() : rendu;
	const debut = new Uint8Array(corps.slice(0, 5));
	if (String.fromCharCode(...debut) !== "%PDF-") {
		console.error(JSON.stringify({
			evenement: "pdf_pas_un_pdf",
			octets: corps.byteLength,
			debut: new TextDecoder().decode(corps.slice(0, 200))
		}));
		return texte(503, "L’impression est occupée. Réessaie dans quelques secondes.");
	}
	return new Response(corps, { headers: {
		"content-type": "application/pdf",
		"content-disposition": `inline; filename="${page.nomFichier}"`,
		"cache-control": "public, max-age=60",
		"x-content-type-options": "nosniff"
	} });
}
//#endregion
export { onRequest };
