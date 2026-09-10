/** Découpe la liste au plafond et compte ce qui déborde. */
function limiterItems(items, max = 10) {
	return {
		visibles: items.slice(0, max),
		reste: Math.max(0, items.length - max)
	};
}
/** `+ 3 autres` — la ligne de pied de liste. */
function texteReste(reste) {
	if (reste <= 0) return null;
	return `+ ${reste} autre${reste > 1 ? "s" : ""}`;
}
//#endregion
//#region ../legal-cm/src/identifiants.ts
/**
* Identifiants fiscaux et commerciaux camerounais.
*
* On ne valide que **la forme**, jamais la clef de contrôle.
*
* À VÉRIFIER: l'algorithme de la lettre de contrôle du NIU, et la liste des
* codes de ville et des lettres de catégorie du RCCM, n'ont pas de source
* publique que j'aie pu vérifier. Les formes ci-dessous sont relevées sur les
* exemplaires du prototype. Tant que la source manque, un identifiant mal formé
* est signalé mais **jamais refusé** : mieux vaut un avertissement à l'écran
* qu'un commerçant bloqué par une expression régulière trop stricte.
*/
/** NIU : une lettre, douze chiffres, une lettre. Ex. `M022114873829Y`. */
var FORME_NIU = /^[A-Z]\d{12}[A-Z]$/;
/** RCCM OHADA. Ex. `RC/DLA/2022/A/1487`. */
var FORME_RCCM = /^RC\/[A-Z]{2,5}\/\d{4}\/[A-Z]\/\d{1,7}$/;
/** Met un identifiant sous sa forme canonique : majuscules, sans espaces. */
function normaliserIdentifiant(s) {
	return s.trim().toUpperCase().replace(/\s+/g, "");
}
function estNiuBienForme(niu) {
	return FORME_NIU.test(normaliserIdentifiant(niu));
}
function estRccmBienForme(rccm) {
	return FORME_RCCM.test(normaliserIdentifiant(rccm));
}
//#endregion
//#region ../legal-cm/src/mentions.ts
function vide(s) {
	return s === null || s === void 0 || s.trim() === "";
}
/**
* Ce qui manque au document pour être présentable à un contrôle.
*
* `bloquant` : le document ne devrait pas être émis en l'état.
* `avertissement` : la mention est là mais mal formée — on le signale sans
* bloquer, la forme exacte des identifiants n'étant pas vérifiée à la source.
*/
function mentionsManquantes(emetteur, client) {
	const m = [];
	if (vide(emetteur.niu)) m.push({
		champ: "emetteur.niu",
		libelle: "NIU de l’entreprise",
		gravite: "bloquant"
	});
	else if (!estNiuBienForme(emetteur.niu)) m.push({
		champ: "emetteur.niu",
		libelle: "NIU de l’entreprise mal formé",
		gravite: "avertissement"
	});
	if (vide(emetteur.rccm)) m.push({
		champ: "emetteur.rccm",
		libelle: "numéro RCCM",
		gravite: "bloquant"
	});
	else if (!estRccmBienForme(emetteur.rccm)) m.push({
		champ: "emetteur.rccm",
		libelle: "numéro RCCM mal formé",
		gravite: "avertissement"
	});
	for (const [champ, libelle] of [
		["nom", "raison sociale"],
		["forme", "forme juridique"],
		["adresse", "adresse"],
		["centre", "centre des impôts"]
	]) if (vide(emetteur[champ])) m.push({
		champ: `emetteur.${champ}`,
		libelle,
		gravite: "bloquant"
	});
	if (client !== void 0) {
		if (vide(client.nom)) m.push({
			champ: "client.nom",
			libelle: "nom du client",
			gravite: "bloquant"
		});
		if (client.estEntreprise) {
			if (vide(client.niu)) m.push({
				champ: "client.niu",
				libelle: "NIU du client (obligatoire en B2B)",
				gravite: "bloquant"
			});
			else if (!estNiuBienForme(client.niu)) m.push({
				champ: "client.niu",
				libelle: "NIU du client mal formé",
				gravite: "avertissement"
			});
		}
	}
	return m;
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
//#region ../legal-cm/src/numerotation.ts
var FORME_NUMERO = /^([A-Z]{2,4})-(\d{4})-(\d{4,})$/;
/** @throws RangeError si le numéro n'est pas représentable. */
function formatNumero(n) {
	if (!/^[A-Z]{2,4}$/.test(n.prefixe)) throw new RangeError(`préfixe invalide : « ${n.prefixe} »`);
	if (!Number.isInteger(n.annee) || n.annee < 2e3 || n.annee > 2999) throw new RangeError(`année invalide : ${n.annee}`);
	if (!Number.isInteger(n.sequence) || n.sequence < 1) throw new RangeError(`séquence invalide : ${n.sequence}`);
	return `${n.prefixe}-${n.annee}-${String(n.sequence).padStart(4, "0")}`;
}
/** `null` si la chaîne n'est pas un numéro de la maison. */
function parseNumero(s) {
	const m = FORME_NUMERO.exec(s.trim().toUpperCase());
	if (m === null) return null;
	const [, prefixe, annee, sequence] = m;
	if (prefixe === void 0 || annee === void 0 || sequence === void 0) return null;
	const seq = Number(sequence);
	if (seq < 1) return null;
	return {
		prefixe,
		annee: Number(annee),
		sequence: seq
	};
}
/**
* Le numéro qui suit. La séquence repart à 1 dès que l'année civile change —
* c'est ce qui rend la numérotation chronologique et lisible à l'œil.
*/
function numeroSuivant(precedent, annee, prefixe) {
	if (precedent === null || precedent.annee !== annee || precedent.prefixe !== prefixe) return {
		prefixe,
		annee,
		sequence: 1
	};
	return {
		prefixe,
		annee,
		sequence: precedent.sequence + 1
	};
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
/** Ce qui manque au document pour être présentable à un contrôle. */
function controleLegal(doc) {
	return mentionsManquantes(doc.emetteur, doc.client);
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
function pad2(n) {
	return n < 10 ? `0${n}` : String(n);
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
/** `heureCourte()` → `08h45`. */
function heureCourte(d) {
	const p = partsWAT(d);
	return `${pad2(p.heures)}h${pad2(p.minutes)}`;
}
/**
* Le jour civil de Douala, `2026-09-09`.
*
* Sert de clef de regroupement, pas d'affichage : deux opérations du même
* après-midi doivent tomber dans le même seau, et un `toISOString()` les
* séparerait dès que l'heure locale passe minuit UTC — c'est-à-dire à 1 h du
* matin à Douala.
*/
function jourWAT(d) {
	const p = partsWAT(d);
	return `${p.annee}-${pad2(p.mois + 1)}-${pad2(p.jour)}`;
}
/** L'horodatage imprimé en pied de carte : `Arrêté le 9 septembre 2026 à 08h45`. */
function arreteLe(d) {
	return `Arrêté le ${dateLongue(d)} à ${heureCourte(d)}`;
}
/**
* Lit une date écrite à l'heure de Douala.
*
* `new Date('2026-09-12T15:00')` lit l'heure **de la machine**, et un Worker
* vit en UTC : un mariage annoncé à 15 h se serait affiché à 16 h sur la page
* publiée, et à 15 h dans l'aperçu du téléphone de qui l'a écrite. Personne
* n'aurait su lequel des deux croire.
*
* Ce qui est écrit sans fuseau est donc lu à Douala, parce que c'est là qu'on
* écrit et là qu'on lit. Un fuseau explicite — `Z` ou `+02:00` — est respecté :
* qui l'écrit sait ce qu'il fait.
*
* Rend `null` sur ce qui n'est pas une date, y compris un 31 février, que
* `Date.UTC` replierait silencieusement sur le 3 mars.
*/
function instantWAT(iso) {
	const brut = iso.trim();
	if (brut === "") return null;
	if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(brut)) {
		const avecFuseau = new Date(brut);
		return Number.isNaN(avecFuseau.getTime()) ? null : avecFuseau;
	}
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(brut);
	if (m === null) return null;
	const [, a = "", mo = "", j = "", h = "0", mi = "0", se = "0"] = m;
	const annee = Number(a);
	const mois = Number(mo) - 1;
	const jour = Number(j);
	const t = Date.UTC(annee, mois, jour, Number(h), Number(mi), Number(se)) - DECALAGE_WAT_MS;
	const d = new Date(t);
	if (Number.isNaN(t)) return null;
	const relu = partsWAT(d);
	return relu.annee === annee && relu.mois === mois && relu.jour === jour ? d : null;
}
/**
* Le jour de la semaine à Douala, 0 pour dimanche.
*
* Une affiche annonce « samedi 12 septembre » et non « le 12 septembre » : le
* jour de la semaine est ce qui permet de savoir tout de suite si on est
* disponible, avant même de compter.
*/
function jourDeLaSemaineWAT(d) {
	const t = d.getTime();
	if (!Number.isFinite(t)) throw new RangeError("date invalide");
	return new Date(t + DECALAGE_WAT_MS).getUTCDay();
}
/** L'année civile, dans le fuseau de Douala — celle qui numérote les documents. */
function anneeDe(d) {
	return partsWAT(d).annee;
}
/**
* Forme de comparaison : minuscules, sans accent, sans ponctuation.
* Sert à l'étage 1 du moteur (correspondance de mots-clés, zéro jeton).
*/
function normaliser(s) {
	return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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
//#region ../engine/src/schema/commun.ts
/**
* Les morceaux de schéma partagés par les documents d'affaires.
*
* Devis et facture décrivent la même entreprise, le même client et les mêmes
* lignes ; ils ne diffèrent que par ce qui les engage. Sortir ces trois blocs
* évite qu'ils divergent — et le jour où une mention obligatoire change, elle
* change à un seul endroit.
*
* **Le schéma dit la forme, `@a237/legal-cm` dit l'obligation.** Les champs
* d'identité sont *présents* mais peuvent être vides : un document qu'on vient
* d'ouvrir n'a encore rien dedans et doit rester valide. C'est
* `mentionsManquantes` qui décide s'il est émettable, et lui seul.
*/
var encreSchema = {
	type: "string",
	enum: [
		"encre",
		"bordeaux",
		"foret",
		"ardoise"
	],
	title: "Encre",
	description: "Couleur d’accent du document."
};
var emetteurSchema = {
	type: "object",
	title: "Ton entreprise",
	additionalProperties: false,
	required: [
		"nom",
		"forme",
		"activite",
		"adresse",
		"tel",
		"mail",
		"rccm",
		"niu",
		"centre"
	],
	properties: {
		nom: {
			type: "string",
			maxLength: 80,
			title: "Raison sociale",
			description: "Raison sociale complète."
		},
		forme: {
			type: "string",
			maxLength: 80,
			title: "Forme juridique",
			description: "Ex. « Ets — Établissement individuel »."
		},
		activite: {
			type: "string",
			maxLength: 120,
			title: "Activité"
		},
		adresse: {
			type: "string",
			maxLength: 160,
			title: "Adresse"
		},
		tel: {
			type: "string",
			maxLength: 30,
			title: "Téléphone"
		},
		mail: {
			type: "string",
			maxLength: 80,
			title: "Adresse e-mail"
		},
		rccm: {
			type: "string",
			maxLength: 40,
			title: "Numéro RCCM"
		},
		niu: {
			type: "string",
			maxLength: 20,
			title: "NIU",
			description: "La mention la plus contrôlée par la DGI."
		},
		centre: {
			type: "string",
			maxLength: 60,
			title: "Centre des impôts"
		}
	}
};
var clientSchema = {
	type: "object",
	title: "Le client",
	additionalProperties: false,
	required: [
		"nom",
		"niu",
		"estEntreprise"
	],
	properties: {
		nom: {
			type: "string",
			maxLength: 80,
			title: "Nom du client"
		},
		niu: {
			type: "string",
			maxLength: 20,
			title: "NIU du client",
			description: "Obligatoire quand le client est une entreprise."
		},
		estEntreprise: {
			type: "boolean",
			title: "Le client est une entreprise"
		},
		tel: {
			type: "string",
			maxLength: 20,
			title: "Téléphone du client"
		}
	}
};
var lignesSchema = {
	type: "array",
	title: "Lignes du document",
	maxItems: 100,
	items: {
		type: "object",
		additionalProperties: false,
		required: [
			"designation",
			"quantite",
			"prixUnitaire"
		],
		properties: {
			designation: {
				type: "string",
				maxLength: 120,
				title: "Désignation"
			},
			quantite: {
				type: "number",
				minimum: 0,
				maximum: 1e6,
				title: "Quantité"
			},
			prixUnitaire: {
				type: "integer",
				minimum: 0,
				maximum: 1e9,
				title: "Prix unitaire (F CFA)"
			}
		}
	},
	description: "Les lignes du document. La TVA se calcule sur chacune."
};
/**
* Le contrat de la facture.
*
* Elle reprend l'entête, le client et les lignes du devis, et s'en écarte sur
* ce qui l'engage : elle ne se périme pas, elle s'échoit ; elle n'annonce pas
* un acompte à venir, elle enregistre les règlements reçus.
*
* `devisNumero` garde le lien avec le devis dont elle découle, quand il y en a
* un : c'est ce qui permet à un client de rapprocher les deux documents.
*/
var factureSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"numero",
		"emisLe",
		"echeance",
		"emetteur",
		"client",
		"conditionsReglement",
		"lignes",
		"reglements"
	],
	properties: {
		nom: {
			type: "string",
			minLength: 1,
			maxLength: 60,
			title: "Nom de l’outil"
		},
		numero: {
			type: "string",
			minLength: 1,
			maxLength: 24,
			title: "Numéro",
			description: "Ex. FA-2026-0001. Unique, continu et chronologique."
		},
		emisLe: {
			type: "string",
			minLength: 10,
			maxLength: 32,
			title: "Date d’émission"
		},
		echeance: {
			type: "string",
			minLength: 10,
			maxLength: 32,
			title: "Échéance",
			description: "Date limite de règlement. Par défaut, payable à réception."
		},
		emetteur: emetteurSchema,
		client: clientSchema,
		objet: {
			type: "string",
			maxLength: 120,
			title: "Objet"
		},
		devisNumero: {
			type: "string",
			maxLength: 24,
			title: "Devis d’origine"
		},
		conditionsReglement: {
			type: "string",
			maxLength: 200,
			title: "Conditions de règlement",
			description: "Ex. « Règlement par MTN Mobile Money ou Orange Money »."
		},
		lignes: lignesSchema,
		encre: encreSchema,
		reglements: {
			type: "array",
			maxItems: 100,
			title: "Règlements reçus",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"date",
					"montant",
					"moyen"
				],
				properties: {
					date: {
						type: "string",
						maxLength: 32,
						title: "Date du versement"
					},
					montant: {
						type: "integer",
						minimum: 0,
						maximum: 1e9,
						title: "Montant (F CFA)"
					},
					moyen: {
						type: "string",
						enum: [...[
							"momo",
							"orange-money",
							"especes",
							"virement"
						]],
						title: "Moyen"
					},
					reference: {
						type: "string",
						maxLength: 60,
						title: "Référence de la transaction"
					}
				}
			}
		}
	}
};
//#endregion
//#region ../engine/src/compute/facture.ts
var LIBELLE_STATUT = {
	soldee: "Soldée",
	"en-retard": "En retard",
	partielle: "Partiellement réglée",
	"a-payer": "À payer"
};
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
/** Le statut, à une date donnée. La date est passée, jamais lue à l'horloge. */
function statutFacture(etat, maintenant) {
	const c = chiffrerFacture(etat);
	if (c.estSoldee) return "soldee";
	if (joursDeRetard(etat, maintenant) > 0) return "en-retard";
	return c.verse > 0 ? "partielle" : "a-payer";
}
/** Jours civils de retard à Douala. Zéro tant que l'échéance n'est pas passée. */
function joursDeRetard(etat, maintenant) {
	return Math.max(0, joursEntre(dateEcheance(etat), maintenant));
}
//#endregion
//#region ../engine/src/compute/numerotation.ts
/**
* Numérotation d'une série de documents.
*
* La section 5 du brief l'exige « unique, continue et chronologique » — c'est
* une des mentions que la DGI contrôle. Le compteur ne vit pas dans un état
* global : l'app passe les numéros déjà émis pour ce compte, et le moteur en
* déduit le suivant. C'est ce qui permet de numéroter hors ligne.
*/
/**
* Le prochain numéro d'une série, pour l'année civile en cours à Douala.
*
* Les numéros illisibles, d'une autre série ou d'une autre année sont ignorés.
* Un trou dans la suite **n'est pas rebouché** : on repart du plus grand numéro
* émis, plus un. Réattribuer un numéro sauté casserait l'unicité si le document
* manquant refait surface, et la chronologie dans tous les cas.
*/
function prochainNumero(prefixe, emisPrecedemment, maintenant) {
	const annee = anneeDe(maintenant);
	return formatNumero(numeroSuivant(emisPrecedemment.map(parseNumero).filter((n) => n !== null && n.prefixe === prefixe && n.annee === annee).reduce((max, n) => max === null || n.sequence > max.sequence ? n : max, null), annee, prefixe));
}
/**
* Le préfixe de série de chaque squelette qui numérote.
*
* Quatre documents portent un numéro ; les autres n'en ont pas besoin. La table
* est ici et non dans chaque squelette parce que l'atelier doit savoir, **sans
* charger un squelette**, si l'outil qu'on ouvre a une série à tenir — et
* charger un squelette pour lire deux lettres coûterait un fragment.
*/
var PREFIXES_NUMERO = {
	devis: "DV",
	facture: "FA",
	attestation: "AT",
	recu: "RE"
};
//#endregion
//#region ../engine/src/compute/njangi.ts
/** Où en est la cagnotte du tour en cours. */
function collecte(etat) {
	const nbMembres = etat.membres.length;
	const verses = etat.membres.filter((m) => m.aVerse);
	const attendu = nbMembres * etat.cotisation;
	const encaisse = verses.length * etat.cotisation;
	return {
		attendu,
		collecte: encaisse,
		reste: attendu - encaisse,
		nbVerse: verses.length,
		nbMembres,
		taux: attendu === 0 ? 0 : encaisse / attendu,
		retardataires: etat.membres.filter((m) => !m.aVerse)
	};
}
/**
* Fiabilité d'un membre : la part des tours où il a versé.
*
* `null` pour un membre qui n'a encore vécu aucun tour — on ne lui invente pas
* une réputation, ni bonne ni mauvaise.
*/
function fiabilite(m) {
	if (m.tours <= 0) return null;
	return m.versements / m.tours;
}
/**
* Au-dessus de ce taux, un membre est présenté comme fiable.
*
* C'est une convention d'affichage reprise du prototype, pas une règle de
* njangi : aucun trésorier ne calcule 80 %. Elle sert à trier une liste et à
* colorer un badge, jamais à exclure quelqu'un.
*/
var SEUIL_FIABILITE = .8;
/** `null` pour un membre sans historique — on ne le juge pas sur rien. */
function estFiable(m) {
	const f = fiabilite(m);
	return f === null ? null : f >= SEUIL_FIABILITE;
}
/** Les membres du moins fiable au plus fiable. Les nouveaux ferment la marche. */
function classementFiabilite(etat) {
	return [...etat.membres].sort((a, b) => {
		const fa = fiabilite(a);
		const fb = fiabilite(b);
		if (fa === null && fb === null) return 0;
		if (fa === null) return 1;
		if (fb === null) return -1;
		return fa - fb;
	});
}
/** Le membre qui reçoit la cagnotte ce tour-ci. */
function beneficiaireDuTour(etat) {
	return etat.membres.find((m) => m.estAuTour) ?? null;
}
/**
* Clôture le tour en cours et ouvre le suivant.
*
* Le prototype se contentait de déplacer le drapeau du tour
* (`reference/atelier-prototype.html:921-923`) : il n'archivait pas la collecte,
* ne remettait pas les versements à zéro — tout le monde restait donc marqué
* « a versé » à la période suivante — et ne mettait pas à jour la fiabilité.
* Le moteur fait les quatre.
*
* Le bénéficiaire suivant est le premier membre de la liste, après le sortant,
* qui n'a pas encore reçu. Quand tout le monde a reçu, le cycle se referme :
* les compteurs `aRecu` repartent à zéro et le tour revient au premier membre.
*
* @throws RangeError sur un njangi sans membre — il n'y a rien à faire tourner.
*/
function prochainTour(etat) {
	const n = etat.membres.length;
	if (n === 0) throw new RangeError("njangi sans membre : aucun tour à clôturer");
	const idxSortant = etat.membres.findIndex((m) => m.estAuTour);
	const encaisse = collecte(etat).collecte;
	let membres = etat.membres.map((m, i) => ({
		...m,
		versements: m.versements + (m.aVerse ? 1 : 0),
		tours: m.tours + 1,
		aVerse: false,
		estAuTour: false,
		aRecu: m.aRecu || i === idxSortant
	}));
	let idxEntrant = -1;
	for (let pas = 1; pas <= n; pas += 1) {
		const i = (idxSortant + pas + n) % n;
		if (membres[i]?.aRecu === false) {
			idxEntrant = i;
			break;
		}
	}
	if (idxEntrant === -1) {
		membres = membres.map((m) => ({
			...m,
			aRecu: false
		}));
		idxEntrant = 0;
	}
	membres = membres.map((m, i) => i === idxEntrant ? {
		...m,
		estAuTour: true
	} : m);
	return {
		...etat,
		tour: etat.tour + 1,
		historique: [...etat.historique, {
			tour: etat.tour,
			collecte: encaisse
		}],
		membres
	};
}
function remplacerMembre(etat, index, transforme) {
	if (etat.membres[index] === void 0) throw new RangeError(`aucun membre à l'index ${index}`);
	return {
		...etat,
		membres: etat.membres.map((m, i) => i === index ? transforme(m) : m)
	};
}
/** Marque ou démarque le versement d'un membre pour le tour en cours. */
function basculerVersement(etat, index) {
	return remplacerMembre(etat, index, (m) => ({
		...m,
		aVerse: !m.aVerse
	}));
}
/**
* Ajoute un membre au njangi.
*
* Il entre sans historique : `versements` et `tours` à zéro, donc une fiabilité
* indéterminée jusqu'au premier tour vécu. Il n'a pas encore reçu, ce qui le
* place naturellement dans la rotation.
*
* **Le premier membre prend le tour.** Un njangi qui a des membres a forcément
* quelqu'un qui reçoit : sans ça l'écran affichait « Tour : — » et la carte
* partagée aussi, ce qui ne veut rien dire pour un trésorier.
*
* @throws RangeError sur un nom vide — un carnet de njangi sans nom ne sert à rien.
*/
function ajouterMembre(etat, nom, tel) {
	const propre = nom.trim();
	if (propre === "") throw new RangeError("nom de membre vide");
	const personneAuTour = etat.membres.every((m) => !m.estAuTour);
	const membre = {
		nom: propre,
		...tel !== void 0 && tel.trim() !== "" ? { tel: tel.trim() } : {},
		aVerse: false,
		aRecu: false,
		estAuTour: personneAuTour,
		versements: 0,
		tours: 0
	};
	return {
		...etat,
		membres: [...etat.membres, membre]
	};
}
/**
* Retire un membre.
*
* Si c'était lui qui devait recevoir ce tour-ci, le drapeau passe au suivant
* qui n'a pas encore reçu — sinon le njangi se retrouverait sans bénéficiaire
* et `prochainTour` repartirait du début, ce qui ferait passer quelqu'un deux
* fois dans le même cycle.
*/
function retirerMembre(etat, index) {
	const partant = etat.membres[index];
	if (partant === void 0) throw new RangeError(`aucun membre à l'index ${index}`);
	const restants = etat.membres.filter((_, i) => i !== index);
	if (!partant.estAuTour || restants.length === 0) return {
		...etat,
		membres: restants
	};
	const repreneur = restants.findIndex((m) => !m.aRecu);
	const cible = repreneur === -1 ? 0 : repreneur;
	return {
		...etat,
		membres: restants.map((m, i) => i === cible ? {
			...m,
			estAuTour: true
		} : m)
	};
}
/**
* Change la cotisation.
* @throws RangeError sur un montant négatif ou fractionnaire — le XAF n'a pas
*   de subdivision, et une cotisation négative n'a pas de sens.
*/
function changerCotisation(etat, montant) {
	if (!Number.isSafeInteger(montant) || montant < 0) throw new RangeError(`cotisation invalide : ${montant}`);
	return {
		...etat,
		cotisation: montant
	};
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
/** Ce qui manque à un document d'entreprise sans destinataire identifié. */
function controleEmetteur(doc) {
	return mentionsManquantes(doc.emetteur);
}
/**
* Ce qui manque à une reconnaissance de dette pour être opposable.
*
* Ce n'est pas `mentionsManquantes` : il n'y a pas d'entreprise ici, donc ni
* NIU ni RCCM. Ce qu'un juge cherche, c'est l'identité des deux parties, un
* montant, une échéance et un lieu. Sans la pièce d'identité, la partie n'est
* pas identifiée ; sans échéance, la créance n'est pas exigible.
*/
function controleDette(etat) {
	const manque = [];
	const vide = (s) => s.trim() === "";
	if (vide(etat.emprunteur.nom)) manque.push({
		champ: "$.emprunteur.nom",
		libelle: "nom de l’emprunteur"
	});
	if (vide(etat.emprunteur.piece)) manque.push({
		champ: "$.emprunteur.piece",
		libelle: "pièce d’identité de l’emprunteur"
	});
	if (vide(etat.preteur.nom)) manque.push({
		champ: "$.preteur.nom",
		libelle: "nom du prêteur"
	});
	if (vide(etat.preteur.piece)) manque.push({
		champ: "$.preteur.piece",
		libelle: "pièce d’identité du prêteur"
	});
	if (etat.montant <= 0) manque.push({
		champ: "$.montant",
		libelle: "montant du prêt"
	});
	if (vide(etat.echeance)) manque.push({
		champ: "$.echeance",
		libelle: "échéance de remboursement"
	});
	if (vide(etat.lieu)) manque.push({
		champ: "$.lieu",
		libelle: "lieu de signature"
	});
	return manque;
}
//#endregion
//#region ../engine/src/schema/actes.ts
/**
* Les contrats des actes et des lettres.
*
* Même règle que pour les documents d'affaires : **le schéma dit la forme,
* `@a237/legal-cm` dit l'obligation**. Un acte qu'on vient d'ouvrir est vide et
* doit rester valide ; c'est le contrôle légal, à l'écran, qui décide s'il est
* présentable.
*/
var nomOutil = {
	type: "string",
	minLength: 1,
	maxLength: 60,
	title: "Nom de l’outil"
};
var emisLe = {
	type: "string",
	minLength: 10,
	maxLength: 32,
	title: "Date d’émission",
	description: "Date ISO 8601, figée à la création."
};
var attestationSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"numero",
		"emisLe",
		"emetteur",
		"objet",
		"texte"
	],
	properties: {
		nom: nomOutil,
		numero: {
			type: "string",
			minLength: 1,
			maxLength: 24,
			title: "Numéro",
			description: "Ex. AT-2026-0014. Utile pour retrouver l’attestation dans tes archives."
		},
		emisLe,
		emetteur: emetteurSchema,
		objet: {
			type: "string",
			maxLength: 80,
			title: "Objet",
			description: "Ce que l’attestation certifie. Ex. « Attestation de travail »."
		},
		texte: {
			type: "string",
			maxLength: 2e3,
			title: "Corps de l’attestation",
			description: "Le texte certifié. Une ligne vide sépare deux paragraphes."
		},
		encre: encreSchema
	}
};
var recuSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"numero",
		"emisLe",
		"emetteur",
		"recuDe",
		"lignes",
		"avance"
	],
	properties: {
		nom: nomOutil,
		numero: {
			type: "string",
			minLength: 1,
			maxLength: 24,
			title: "Numéro",
			description: "Ex. RE-2026-0412. Unique et continu, comme pour une facture."
		},
		emisLe,
		emetteur: emetteurSchema,
		recuDe: {
			type: "string",
			maxLength: 80,
			title: "Reçu de",
			description: "Qui a payé."
		},
		lignes: {
			type: "array",
			maxItems: 40,
			title: "Ce qui est réglé",
			description: "Sans TVA : la taxe a été traitée sur la facture, la répéter ferait croire à une seconde opération.",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["designation", "montant"],
				properties: {
					designation: {
						type: "string",
						maxLength: 120,
						title: "Désignation"
					},
					montant: {
						type: "integer",
						minimum: 0,
						maximum: 1e9,
						title: "Montant (F CFA)"
					}
				}
			}
		},
		avance: {
			type: "integer",
			minimum: 0,
			maximum: 1e9,
			title: "Somme reçue ce jour (F CFA)",
			description: "Ce que tu as effectivement encaissé. Le reste à payer s’en déduit."
		},
		encre: encreSchema
	}
};
var partieSchema = (qui) => ({
	type: "object",
	additionalProperties: false,
	required: ["nom", "piece"],
	title: qui,
	properties: {
		nom: {
			type: "string",
			maxLength: 80,
			title: `Nom — ${qui.toLowerCase()}`
		},
		piece: {
			type: "string",
			maxLength: 60,
			title: `Pièce d’identité — ${qui.toLowerCase()}`,
			description: "Ex. « CNI n° 118 442 907 ». Sans elle, la partie n’est pas identifiée."
		}
	}
});
var detteSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"emisLe",
		"emprunteur",
		"preteur",
		"montant",
		"echeance",
		"lieu",
		"texte"
	],
	properties: {
		nom: nomOutil,
		emisLe,
		emprunteur: partieSchema("L’emprunteur"),
		preteur: partieSchema("Le prêteur"),
		montant: {
			type: "integer",
			minimum: 0,
			maximum: 1e9,
			title: "Montant du prêt (F CFA)",
			description: "Il s’écrira aussi en toutes lettres : un chiffre seul se rallonge d’un trait de stylo."
		},
		echeance: {
			type: "string",
			maxLength: 60,
			title: "Échéance de remboursement",
			description: "Ex. « 31 décembre 2026 ». Sans échéance, la créance n’est pas exigible."
		},
		lieu: {
			type: "string",
			maxLength: 60,
			title: "Lieu de signature"
		},
		texte: {
			type: "string",
			maxLength: 2e3,
			title: "Engagement",
			description: "Ce que l’emprunteur reconnaît et s’engage à faire."
		},
		encre: encreSchema
	}
};
var motivationSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"emisLe",
		"expediteur",
		"destinataire",
		"objet",
		"corps"
	],
	properties: {
		nom: nomOutil,
		emisLe,
		expediteur: {
			type: "object",
			additionalProperties: false,
			required: [
				"nom",
				"tel",
				"mail",
				"ville"
			],
			title: "Toi",
			properties: {
				nom: {
					type: "string",
					maxLength: 80,
					title: "Nom"
				},
				tel: {
					type: "string",
					maxLength: 30,
					title: "Téléphone"
				},
				mail: {
					type: "string",
					maxLength: 80,
					title: "Adresse e-mail"
				},
				ville: {
					type: "string",
					maxLength: 60,
					title: "Ville"
				}
			}
		},
		destinataire: {
			type: "string",
			maxLength: 300,
			title: "Destinataire",
			description: "Le service et l’adresse, tels qu’ils s’écrivent. Une ligne par élément."
		},
		objet: {
			type: "string",
			maxLength: 120,
			title: "Objet",
			description: "Ex. « Objet : candidature au poste de magasinier »."
		},
		corps: {
			type: "string",
			maxLength: 3e3,
			title: "Corps de la lettre",
			description: "Une ligne vide sépare deux paragraphes. Garde la formule de politesse finale."
		},
		encre: encreSchema
	}
};
//#endregion
//#region ../engine/src/skeletons/actes.ts
/**
* Les quatre actes et lettres.
*
* Aucun ne porte de TVA ni de tableau taxé : ce qui les rassemble, c'est d'être
* des documents A4 qui ne sont pas des documents d'affaires. Ils partagent le
* papier, pas la fiscalité.
*
* Chacun part **vide**. Le prototype porte les données de Serge Mbarga et de la
* Quincaillerie Bépanda ; quelqu'un qui ouvre une attestation ne doit pas
* trouver le nom d'un inconnu dedans. Ce qui reste comme valeur de départ est ce
* qui est vrai pour tout le monde : un format de numéro, une encre, le squelette
* d'un engagement.
*/
var EMETTEUR_VIDE = {
	nom: "",
	forme: "",
	activite: "",
	adresse: "",
	tel: "",
	mail: "",
	rccm: "",
	niu: "",
	centre: ""
};
var LE_1ER_JANVIER = "2026-01-01T00:00:00.000Z";
var PREFIXE_ATTESTATION = PREFIXES_NUMERO.attestation;
var attestationDefaults = {
	nom: "Attestation",
	encre: "encre",
	numero: "AT-2026-0001",
	emisLe: LE_1ER_JANVIER,
	emetteur: EMETTEUR_VIDE,
	objet: "Attestation de travail",
	texte: ""
};
function attestationCard(etat, ctx) {
	return {
		kicker: "ATTESTATION",
		title: etat.objet === "" ? etat.nom : etat.objet,
		sub: etat.emetteur.nom === "" ? `N° ${etat.numero}` : `${etat.emetteur.nom} · N° ${etat.numero}`,
		tag: null,
		bigLabel: "DÉLIVRÉE LE",
		big: dateLongue(dateEmission(etat)),
		pct: null,
		subline: piedLegal(etat.emetteur),
		listTitle: "",
		items: [],
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function partageActe(titre, desc, nomFichier, texte, carte, manquants) {
	return {
		title: titre,
		desc,
		name: nomFichier,
		txt: texte.filter((l) => l !== null && l !== "").join("\n"),
		broad: null,
		warn: manquants.length === 0 ? null : `Ce document n’est pas complet : il manque ${manquants.join(", ")}.`,
		card: carte,
		relances: [],
		relancesVides: "Un document se remet en main propre ou s’envoie à une personne."
	};
}
function attestationShare(etat, ctx) {
	const bloquants = controleEmetteur(etat).filter((m) => m.gravite === "bloquant");
	return partageActe(etat.objet === "" ? "Attestation" : etat.objet, `${etat.emetteur.nom} · N° ${etat.numero}`, `attestation-${etat.numero.toLowerCase()}`, [
		(etat.objet === "" ? "ATTESTATION" : etat.objet.toUpperCase()) + ` N° ${etat.numero}`,
		etat.emetteur.nom,
		`Délivrée le ${dateLongue(dateEmission(etat))}`,
		ctx.lien
	], attestationCard(etat, ctx), bloquants.map((m) => m.libelle));
}
var attestation = {
	id: "attestation",
	group: "documents",
	title: "Attestation",
	keywords: [
		"attestation",
		"certificat",
		"preuve emploi",
		"travail",
		"attestation de travail",
		"certifier",
		"temoignage ecrit"
	],
	engine: "doc",
	schema: attestationSchema,
	defaults: attestationDefaults,
	initialiser: (ctx) => ({
		...attestationDefaults,
		numero: prochainNumero(PREFIXE_ATTESTATION, [], ctx.maintenant),
		emisLe: ctx.maintenant.toISOString()
	}),
	compute: {
		controleEmetteur,
		dateEmission,
		prochainNumero,
		piedLegal
	},
	card: attestationCard,
	share: attestationShare
};
var PREFIXE_RECU = PREFIXES_NUMERO.recu;
var recuDefaults = {
	nom: "Reçu",
	encre: "foret",
	numero: "RE-2026-0001",
	emisLe: LE_1ER_JANVIER,
	emetteur: EMETTEUR_VIDE,
	recuDe: "",
	lignes: [],
	avance: 0
};
function recuCard(etat, ctx) {
	const t = totauxRecu(etat);
	return {
		kicker: "REÇU",
		title: etat.recuDe === "" ? etat.nom : etat.recuDe,
		sub: `N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`,
		tag: null,
		bigLabel: "SOMME REÇUE",
		big: montantF(t.avance),
		pct: t.total === 0 ? null : Math.min(1, t.avance / t.total),
		subline: t.reste === 0 ? "Soldé." : `Total ${montantF(t.total)} · reste ${montantF(t.reste)}`,
		listTitle: "DÉTAIL",
		items: etat.lignes.map((l) => ({
			n: l.designation,
			ok: true,
			warn: false,
			val: montantF(l.montant)
		})),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function recuShare(etat, ctx) {
	const t = totauxRecu(etat);
	const bloquants = controleEmetteur(etat).filter((m) => m.gravite === "bloquant");
	return partageActe(`Reçu ${etat.numero}`, `${etat.recuDe} · ${montantF(t.avance)} reçus`, `recu-${etat.numero.toLowerCase()}`, [
		`REÇU N° ${etat.numero}`,
		etat.emetteur.nom,
		etat.recuDe === "" ? null : `Reçu de : ${etat.recuDe}`,
		`Somme reçue : ${montantF(t.avance)}`,
		t.reste === 0 ? "Soldé." : `Reste à payer : ${montantF(t.reste)}`,
		ctx.lien
	], recuCard(etat, ctx), bloquants.map((m) => m.libelle));
}
var recu = {
	id: "recu",
	group: "documents",
	title: "Reçu",
	keywords: [
		"recu",
		"quittance",
		"acompte",
		"j ai recu",
		"preuve de paiement",
		"versement recu"
	],
	engine: "doc",
	schema: recuSchema,
	defaults: recuDefaults,
	initialiser: (ctx) => ({
		...recuDefaults,
		numero: prochainNumero(PREFIXE_RECU, [], ctx.maintenant),
		emisLe: ctx.maintenant.toISOString()
	}),
	compute: {
		totauxRecu,
		controleEmetteur,
		dateEmission,
		prochainNumero,
		piedLegal
	},
	card: recuCard,
	share: recuShare
};
var detteDefaults = {
	nom: "Reconnaissance de dette",
	encre: "bordeaux",
	emisLe: LE_1ER_JANVIER,
	emprunteur: {
		nom: "",
		piece: ""
	},
	preteur: {
		nom: "",
		piece: ""
	},
	montant: 0,
	echeance: "",
	lieu: "",
	texte: "Je soussigné, emprunteur désigné ci-dessus, reconnais avoir reçu du prêteur, à titre de prêt sans intérêt, la somme portée au présent acte.\n\nJe m’engage à rembourser cette somme au plus tard à la date d’échéance indiquée, en un ou plusieurs versements, au domicile du prêteur ou par mobile money."
};
function detteCard(etat, ctx) {
	return {
		kicker: "RECONNAISSANCE DE DETTE",
		title: etat.emprunteur.nom === "" ? etat.nom : etat.emprunteur.nom,
		sub: etat.preteur.nom === "" ? "Acte sous seing privé" : `envers ${etat.preteur.nom}`,
		tag: null,
		bigLabel: "MONTANT DU PRÊT",
		big: montantF(etat.montant),
		pct: null,
		subline: etat.montant <= 0 ? "Montant à renseigner" : `Soit ${montantEnLettres(etat.montant)}. Échéance : ${etat.echeance || "à fixer"}`,
		listTitle: "",
		items: [],
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function detteShare(etat, ctx) {
	const manque = controleDette(etat);
	return partageActe("Reconnaissance de dette", `${montantF(etat.montant)} · échéance ${etat.echeance || "à fixer"}`, "reconnaissance-de-dette", [
		"RECONNAISSANCE DE DETTE",
		etat.emprunteur.nom === "" ? null : `Emprunteur : ${etat.emprunteur.nom}`,
		etat.preteur.nom === "" ? null : `Prêteur : ${etat.preteur.nom}`,
		`Montant : ${montantF(etat.montant)}`,
		etat.montant <= 0 ? null : `Soit ${montantEnLettres(etat.montant)}.`,
		etat.echeance === "" ? null : `Échéance : ${etat.echeance}`,
		ctx.lien
	], detteCard(etat, ctx), manque.map((m) => m.libelle));
}
var dette = {
	id: "dette",
	group: "documents",
	title: "Reconnaissance de dette",
	keywords: [
		"reconnaissance",
		"reconnaissance de dette",
		"dette ecrite",
		"pret",
		"emprunt",
		"j ai prete",
		"papier de dette",
		"engagement ecrit"
	],
	engine: "doc",
	schema: detteSchema,
	defaults: detteDefaults,
	initialiser: (ctx) => ({
		...detteDefaults,
		emisLe: ctx.maintenant.toISOString()
	}),
	compute: {
		controleDette,
		dateEmission,
		montantEnLettres
	},
	card: detteCard,
	share: detteShare
};
var motivationDefaults = {
	nom: "Lettre de motivation",
	encre: "encre",
	emisLe: LE_1ER_JANVIER,
	expediteur: {
		nom: "",
		tel: "",
		mail: "",
		ville: ""
	},
	destinataire: "",
	objet: "Objet : candidature au poste de",
	corps: ""
};
function motivationCard(etat, ctx) {
	return {
		kicker: "LETTRE DE MOTIVATION",
		title: etat.expediteur.nom === "" ? etat.nom : etat.expediteur.nom,
		sub: etat.objet,
		tag: null,
		bigLabel: "ÉCRITE LE",
		big: dateLongue(dateEmission(etat)),
		pct: null,
		subline: [etat.expediteur.ville, etat.expediteur.tel].filter((s) => s !== "").join(" · "),
		listTitle: "",
		items: [],
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function motivationShare(etat, ctx) {
	const manque = [];
	if (etat.expediteur.nom.trim() === "") manque.push("ton nom");
	if (etat.destinataire.trim() === "") manque.push("le destinataire");
	if (etat.corps.trim() === "") manque.push("le corps de la lettre");
	return partageActe("Lettre de motivation", etat.objet, "lettre-de-motivation", [
		etat.objet,
		etat.expediteur.nom,
		[etat.expediteur.tel, etat.expediteur.mail].filter((s) => s !== "").join(" · "),
		ctx.lien
	], motivationCard(etat, ctx), manque);
}
var motivation = {
	id: "motivation",
	group: "documents",
	title: "Lettre de motivation",
	keywords: [
		"lettre",
		"motivation",
		"lettre de motivation",
		"demande d emploi",
		"candidature",
		"postuler",
		"demande de stage"
	],
	engine: "doc",
	schema: motivationSchema,
	defaults: motivationDefaults,
	initialiser: (ctx) => ({
		...motivationDefaults,
		emisLe: ctx.maintenant.toISOString()
	}),
	compute: { dateEmission },
	card: motivationCard,
	share: motivationShare
};
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
/**
* Ce qui manque à un CV pour être envoyable.
*
* Rien ici n'est une obligation légale : un CV ne passe aucun contrôle. Ce sont
* les quatre choses sans lesquelles un recruteur ne peut rien faire de la
* feuille — savoir qui écrit, pour quel poste, comment rappeler, et sur quoi
* juger.
*/
function controleCv(etat) {
	const manques = [];
	const id = etat.identite;
	if (id.nom.trim() === "") manques.push({
		champ: "$.identite.nom",
		libelle: "ton nom"
	});
	if (id.titre.trim() === "") manques.push({
		champ: "$.identite.titre",
		libelle: "le poste que tu vises"
	});
	if (id.tel.trim() === "" && id.mail.trim() === "") manques.push({
		champ: "$.identite.tel",
		libelle: "un téléphone ou une adresse mail"
	});
	if (etat.postes.length === 0 && etat.diplomes.length === 0) manques.push({
		champ: "$.postes",
		libelle: "au moins une expérience ou un diplôme"
	});
	return manques;
}
/**
* Le CV tient-il sur une page ?
*
* Un compte de signes, pas une mesure : le rendu vrai dépend de la police et du
* gabarit, et le moteur ne voit pas le navigateur. Le seuil sert à proposer le
* mode compact avant que la seconde page n'arrive, pas à garantir quoi que ce
* soit.
*/
var SIGNES_PAR_PAGE = 2600;
function signesCv(etat) {
	return [
		etat.resume,
		...etat.competences,
		...etat.langues,
		...etat.postes.flatMap((p) => [
			p.intitule,
			p.employeur,
			p.periode,
			...p.points
		]),
		...etat.diplomes.flatMap((d) => [
			d.intitule,
			d.etablissement,
			d.annee
		])
	].reduce((total, l) => total + l.length, 0);
}
function debordeUnePage(etat) {
	return signesCv(etat) > (etat.dense ? SIGNES_PAR_PAGE * 1.35 : SIGNES_PAR_PAGE);
}
//#endregion
//#region ../engine/src/schema/cv.ts
/**
* Le contrat du CV.
*
* Aucune mention n'y est obligatoire au sens légal — un CV ne se contrôle pas.
* Les bornes sont donc là pour tenir la page, pas pour tenir la loi : un titre
* de poste sur trois lignes ou vingt compétences ne débordent pas, ils rendent
* la feuille illisible, ce qui revient au même pour celui qui la reçoit.
*/
var texteCourt = (titre, max, description) => ({
	type: "string",
	maxLength: max,
	title: titre,
	...description === void 0 ? {} : { description }
});
var cvSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"gabarit",
		"langue",
		"dense",
		"identite",
		"resume",
		"postes",
		"diplomes",
		"competences",
		"langues"
	],
	properties: {
		nom: {
			type: "string",
			minLength: 1,
			maxLength: 60,
			title: "Nom de l’outil"
		},
		gabarit: {
			type: "string",
			enum: [
				"notaire",
				"executif",
				"editorial",
				"bloc"
			],
			title: "Gabarit",
			description: "Notaire pour l’administration, Exécutif pour le privé, Éditorial pour un métier créatif, Bloc pour une bande latérale."
		},
		langue: {
			type: "string",
			enum: ["fr", "en"],
			title: "Langue des intitulés",
			description: "Change « Expérience professionnelle » en « Experience ». Le texte que tu écris n’est pas traduit."
		},
		dense: {
			type: "boolean",
			title: "Mode compact",
			description: "Resserre l’interligne pour faire tenir une carrière longue sur une seule page."
		},
		identite: {
			type: "object",
			additionalProperties: false,
			required: [
				"nom",
				"titre",
				"tel",
				"mail",
				"ville"
			],
			title: "Toi",
			properties: {
				nom: texteCourt("Nom et prénom", 60),
				titre: texteCourt("Poste visé", 80, "Ex. « Magasinier — gestion de stock ». C’est la première chose qu’on lit."),
				tel: texteCourt("Téléphone", 32),
				mail: texteCourt("Adresse mail", 80),
				ville: texteCourt("Ville", 60, "Ex. « Douala, Cameroun ».")
			}
		},
		resume: texteCourt("Profil", 600, "Trois ou quatre lignes : ce que tu sais faire, depuis combien de temps."),
		postes: {
			type: "array",
			maxItems: 8,
			title: "Expérience professionnelle",
			description: "Du plus récent au plus ancien.",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"intitule",
					"employeur",
					"periode",
					"points"
				],
				properties: {
					intitule: {
						type: "string",
						maxLength: 80,
						title: "Poste occupé"
					},
					employeur: texteCourt("Employeur", 80),
					periode: texteCourt("Période", 40, "Ex. « 2022 – 2026 »."),
					points: {
						type: "array",
						maxItems: 6,
						title: "Ce que tu y as fait",
						description: "Un fait par ligne, chiffré quand c’est possible. « Écarts d’inventaire ramenés de 12 % à 3 % » se retient ; « rigoureux et motivé » ne se retient pas.",
						items: {
							type: "string",
							maxLength: 160,
							title: "Fait"
						}
					}
				}
			}
		},
		diplomes: {
			type: "array",
			maxItems: 8,
			title: "Formation",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"intitule",
					"etablissement",
					"annee"
				],
				properties: {
					intitule: {
						type: "string",
						maxLength: 100,
						title: "Diplôme"
					},
					etablissement: texteCourt("Établissement", 80),
					annee: texteCourt("Année", 16)
				}
			}
		},
		competences: {
			type: "array",
			maxItems: 12,
			title: "Compétences",
			description: "Des choses vérifiables : un logiciel, une machine, une méthode.",
			items: {
				type: "string",
				maxLength: 60,
				title: "Compétence"
			}
		},
		langues: {
			type: "array",
			maxItems: 6,
			title: "Langues",
			description: "Ex. « Duala — maternelle », « Anglais — professionnel ».",
			items: {
				type: "string",
				maxLength: 60,
				title: "Langue"
			}
		},
		encre: encreSchema
	}
};
//#endregion
//#region ../engine/src/skeletons/cv.ts
/**
* Le curriculum vitæ.
*
* Il part vide, comme les actes. Le prototype portait le CV de Serge Mbarga,
* magasinier ; le recopier donnerait à chacun la carrière d'un inconnu à
* effacer avant d'écrire la sienne. Ce qui reste comme valeur de départ est un
* choix de mise en page, rien d'autre.
*
* Il n'a ni numéro, ni date d'émission, ni entête d'entreprise : personne ne
* l'archive et personne ne le contrôle. Il ne porte donc pas `emisLe`, là où
* tous les autres documents A4 en ont un.
*/
/** Un intitulé de section. La table est close : la clef manquante ne peut pas exister. */
function intitule(langue, clef) {
	return INTITULES[langue][clef] ?? clef;
}
var cvDefaults = {
	nom: "Curriculum vitæ",
	encre: "encre",
	gabarit: "notaire",
	langue: "fr",
	dense: false,
	identite: {
		nom: "",
		titre: "",
		tel: "",
		mail: "",
		ville: ""
	},
	resume: "",
	postes: [],
	diplomes: [],
	competences: [],
	langues: []
};
function cvCard(etat, ctx) {
	const id = etat.identite;
	return {
		kicker: "CV",
		title: id.nom === "" ? "Curriculum vitæ" : id.nom,
		sub: id.titre,
		tag: null,
		bigLabel: intitule(etat.langue, "experience").toUpperCase(),
		big: etat.postes.length === 0 ? "—" : String(etat.postes.length),
		pct: null,
		subline: [id.ville, id.tel].filter((s) => s !== "").join(" · "),
		listTitle: intitule(etat.langue, "competences"),
		items: etat.competences.slice(0, 6).map((c) => ({
			n: c,
			ok: true,
			warn: false,
			val: null
		})),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function cvShare(etat, ctx) {
	const id = etat.identite;
	const manque = controleCv(etat);
	const lignes = [
		id.nom === "" ? "CURRICULUM VITÆ" : id.nom.toUpperCase(),
		id.titre === "" ? null : id.titre,
		[
			id.tel,
			id.mail,
			id.ville
		].filter((s) => s !== "").join(" · ") || null,
		etat.postes.length === 0 ? null : `${etat.postes.length} poste${etat.postes.length > 1 ? "s" : ""}`,
		ctx.lien
	];
	return {
		title: id.nom === "" ? "Curriculum vitæ" : `CV — ${id.nom}`,
		desc: id.titre,
		name: `cv-${normaliser(id.nom) === "" ? "sans-nom" : normaliser(id.nom).replace(/ /g, "-")}`,
		txt: lignes.filter((l) => l !== null && l !== "").join("\n"),
		broad: null,
		warn: manque.length === 0 ? null : `Ce CV n’est pas complet : il manque ${manque.map((m) => m.libelle).join(", ")}.`,
		card: cvCard(etat, ctx),
		relances: [],
		relancesVides: "Un CV s’envoie à un employeur, jamais dans un groupe."
	};
}
var cv = {
	id: "cv",
	group: "documents",
	title: "Curriculum vitæ",
	keywords: [
		"cv",
		"curriculum",
		"curriculum vitae",
		"mon parcours",
		"chercher du travail",
		"postuler",
		"candidature",
		"chercher un emploi"
	],
	engine: "doc",
	schema: cvSchema,
	defaults: cvDefaults,
	compute: {
		controleCv,
		debordeUnePage,
		signesCv
	},
	card: cvCard,
	share: cvShare
};
/** Bornes des tranches d'ancienneté, en jours. */
var TRANCHES = [15, 30];
/** Le nombre de jours qu'une dette a passés ouverte. */
function joursOuverts(dette, maintenant) {
	if (dette.regle) return 0;
	const debut = new Date(dette.depuis);
	if (Number.isNaN(debut.getTime())) return 0;
	return Math.max(0, joursEntre(debut, maintenant));
}
function vueDettes(etat, maintenant) {
	return etat.dettes.map((d, index) => {
		const jours = joursOuverts(d, maintenant);
		return {
			...d,
			index,
			jours,
			enRetard: !d.regle && jours > 30
		};
	});
}
/**
* L'ordre de l'écran : ce qui est dû d'abord, le plus vieux en tête.
*
* Une ardoise se lit pour savoir qui relancer. Trier par nom obligerait à
* parcourir toute la liste pour trouver les trois lignes qui comptent.
*/
function ordonner(vues) {
	return [...vues].sort((a, b) => {
		if (a.regle !== b.regle) return a.regle ? 1 : -1;
		if (a.jours !== b.jours) return b.jours - a.jours;
		return b.montant - a.montant;
	});
}
function totaux(vues) {
	const ouvertes = vues.filter((v) => !v.regle);
	const encours = ouvertes.reduce((a, v) => a + v.montant, 0);
	const recouvre = vues.filter((v) => v.regle).reduce((a, v) => a + v.montant, 0);
	const total = encours + recouvre;
	return {
		encours,
		recouvre,
		ouverts: ouvertes.length,
		enRetard: ouvertes.filter((v) => v.enRetard).length,
		part: total === 0 ? 0 : recouvre / total
	};
}
/**
* L'encours par ancienneté.
*
* Trois tranches, parce que trois suffisent à décider : ce qui vient de
* partir, ce qui commence à traîner, ce qu'il faut aller chercher.
*/
function vieillissement(vues) {
	const ouvertes = vues.filter((v) => !v.regle);
	const dans = (min, max) => ouvertes.filter((v) => v.jours >= min && v.jours <= max);
	const tranche = (libelle, lignes) => ({
		libelle,
		montant: lignes.reduce((a, v) => a + v.montant, 0),
		clients: lignes.length
	});
	return [
		tranche("0–15 j", dans(0, TRANCHES[0])),
		tranche("16–30 j", dans(TRANCHES[0] + 1, TRANCHES[1])),
		tranche("+30 j", ouvertes.filter((v) => v.jours > TRANCHES[1]))
	];
}
//#endregion
//#region ../engine/src/schema/ardoise.ts
/**
* Le contrat de l'ardoise.
*
* `depuis` est une date, pas un nombre de jours : c'est ce qui permet à
* l'ancienneté de bouger toute seule. Champs de ligne : jamais de `minLength`,
* voir `schema/commun.ts`.
*/
var ardoiseSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"boutique",
		"dettes"
	],
	properties: {
		nom: {
			type: "string",
			minLength: 1,
			maxLength: 60,
			title: "Nom de l’outil"
		},
		boutique: {
			type: "string",
			maxLength: 60,
			title: "Nom de la boutique",
			description: "Il apparaît sur la carte et en tête des relances."
		},
		dettes: {
			type: "array",
			maxItems: 200,
			title: "Ce que les clients doivent",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"client",
					"montant",
					"depuis",
					"regle"
				],
				properties: {
					client: {
						type: "string",
						maxLength: 60,
						title: "Client"
					},
					montant: {
						type: "integer",
						minimum: 0,
						maximum: 1e9,
						title: "Montant dû (F CFA)"
					},
					depuis: {
						type: "string",
						maxLength: 32,
						title: "Ouverte le",
						description: "Date ISO 8601. L’ancienneté s’en déduit toute seule."
					},
					tel: {
						type: "string",
						maxLength: 20,
						title: "Téléphone",
						description: "Sans numéro, la relance se copie au lieu de s’envoyer."
					},
					regle: {
						type: "boolean",
						title: "Réglée"
					}
				}
			}
		},
		encre: encreSchema
	}
};
//#endregion
//#region ../engine/src/skeletons/ardoise.ts
/**
* L'ardoise des clients.
*
* Elle part vide et sans nom de boutique : le prototype portait « Quincaillerie
* Bépanda » et trois clients nommés, et personne ne doit ouvrir son ardoise sur
* les dettes d'un inconnu.
*/
var ardoiseDefaults = {
	nom: "Ardoise clients",
	encre: "bordeaux",
	boutique: "",
	dettes: []
};
/**
* L'avertissement du brief § 2.5, mot pour mot.
*
* Il ne se reformule pas et il ne se met pas en option. C'est le seul endroit
* de l'atelier où l'outil dit non à ce que l'utilisateur s'apprête à faire, et
* il le dit pour une raison qui n'est pas technique.
*/
var AVERTISSEMENT_ARDOISE = "Cette carte est pour toi, pas pour un groupe. Une ardoise publiée avec les noms, c’est de l’humiliation — et on perd le client en même temps que l’argent. Ce qui part dans WhatsApp, ce sont les relances individuelles.";
function nomBoutique(etat) {
	return etat.boutique.trim() === "" ? etat.nom : etat.boutique;
}
function ligneDette(v) {
	return {
		n: v.regle || v.jours === 0 ? v.client : `${v.client} · ${v.jours} j`,
		ok: v.regle,
		warn: v.enRetard,
		val: montantF(v.montant)
	};
}
function ardoiseCard(etat, ctx) {
	const vues = vueDettes(etat, ctx.maintenant);
	const t = totaux(vues);
	return {
		kicker: "ARDOISE CLIENTS",
		title: nomBoutique(etat),
		sub: `${t.ouverts} client${t.ouverts > 1 ? "s" : ""} ouvert${t.ouverts > 1 ? "s" : ""}`,
		tag: null,
		bigLabel: "ENCOURS TOTAL",
		big: montantF(t.encours),
		pct: t.part,
		subline: `${montantF(t.recouvre)} déjà recouvrés · ${t.enRetard} client${t.enRetard > 1 ? "s" : ""} au-delà de 30 jours`,
		listTitle: "DÉTAIL",
		items: ordonner(vues).slice(0, 12).map(ligneDette),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function ardoiseShare(etat, ctx) {
	const vues = vueDettes(etat, ctx.maintenant);
	const t = totaux(vues);
	const ouvertes = ordonner(vues).filter((v) => !v.regle);
	const boutique = nomBoutique(etat);
	const relances = ouvertes.map((v) => ({
		nom: v.client,
		tel: v.tel ?? null,
		message: `Bonjour ${v.client}. Chez ${boutique}, il reste ${montantF(v.montant)} ouverts depuis ${v.jours} jour${v.jours > 1 ? "s" : ""}. ` + (ctx.lien === "" ? "" : `Le détail est ici : ${ctx.lien} — `) + "quand pouvez-vous passer, même pour un premier versement ?"
	}));
	const lignes = [`${boutique.toUpperCase()} — encours ${montantF(t.encours)}`, ...ouvertes.map((v) => `• ${v.client} — ${nf(v.montant)} F (${v.jours} j)`)];
	return {
		title: boutique,
		desc: `Encours ${montantF(t.encours)} · ${t.ouverts} client${t.ouverts > 1 ? "s" : ""} · ${t.enRetard} au-delà de 30 jours`,
		name: "ardoise",
		txt: lignes.join("\n"),
		broad: null,
		warn: AVERTISSEMENT_ARDOISE,
		card: ardoiseCard(etat, ctx),
		relances,
		relancesVides: "Personne à relancer — tout est réglé."
	};
}
var ardoise = {
	id: "ardoise",
	group: "registres",
	title: "Ardoise clients",
	keywords: [
		"ardoise",
		"dette",
		"credit",
		"doit",
		"creance",
		"impaye",
		"on me doit",
		"qui me doit",
		"carnet de dettes",
		"recouvrement"
	],
	engine: "registre",
	schema: ardoiseSchema,
	defaults: ardoiseDefaults,
	compute: {
		joursOuverts,
		ordonner,
		totaux,
		vieillissement,
		vueDettes
	},
	card: ardoiseCard,
	share: ardoiseShare
};
//#endregion
//#region ../engine/src/compute/presence.ts
/** Le nom d'une séance, tel qu'il s'affiche. */
function nomSeance(etat, index) {
	const s = etat.seances[index];
	if (s === void 0) return "";
	return s.titre.trim() === "" ? `séance ${index + 1}` : s.titre;
}
function estPresent(etat, seance, personne) {
	return etat.seances[seance]?.presents[personne] === true;
}
function appel(etat, seance) {
	const total = etat.noms.length;
	const presents = etat.noms.filter((_, i) => estPresent(etat, seance, i)).length;
	return {
		presents,
		total,
		taux: total === 0 ? 0 : presents / total,
		absents: etat.noms.filter((_, i) => !estPresent(etat, seance, i))
	};
}
/**
* L'assiduité de chacun sur toutes les séances.
*
* Le dénominateur ne compte que les séances où la personne figurait : une case
* jamais renseignée n'est pas une absence, sans quoi le dernier inscrit
* ouvrirait la feuille à 20 % et n'y pourrait rien.
*/
function assiduites(etat) {
	return etat.noms.map((nom, index) => {
		let seances = 0;
		let presences = 0;
		for (const s of etat.seances) {
			const marque = s.presents[index];
			if (marque === void 0) continue;
			seances += 1;
			if (marque) presences += 1;
		}
		return {
			nom,
			index,
			seances,
			presences,
			taux: seances === 0 ? null : presences / seances
		};
	});
}
function decroche(a) {
	return a.taux !== null && a.taux < .6;
}
//#endregion
//#region ../engine/src/schema/presence.ts
/**
* Le contrat de la feuille de présence.
*
* `noms` et `presents` sont indexés ensemble : la case `presents[i]` est celle
* de `noms[i]`. Le schéma ne peut pas dire ça, mais les transitions du moteur
* s'en chargent — retirer un nom retire sa colonne dans chaque séance.
*
* Champs de ligne : jamais de `minLength`, voir `schema/commun.ts`.
*/
var presenceSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"noms",
		"seances"
	],
	properties: {
		nom: {
			type: "string",
			minLength: 1,
			maxLength: 60,
			title: "Nom de l’outil"
		},
		noms: {
			type: "array",
			maxItems: 120,
			title: "Les personnes",
			description: "L’ordre de la feuille. Il ne change pas d’une séance à l’autre.",
			items: {
				type: "string",
				maxLength: 60,
				title: "Nom"
			}
		},
		seances: {
			type: "array",
			maxItems: 60,
			title: "Les séances",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["titre", "presents"],
				properties: {
					titre: {
						type: "string",
						maxLength: 60,
						title: "Titre de la séance",
						description: "Ex. « 12 mars » ou « Assemblée générale ». Vide, la séance porte son rang."
					},
					presents: {
						type: "array",
						maxItems: 120,
						title: "Présents",
						items: {
							type: "boolean",
							title: "Présent"
						}
					}
				}
			}
		},
		encre: encreSchema
	}
};
//#endregion
//#region ../engine/src/skeletons/presence.ts
/**
* La feuille de présence.
*
* Elle part vide : le prototype portait douze noms d'une association qui
* n'existe pas, et une feuille neuve doit être celle de l'utilisateur.
*
* Elle se partage par séance, jamais en bloc : ce qui intéresse le groupe,
* c'est l'appel du jour, et une feuille qui déballerait le taux d'assiduité de
* chacun devant tout le monde ferait le même tort qu'une ardoise publiée.
*/
var presenceDefaults = {
	nom: "Feuille de présence",
	encre: "foret",
	noms: [],
	seances: []
};
/** L'index de la séance à montrer par défaut : la dernière ouverte. */
function derniereSeance(etat) {
	return Math.max(0, etat.seances.length - 1);
}
function presenceCard(etat, ctx, seance = derniereSeance(etat)) {
	const a = appel(etat, seance);
	return {
		kicker: "FEUILLE DE PRÉSENCE",
		title: etat.nom,
		sub: `${etat.seances.length} séance${etat.seances.length > 1 ? "s" : ""} enregistrée${etat.seances.length > 1 ? "s" : ""}`,
		tag: etat.seances.length === 0 ? null : nomSeance(etat, seance),
		bigLabel: "PRÉSENTS",
		big: `${a.presents} / ${a.total}`,
		pct: a.taux,
		subline: `${Math.round(a.taux * 100)} % de présence à cette séance`,
		listTitle: "APPEL",
		items: etat.noms.map((nom, i) => {
			const present = etat.seances[seance]?.presents[i] === true;
			return {
				n: nom,
				ok: present,
				warn: !present,
				val: present ? "présent" : "absent"
			};
		}),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function presenceShare(etat, ctx, seance = derniereSeance(etat)) {
	const a = appel(etat, seance);
	const titre = nomSeance(etat, seance);
	const relances = a.absents.map((nom) => ({
		nom,
		tel: null,
		message: `Bonjour ${nom}. Tu n'as pas été marqué présent à la ${titre} de ${etat.nom}. ` + (ctx.lien === "" ? "" : `La feuille est ici : ${ctx.lien}`)
	}));
	const lignes = [
		`${etat.nom.toUpperCase()} — ${titre}`,
		`Présents : ${a.presents} / ${a.total}`,
		a.absents.length === 0 ? "" : `Absents : ${a.absents.join(", ")}`,
		ctx.lien
	];
	return {
		title: etat.nom,
		desc: `${titre} · ${a.presents} présents sur ${a.total}`,
		name: `presence-s${seance + 1}`,
		txt: lignes.filter((l) => l !== "").join("\n"),
		broad: null,
		warn: assiduites(etat).some(decroche) ? "La carte ne montre que l’appel du jour. Le taux d’assiduité de chacun reste sur ton téléphone." : null,
		card: presenceCard(etat, ctx, seance),
		relances,
		relancesVides: "Tout le monde était là — rien à envoyer."
	};
}
var presence = {
	id: "presence",
	group: "registres",
	title: "Feuille de présence",
	keywords: [
		"presence",
		"appel",
		"absence",
		"assiduite",
		"qui est venu",
		"liste de presence",
		"emargement",
		"reunion",
		"seance",
		"cours"
	],
	engine: "registre",
	schema: presenceSchema,
	defaults: presenceDefaults,
	compute: {
		appel,
		assiduites,
		decroche,
		nomSeance
	},
	card: (etat, ctx) => presenceCard(etat, ctx),
	share: (etat, ctx) => presenceShare(etat, ctx)
};
//#endregion
//#region ../engine/src/compute/callbox.ts
function totauxCallbox(operations) {
	return {
		gagne: operations.reduce((a, o) => a + o.commission, 0),
		volume: operations.reduce((a, o) => a + o.montant, 0),
		nombre: operations.length
	};
}
/** Les opérations d'un jour civil donné. */
function operationsDuJour(operations, jour) {
	return operations.filter((o) => o.jour === jour);
}
/**
* Les journées, de la plus ancienne à la plus récente.
*
* Le prototype gardait une semaine figée à côté des opérations du jour ; deux
* sources pour la même chose finissent toujours par diverger. Ici la semaine
* se déduit du registre.
*/
function journees(operations) {
	const par = /* @__PURE__ */ new Map();
	for (const o of operations) {
		const deja = par.get(o.jour);
		par.set(o.jour, {
			jour: o.jour,
			gagne: (deja?.gagne ?? 0) + o.commission,
			nombre: (deja?.nombre ?? 0) + 1
		});
	}
	return [...par.values()].sort((a, b) => a.jour.localeCompare(b.jour));
}
//#endregion
//#region ../engine/src/schema/callbox.ts
/**
* Le contrat du call-box.
*
* Champs de ligne : jamais de `minLength`, voir `schema/commun.ts`.
*/
var callboxSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"tranches",
		"operations"
	],
	properties: {
		nom: {
			type: "string",
			minLength: 1,
			maxLength: 60,
			title: "Nom de l’outil"
		},
		tranches: {
			type: "array",
			maxItems: 10,
			title: "Grille de commission",
			description: "Lue dans l’ordre : la première tranche qui couvre le montant l’emporte.",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["plafond", "commission"],
				properties: {
					plafond: {
						type: "integer",
						minimum: 0,
						maximum: 1e9,
						title: "Jusqu’à (F CFA)",
						description: "Zéro veut dire « au-delà » : la tranche n’a pas de plafond."
					},
					commission: {
						type: "integer",
						minimum: 0,
						maximum: 1e6,
						title: "Tu gardes (F CFA)"
					}
				}
			}
		},
		operations: {
			type: "array",
			maxItems: 400,
			title: "Registre des opérations",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"montant",
					"commission",
					"heure",
					"jour"
				],
				properties: {
					montant: {
						type: "integer",
						minimum: 0,
						maximum: 1e9,
						title: "Montant remis"
					},
					commission: {
						type: "integer",
						minimum: 0,
						maximum: 1e6,
						title: "Commission gardée"
					},
					heure: {
						type: "string",
						maxLength: 8,
						title: "Heure"
					},
					jour: {
						type: "string",
						maxLength: 10,
						title: "Jour"
					}
				}
			}
		},
		encre: encreSchema
	}
};
//#endregion
//#region ../engine/src/skeletons/callbox.ts
/**
* Le call-box.
*
* La grille de départ est celle qu'on trouve dans la rue, en francs ronds. Ce
* n'est pas la donnée de quelqu'un — c'est un tarif d'usage, que chacun corrige
* à sa main dès le premier écran. Une grille vide obligerait à saisir quatre
* tranches avant de pouvoir calculer quoi que ce soit.
*/
var callboxDefaults = {
	nom: "Call-box",
	encre: "ardoise",
	tranches: [
		{
			plafond: 5e3,
			commission: 100
		},
		{
			plafond: 25e3,
			commission: 200
		},
		{
			plafond: 1e5,
			commission: 500
		},
		{
			plafond: 0,
			commission: 1e3
		}
	],
	operations: []
};
function callboxCard(etat, ctx) {
	const jour = jourWAT(ctx.maintenant);
	const duJour = operationsDuJour(etat.operations, jour);
	const t = totauxCallbox(duJour);
	return {
		kicker: "CALL-BOX",
		title: etat.nom,
		sub: `${t.nombre} opération${t.nombre > 1 ? "s" : ""} aujourd’hui`,
		tag: null,
		bigLabel: "GAIN DU JOUR",
		big: montantF(t.gagne),
		pct: null,
		subline: `${montantF(t.volume)} passés par la caisse`,
		listTitle: "DERNIÈRES OPÉRATIONS",
		items: [...duJour].reverse().slice(0, 10).map((o) => ({
			n: `${o.heure} · ${nf(o.montant)} F`,
			ok: true,
			warn: false,
			val: montantF(o.commission)
		})),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function callboxShare(etat, ctx) {
	const jour = jourWAT(ctx.maintenant);
	const t = totauxCallbox(operationsDuJour(etat.operations, jour));
	return {
		title: etat.nom,
		desc: `Gain du jour ${montantF(t.gagne)} · ${t.nombre} opération${t.nombre > 1 ? "s" : ""}`,
		name: `callbox-${jour}`,
		txt: [
			`${etat.nom.toUpperCase()} — gain du jour ${montantF(t.gagne)}`,
			`${t.nombre} opération${t.nombre > 1 ? "s" : ""} · ${montantF(t.volume)} de volume`,
			ctx.lien
		].filter((l) => l !== "").join("\n"),
		broad: null,
		warn: "Cette carte dit ce que tu as gagné aujourd’hui. Elle est pour toi ou pour ton patron, pas pour un groupe.",
		card: callboxCard(etat, ctx),
		relances: [],
		relancesVides: "Un call-box encaisse comptant — il n’y a personne à relancer."
	};
}
var callbox = {
	id: "callbox",
	group: "calculs",
	title: "Call-box",
	keywords: [
		"call box",
		"callbox",
		"transfert",
		"momo",
		"mobile money",
		"commission",
		"orange money",
		"depot retrait",
		"je transfere",
		"cabine"
	],
	engine: "registre",
	schema: callboxSchema,
	defaults: callboxDefaults,
	compute: {
		journees,
		operationsDuJour,
		totauxCallbox,
		jourWAT
	},
	card: callboxCard,
	share: callboxShare
};
var MOTIF_LIEN = new RegExp(`^[23456789ABCDEFGHJKLMNPQRSTVWXYZ]{12}$`);
function lienValide(lien) {
	return MOTIF_LIEN.test(lien);
}
/**
* Évalue l'arbre. Jamais d'exception, jamais de NaN, jamais d'infini.
*
* Une calculatrice qui affiche « NaN » à quelqu'un qui compte sa journée est
* pire qu'une calculatrice absente : elle fait douter de tout le reste. Une
* division par zéro rend zéro, ce qui est faux, mais lisible et sans surprise.
*/
function evaluer(e, lire) {
	const brut = brute(e, lire, 0);
	return Number.isFinite(brut) ? brut : 0;
}
function brute(e, lire, niveau) {
	if (niveau > 6) return 0;
	if ("nombre" in e) return e.nombre;
	if ("ref" in e) return lire(e.ref);
	const g = brute(e.gauche, lire, niveau + 1);
	const d = brute(e.droite, lire, niveau + 1);
	switch (e.op) {
		case "plus": return g + d;
		case "moins": return g - d;
		case "fois": return g * d;
		case "divise": return d === 0 ? 0 : g / d;
		case "pourcent": return g * d / 100;
		case "min": return Math.min(g, d);
		case "max": return Math.max(g, d);
	}
}
//#endregion
//#region ../engine/src/valider.ts
/**
* Validateur du sous-ensemble de JSON Schema retenu par le produit.
*
* C'est la porte par laquelle passe toute sortie de modèle avant d'atteindre
* quoi que ce soit (BRIEF.md § 2.1, § 3.5). Écrit à la main, sans dépendance :
* cent lignes valent mieux qu'une bibliothèque dans un budget de 120 Ko, et la
* surface à raisonner reste lisible d'un coup d'œil.
*
* Le vocabulaire est celui de JSON Schema standard — `type`, `enum`, `required`,
* `additionalProperties`, `minimum`… — pour que le même objet serve de schéma de
* réponse contrainte au modèle en phase 4, sans traduction.
*
* Le validateur ne corrige rien et ne complète rien. Il dit ce qui ne va pas, et
* l'appelant décide. Un seul essai de reprise est prévu, puis abandon.
*/
function typeDe(v) {
	if (v === null) return "null";
	if (Array.isArray(v)) return "tableau";
	return typeof v;
}
function err(chemin, message) {
	return {
		chemin,
		message
	};
}
function valider(schema, valeur, chemin = "$") {
	switch (schema.type) {
		case "string": {
			if (typeof valeur !== "string") return [err(chemin, `chaîne attendue, reçu ${typeDe(valeur)}`)];
			const e = [];
			if (schema.enum !== void 0 && !schema.enum.includes(valeur)) e.push(err(chemin, `valeur hors liste : « ${valeur} »`));
			if (schema.minLength !== void 0 && valeur.length < schema.minLength) e.push(err(chemin, `trop court : ${valeur.length} caractères, minimum ${schema.minLength}`));
			if (schema.maxLength !== void 0 && valeur.length > schema.maxLength) e.push(err(chemin, `trop long : ${valeur.length} caractères, maximum ${schema.maxLength}`));
			return e;
		}
		case "number":
		case "integer": {
			if (typeof valeur !== "number" || !Number.isFinite(valeur)) return [err(chemin, `nombre attendu, reçu ${typeDe(valeur)}`)];
			const e = [];
			if (schema.type === "integer" && !Number.isInteger(valeur)) e.push(err(chemin, `entier attendu, reçu ${valeur}`));
			if (schema.minimum !== void 0 && valeur < schema.minimum) e.push(err(chemin, `inférieur au minimum ${schema.minimum} : ${valeur}`));
			if (schema.maximum !== void 0 && valeur > schema.maximum) e.push(err(chemin, `supérieur au maximum ${schema.maximum} : ${valeur}`));
			return e;
		}
		case "boolean": return typeof valeur === "boolean" ? [] : [err(chemin, `booléen attendu, reçu ${typeDe(valeur)}`)];
		case "array": {
			if (!Array.isArray(valeur)) return [err(chemin, `tableau attendu, reçu ${typeDe(valeur)}`)];
			const e = [];
			if (schema.minItems !== void 0 && valeur.length < schema.minItems) e.push(err(chemin, `trop peu d'éléments : ${valeur.length}, minimum ${schema.minItems}`));
			if (schema.maxItems !== void 0 && valeur.length > schema.maxItems) e.push(err(chemin, `trop d'éléments : ${valeur.length}, maximum ${schema.maxItems}`));
			valeur.forEach((v, i) => {
				e.push(...valider(schema.items, v, `${chemin}[${i}]`));
			});
			return e;
		}
		case "object": {
			if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return [err(chemin, `objet attendu, reçu ${typeDe(valeur)}`)];
			const obj = valeur;
			const e = [];
			for (const clef of schema.required ?? []) if (!Object.hasOwn(obj, clef)) e.push(err(`${chemin}.${clef}`, "champ obligatoire manquant"));
			for (const clef of Object.keys(obj)) {
				if (!Object.hasOwn(schema.properties, clef)) {
					if (schema.additionalProperties === false) e.push(err(`${chemin}.${clef}`, "champ inattendu"));
					continue;
				}
				const sous = schema.properties[clef];
				if (sous === void 0) continue;
				e.push(...valider(sous, obj[clef], `${chemin}.${clef}`));
			}
			return e;
		}
	}
}
//#endregion
//#region ../engine/src/calcul.ts
/**
* La deuxième forme que le modèle peut composer : une calculatrice.
*
* Un registre tient une liste ; une calculatrice répond à une question. « Ce
* qu'il me reste à payer », « ma marge sur chaque vente », « la part de
* chacun » : ce sont les plus petits outils du produit, et sans doute ceux
* qu'on ouvre le plus souvent.
*
* Elle manquait, et ça se voyait : tout ce qui n'était pas une liste se
* heurtait à un refus. Le moteur savait pourtant déjà les dessiner — seule la
* formule bloquait, parce qu'elle était écrite en TypeScript. Déclarée en
* arbre (`expression.ts`), elle devient une configuration comme le reste.
*/
/** Celui d'une calculatrice composée. Voir `ID_COMPOSE` : même raison. */
var ID_COMPOSE_CALCUL = "compose-calcul";
var MAX_PARAGRAPHE = 1e3;
var schemaFormulaire = {
	type: "object",
	additionalProperties: false,
	required: [
		"titre",
		"kicker",
		"accroche",
		"champs",
		"bouton",
		"merci"
	],
	properties: {
		titre: {
			type: "string",
			minLength: 2,
			maxLength: 40,
			title: "Nom",
			description: "Ce que le formulaire demande. Ex. « Commandes du week-end »."
		},
		kicker: {
			type: "string",
			minLength: 2,
			maxLength: 30,
			title: "Sur-titre",
			description: "En capitales, au-dessus du nom. Ex. « TRAITEUR MAMA NGO »."
		},
		accroche: {
			type: "string",
			minLength: 4,
			maxLength: 160,
			title: "Accroche",
			description: "Une ou deux phrases : à quoi ça sert, et jusqu’à quand on peut répondre."
		},
		champs: {
			type: "array",
			minItems: 1,
			maxItems: 8,
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"clef",
					"titre",
					"sorte"
				],
				properties: {
					clef: {
						type: "string",
						minLength: 1,
						maxLength: 24,
						title: "Identifiant",
						description: "Lettres non accentuées, chiffres, soulignés. Commence par une minuscule. Ex. « nomDuClient »."
					},
					titre: {
						type: "string",
						minLength: 1,
						maxLength: 60,
						title: "La question",
						description: "Ce qu’on demande, tel qu’on le demanderait de vive voix. Ex. « Ton nom »."
					},
					sorte: {
						type: "string",
						enum: [
							"texte",
							"paragraphe",
							"nombre",
							"telephone",
							"choix",
							"oui-non"
						],
						title: "Sorte de réponse",
						description: "texte : une ligne. paragraphe : plusieurs. nombre : une quantité. telephone : un numéro. choix : une liste d’options. oui-non : une case à cocher."
					},
					obligatoire: {
						type: "boolean",
						title: "Obligatoire",
						description: "Vrai seulement si la réponse ne sert à rien sans. N’en mets pas partout."
					},
					aide: {
						type: "string",
						maxLength: 90,
						title: "Précision",
						description: "Une phrase sous la question, si elle évite un malentendu."
					},
					options: {
						type: "array",
						maxItems: 6,
						title: "Options",
						items: {
							type: "string",
							minLength: 1,
							maxLength: 40,
							title: "Option"
						},
						description: "Pour un champ « choix », et pour lui seul.",
						ecran: {
							montrerSi: {
								champ: "sorte",
								vaut: ["choix"]
							},
							ajout: "Ajouter une option",
							retrait: "Retirer l’option"
						}
					}
				}
			},
			title: "Questions",
			description: "Le moins possible : chaque question de plus est une réponse de moins.",
			ecran: {
				ajout: "Ajouter une question",
				retrait: "Retirer la question"
			}
		},
		bouton: {
			type: "string",
			minLength: 2,
			maxLength: 30,
			title: "Bouton",
			description: "Ex. « Envoyer ma commande »."
		},
		merci: {
			type: "string",
			minLength: 4,
			maxLength: 160,
			title: "Après l’envoi",
			description: "Ce qu’on lit une fois la réponse partie. Dis ce qui va se passer ensuite."
		}
	}
};
function verifierFormulaire(valeur) {
	const erreurs = [...valider(schemaFormulaire, valeur)];
	if (erreurs.length > 0) return erreurs;
	const f = valeur;
	const clefs = f.champs.map((c) => c.clef);
	for (const [i, champ] of f.champs.entries()) {
		if (!/^[a-z][a-zA-Z0-9_]*$/.test(champ.clef)) erreurs.push({
			chemin: `$.champs[${i}].clef`,
			message: `« ${champ.clef} » ne prend que des lettres non accentuées, des chiffres et des soulignés, et commence par une minuscule`
		});
		if (champ.sorte === "choix" && (champ.options ?? []).length < 2) erreurs.push({
			chemin: `$.champs[${i}].options`,
			message: "un champ « choix » a besoin d’au moins deux options : sinon il n’y a rien à choisir"
		});
		if (champ.sorte !== "choix" && champ.options !== void 0) erreurs.push({
			chemin: `$.champs[${i}].options`,
			message: `des options sur un champ « ${champ.sorte} » ne s’afficheraient nulle part`
		});
	}
	for (const d of new Set(clefs.filter((c, i) => clefs.indexOf(c) !== i))) erreurs.push({
		chemin: "$.champs",
		message: `la clef « ${d} » apparaît deux fois : la seconde réponse écraserait la première`
	});
	return erreurs;
}
function depouiller(formulaire, recu) {
	const contenu = {};
	const manques = [];
	for (const champ of formulaire.champs) {
		const brut = (recu[champ.clef] ?? "").trim();
		const valeur = brut === "" ? "" : ramener(champ, brut);
		if (valeur === "") {
			if (champ.obligatoire === true) manques.push(champ.titre);
			continue;
		}
		contenu[champ.clef] = valeur;
	}
	return {
		contenu,
		manques
	};
}
function ramener(champ, brut) {
	if (champ.sorte === "oui-non") return "oui";
	if (champ.sorte === "choix") return (champ.options ?? []).includes(brut) ? brut : "";
	if (champ.sorte === "nombre") {
		const nombre = Number(brut.replace(/\s/g, "").replace(",", "."));
		return Number.isFinite(nombre) ? String(nombre) : "";
	}
	return brut.slice(0, champ.sorte === "paragraphe" ? MAX_PARAGRAPHE : 200);
}
/**
* Met un numéro au format international attendu par `wa.me`.
*
* Accepte ce qu'un utilisateur tape vraiment : espaces, tirets, points, `+`,
* `00`, avec ou sans indicatif. Rend `null` si rien d'exploitable n'en sort —
* mieux vaut proposer de copier le message que d'ouvrir WhatsApp sur un
* mauvais numéro.
*/
function numeroInternational(brut) {
	let chiffres = brut.replace(/[^\d+]/g, "");
	if (chiffres.startsWith("+")) chiffres = chiffres.slice(1);
	else if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
	chiffres = chiffres.replace(/\D/g, "");
	if (chiffres === "") return null;
	if (/^[62]\d{8}$/.test(chiffres)) return "237" + chiffres;
	if (chiffres.length >= 10 && chiffres.length <= 15) return chiffres;
	return null;
}
/** Le lien qui ouvre WhatsApp avec le message déjà écrit. */
function lienWhatsApp(tel, message) {
	const numero = numeroInternational(tel);
	if (numero === null) return null;
	return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}
/**
* Le numéro tel qu'on l'écrit sur une enseigne.
*
* Le modèle rend « 699412708 » aussi souvent que « +237 6 99 41 27 08 », selon
* ce que la demande contenait, et la page affichait ce qu'elle recevait : une
* vitrine sur deux montrait neuf chiffres collés sous son bouton. Le numéro
* qu'un client recopie à la main sur un cahier doit se lire par groupes.
*
* Neuf chiffres, un seul puis quatre paires : c'est la façon dont un numéro
* camerounais se dicte au téléphone. Un numéro d'ailleurs n'est pas regroupé —
* on ne sait pas comment son pays le coupe, et le couper au hasard le rendrait
* plus difficile à lire, pas moins. Ce qui n'est pas un numéro du tout revient
* tel quel : c'est ce que quelqu'un a écrit, et le remplacer par du vide
* effacerait la seule chose qu'il savait.
*/
function numeroLisible(brut) {
	const numero = numeroInternational(brut);
	if (numero === null) return brut;
	if (numero.startsWith("237") && numero.length === 12) {
		const local = numero.slice(3);
		const paires = (local.slice(1).match(/\d{2}/g) ?? []).join(" ");
		return `+237 ${local.charAt(0)} ${paires}`;
	}
	return `+${numero}`;
}
var schemaPage = {
	type: "object",
	additionalProperties: false,
	required: [
		"titre",
		"kicker",
		"accroche",
		"sections"
	],
	properties: {
		titre: {
			type: "string",
			minLength: 2,
			maxLength: 40,
			title: "Nom",
			description: "Le nom de l’activité, tel qu’il est sur l’enseigne. Ex. « Quincaillerie Bépanda »."
		},
		kicker: {
			type: "string",
			minLength: 2,
			maxLength: 30,
			title: "Sur-titre",
			description: "En capitales, au-dessus du nom. Ex. « QUINCAILLERIE »."
		},
		accroche: {
			type: "string",
			minLength: 4,
			maxLength: 120,
			title: "Accroche",
			description: "Une phrase. Ce qu’on dirait à quelqu’un qui passe devant la boutique."
		},
		sections: {
			type: "array",
			minItems: 1,
			maxItems: 8,
			items: {
				type: "object",
				additionalProperties: false,
				required: ["titre", "sorte"],
				properties: {
					titre: {
						type: "string",
						minLength: 2,
						maxLength: 40,
						title: "Titre de la section",
						description: "Ex. « Ce que je vends »."
					},
					sorte: {
						type: "string",
						enum: [
							"texte",
							"liste",
							"prix"
						],
						title: "Sorte",
						description: "texte : un paragraphe, dans « texte ». liste : des noms, dans « lignes ». prix : des noms avec un montant, dans « lignes ». Choisis « texte » quand tu n’as pas la liste : une section porte toujours son contenu."
					},
					texte: {
						type: "string",
						minLength: 1,
						maxLength: 400,
						title: "Texte",
						description: "Obligatoire quand la sorte est « texte ». Deux paragraphes au plus.",
						ecran: { montrerSi: {
							champ: "sorte",
							vaut: ["texte"]
						} }
					},
					lignes: {
						type: "array",
						minItems: 1,
						maxItems: 8,
						items: {
							type: "object",
							additionalProperties: false,
							required: ["nom"],
							properties: {
								nom: {
									type: "string",
									minLength: 1,
									maxLength: 60,
									title: "Ce que c’est",
									description: "Ex. « Tôle bac 30/100 »."
								},
								valeur: {
									type: "string",
									maxLength: 30,
									title: "Prix ou quantité",
									description: "Tel qu’on le dit. Ex. « 12 500 F », « 2 h »."
								},
								detail: {
									type: "string",
									maxLength: 60,
									title: "Précision",
									description: "Une ligne, si elle sert."
								}
							}
						},
						title: "Lignes",
						description: "Obligatoire quand la sorte est « liste » ou « prix ». Au moins une ligne.",
						ecran: {
							montrerSi: {
								champ: "sorte",
								vaut: ["liste", "prix"]
							},
							ajout: "Ajouter une ligne",
							retrait: "Retirer la ligne"
						}
					}
				}
			},
			title: "Sections",
			ecran: {
				ajout: "Ajouter une section",
				retrait: "Retirer la section"
			}
		},
		telephone: {
			type: "string",
			maxLength: 20,
			title: "WhatsApp",
			description: "Le numéro sur lequel on peut écrire, uniquement s’il est dans la demande. Ne l’invente sous aucun prétexte : un numéro inventé appartient à quelqu’un, et c’est lui qu’on appellera."
		},
		adresse: {
			type: "string",
			maxLength: 90,
			title: "Où",
			description: "Le quartier et la rue, uniquement s’ils sont dans la demande. N’invente pas un lieu : des gens s’y déplaceraient."
		},
		horaires: {
			type: "string",
			maxLength: 60,
			title: "Quand",
			description: "Les jours et les heures d’ouverture, uniquement s’ils sont dans la demande."
		},
		date: {
			type: "string",
			maxLength: 20,
			title: "Jour de l’événement",
			description: "Seulement si la demande annonce un événement daté. « AAAA-MM-JJ », ou « AAAA-MM-JJTHH:MM » si l’heure est dite. N’invente jamais une date."
		},
		sommaire: {
			type: "boolean",
			title: "Menu en haut",
			description: "Vrai quand la demande dit « un site » : un menu saute d’une section à l’autre. Faux pour une simple page."
		}
	}
};
/**
* Vérifie ce que le modèle a rendu, au-delà de ce que le schéma sait dire.
*
* Le schéma tient les types et les bornes. Ce qu'il ne tient pas, c'est la
* cohérence entre `sorte` et le contenu : une section « prix » sans lignes est
* un titre suivi de rien, et une section « texte » sans texte aussi. Les
* laisser passer donnerait une page à trous, publiée sous le nom de quelqu'un.
*/
function verifierPage(valeur) {
	const erreurs = [...valider(schemaPage, valeur)];
	if (erreurs.length > 0) return erreurs;
	const page = valeur;
	if (page.date !== void 0 && page.date !== "" && Number.isNaN(new Date(page.date).getTime())) erreurs.push({
		chemin: "$.date",
		message: `« ${page.date} » ne se lit pas : écris le jour en « AAAA-MM-JJ », ou « AAAA-MM-JJTHH:MM » avec l’heure`
	});
	for (const [i, section] of page.sections.entries()) {
		const chemin = `$.sections[${i}]`;
		if (section.sorte === "texte") {
			if ((section.texte ?? "").trim() === "") erreurs.push({
				chemin: `${chemin}.texte`,
				message: "une section « texte » sans texte est un titre suivi de rien"
			});
			continue;
		}
		if ((section.lignes ?? []).length === 0) erreurs.push({
			chemin: `${chemin}.lignes`,
			message: `une section « ${section.sorte} » sans lignes est un titre suivi de rien`
		});
	}
	return erreurs;
}
/**
* Les sections, chacune avec son ancre.
*
* Elles voyagent ensemble et non dans deux tableaux parallèles : une ancre
* seule ne sert à rien, et rapprocher deux listes par leur rang oblige à
* traiter un cas — « et si le rang n'existait pas ? » — qui ne peut pas
* arriver. Une branche qu'on ne peut pas atteindre est une branche qu'on ne
* peut pas éprouver.
*
* L'ancre se dérive du titre et non d'un compteur : une ancre numérotée change
* de cible dès qu'on insère une section, et un lien déjà envoyé tombe alors
* sur autre chose. Les accents sont dépliés, le reste devient un tiret ; deux
* titres qui se réduisent au même reçoivent leur rang, parce qu'un identifiant
* en double fait sauter le menu au premier des deux.
*/
function sectionsAncrees(sections) {
	const vues = /* @__PURE__ */ new Map();
	return sections.map((section, i) => {
		const base = section.titre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `section-${i + 1}`;
		const deja = vues.get(base);
		vues.set(base, (deja ?? 0) + 1);
		return {
			section,
			ancre: deja === void 0 ? base : `${base}-${deja + 1}`
		};
	});
}
/** Le menu a-t-il lieu d'être ? */
function avecSommaire(page) {
	return page.sommaire === true && page.sections.length >= 3;
}
/**
* La carte d'une page, celle que WhatsApp montre avant qu'on ouvre le lien.
*
* Elle n'a pas de grand chiffre à afficher : une vitrine ne totalise rien. Ce
* qui tient sa place est **ce qui fait cliquer** — le numéro qu'on peut écrire,
* et à défaut le premier prix annoncé. Une carte sans rien au milieu se lit
* comme un outil vide ; on préfère alors le sur-titre au blanc.
*/
function carteDePage(page, ctx) {
	const grand = grandDeLaPage(page, ctx.maintenant);
	const vitrine = sectionListee(page);
	return {
		kicker: page.kicker,
		title: page.titre,
		sub: page.accroche,
		tag: null,
		bigLabel: grand.libelle,
		big: grand.valeur,
		pct: null,
		subline: [
			page.adresse,
			page.horaires,
			sousLigneTelephone(page)
		].filter((x) => x !== void 0 && x !== "").join(" · "),
		listTitle: vitrine === null ? "" : vitrine.titre.toUpperCase(),
		items: vitrine === null ? [] : itemsDeSection(vitrine),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function grandDeLaPage(page, maintenant) {
	const jour = page.date === void 0 ? null : direLeJour(page.date, maintenant);
	if (jour !== null) return {
		libelle: jour.delai.toUpperCase(),
		valeur: `${jour.quand}${jour.heure === "" ? "" : ` ${jour.heure}`}`
	};
	if ((page.telephone === void 0 ? null : numeroInternational(page.telephone)) !== null) return {
		libelle: "WHATSAPP",
		valeur: numeroLisible(page.telephone ?? "")
	};
	const premiere = page.sections.find((s) => s.sorte === "prix")?.lignes?.find((l) => l.valeur !== void 0 && l.valeur !== "");
	if (premiere !== void 0) return {
		libelle: premiere.nom.toUpperCase(),
		valeur: premiere.valeur ?? ""
	};
	return {
		libelle: "",
		valeur: page.kicker
	};
}
/**
* Le numéro descend sur la ligne du lieu quand le grand caractère est pris par
* la date : une affiche d'événement doit encore dire à qui écrire.
*/
function sousLigneTelephone(page) {
	if (page.date === void 0 || page.telephone === void 0 || page.telephone === "") return "";
	return numeroInternational(page.telephone) === null ? "" : numeroLisible(page.telephone);
}
/** La section qu'on montre sur la carte : des prix de préférence, une liste sinon. */
function sectionListee(page) {
	return page.sections.find((s) => s.sorte === "prix") ?? page.sections.find((s) => s.sorte === "liste") ?? null;
}
function itemsDeSection(section) {
	return (section.lignes ?? []).map((l) => ({
		n: l.nom,
		ok: false,
		warn: false,
		val: l.valeur !== void 0 && l.valeur !== "" ? l.valeur : null
	}));
}
var JOURS = [
	"Dimanche",
	"Lundi",
	"Mardi",
	"Mercredi",
	"Jeudi",
	"Vendredi",
	"Samedi"
];
function direLeJour(iso, maintenant) {
	const quand = instantWAT(iso);
	if (quand === null) return null;
	const jours = joursEntre(maintenant, quand);
	const avecHeure = /[T ]\d{2}:\d{2}/.test(iso);
	return {
		quand: `${JOURS[jourDeLaSemaineWAT(quand)] ?? ""} ${dateLongue(quand)}`.trim(),
		heure: avecHeure ? heureDite(quand) : "",
		delai: delaiDit(jours),
		passe: jours < 0
	};
}
/**
* « à 15 h », « à 9 h 30 ».
*
* Pas « à 15 h 00 » : en français, une heure ronde n'écrit pas ses minutes, et
* les deux zéros donnent à une invitation l'air d'un horaire de train. Pas de
* zéro devant non plus — personne ne dit « zéro neuf heures ».
*/
function heureDite(quand) {
	const [heures = "", minutes = ""] = heureCourte(quand).split("h");
	return minutes === "00" ? `à ${Number(heures)} h` : `à ${Number(heures)} h ${minutes}`;
}
function delaiDit(jours) {
	if (jours < -1) return "c’est passé";
	if (jours === -1) return "c’était hier";
	if (jours === 0) return "c’est aujourd’hui";
	if (jours === 1) return "c’est demain";
	if (jours < 7) return `dans ${jours} jours`;
	if (jours < 14) return "dans une semaine";
	if (jours < 31) return `dans ${Math.round(jours / 7)} semaines`;
	return `dans ${Math.round(jours / 30)} mois`;
}
//#endregion
//#region ../engine/src/registre.ts
/**
* La seule chose que le modèle a le droit de produire.
*
* Invariant § 2.1 du brief : **jamais de génération de code libre**. Le modèle
* ne rend pas du HTML, pas du JavaScript, pas un gabarit — il remplit une
* configuration de registre, et c'est `RegistreListe`, écrit à la main et
* testé, qui la dessine. Ce fichier est la frontière : au-delà, rien de ce que
* le modèle a dit n'atteint l'écran sans être passé par ici.
*
* Le contrat vit dans le moteur, pas dans le paquet qui appelle le modèle : le
* client doit pouvoir revérifier ce que le serveur lui envoie sans importer de
* quoi appeler un fournisseur. Deux validateurs qui se recopient finiraient par
* diverger, et c'est celui du client qui se tairait.
*
* Le choix du registre décrit par ses colonnes n'est pas arbitraire. Quatre
* squelettes du prototype n'étaient déjà que ça, et la fabrique en tire schéma,
* validation, calculs, carte, partage et formulaire. Un cinquième registre
* coûte vingt lignes de description — c'est exactement ce qu'un modèle sait
* écrire, et exactement ce qu'il ne peut pas casser.
*/
/**
* L'identifiant d'un registre composé par le modèle.
*
* Il vit ici, avec le contrat, et non avec la fabrique qui en tire un
* squelette : l'atelier a besoin du nom pour créer l'outil, et rien d'autre.
* Le prendre là où est la fabrique faisait entrer les deux fabriques de
* squelettes dans la coquille initiale — deux kilo-octets avant le premier
* affichage, pour deux chaînes de caractères.
*/
var ID_COMPOSE = "compose";
//#endregion
//#region ../engine/src/schema/devis.ts
/**
* Le contrat du devis.
*
* Un devis propose : il porte une durée de validité et un acompte demandé à la
* commande. Ce qui l'engage fiscalement, c'est la facture — voir
* `schema/facture.ts`.
*/
var devisSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"encre",
		"numero",
		"emisLe",
		"emetteur",
		"client",
		"validite",
		"acompte",
		"lignes"
	],
	properties: {
		nom: {
			type: "string",
			minLength: 1,
			maxLength: 60,
			title: "Nom de l’outil"
		},
		numero: {
			type: "string",
			minLength: 1,
			maxLength: 24,
			title: "Numéro",
			description: "Ex. DV-2026-0118. Unique, continu et chronologique."
		},
		emisLe: {
			type: "string",
			minLength: 10,
			maxLength: 32,
			title: "Date d’émission",
			description: "Date ISO 8601, figée à la création."
		},
		emetteur: emetteurSchema,
		client: clientSchema,
		objet: {
			type: "string",
			maxLength: 120,
			title: "Objet"
		},
		validite: {
			type: "string",
			maxLength: 40,
			title: "Validité",
			description: "Ex. « 15 jours »."
		},
		acompte: {
			type: "integer",
			minimum: 0,
			maximum: 100,
			title: "Acompte à la commande (%)"
		},
		lignes: lignesSchema,
		encre: encreSchema
	}
};
//#endregion
//#region ../engine/src/schema/njangi.ts
/**
* Le contrat du carnet de njangi.
*
* C'est **la seule chose que le modèle a le droit de remplir** (invariant § 2.1).
* Le vocabulaire est celui de JSON Schema standard, pour servir tel quel de
* schéma de réponse contrainte en phase 4.
*
* Les bornes ne sont pas décoratives : elles arrêtent une sortie de modèle
* absurde avant qu'elle n'atteigne le rendu, et elles bornent la taille de
* l'instantané publié dans KV.
*/
var njangiSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"nom",
		"cotisation",
		"periode",
		"tour",
		"historique",
		"membres"
	],
	properties: {
		nom: {
			type: "string",
			minLength: 1,
			maxLength: 60,
			title: "Nom du njangi",
			description: "Tel qu’il est connu du groupe."
		},
		cotisation: {
			type: "integer",
			minimum: 0,
			maximum: 1e8,
			title: "Cotisation (F CFA)",
			description: "Part que verse chaque membre à chaque tour."
		},
		periode: {
			type: "string",
			enum: [
				"semaine",
				"quinzaine",
				"mois"
			],
			title: "Rythme",
			description: "À quelle fréquence le njangi tourne."
		},
		tour: {
			type: "integer",
			minimum: 1,
			title: "Tour en cours"
		},
		historique: {
			type: "array",
			maxItems: 500,
			items: {
				type: "object",
				additionalProperties: false,
				required: ["tour", "collecte"],
				properties: {
					tour: {
						type: "integer",
						minimum: 1,
						title: "Tour"
					},
					collecte: {
						type: "integer",
						minimum: 0,
						title: "Collecté (F CFA)"
					}
				}
			},
			description: "Ce qui a été collecté aux tours précédents."
		},
		membres: {
			type: "array",
			maxItems: 200,
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"nom",
					"aVerse",
					"aRecu",
					"estAuTour",
					"versements",
					"tours"
				],
				properties: {
					nom: {
						type: "string",
						maxLength: 40,
						title: "Nom"
					},
					tel: {
						type: "string",
						maxLength: 20,
						title: "Téléphone",
						description: "Pour la relance."
					},
					aVerse: {
						type: "boolean",
						title: "A versé sa part",
						description: "Pour le tour en cours."
					},
					aRecu: {
						type: "boolean",
						title: "A déjà reçu la cagnotte",
						description: "Dans le cycle en cours."
					},
					estAuTour: {
						type: "boolean",
						title: "Reçoit ce tour-ci"
					},
					versements: {
						type: "integer",
						minimum: 0,
						title: "Versements effectués"
					},
					tours: {
						type: "integer",
						minimum: 0,
						title: "Tours vécus"
					}
				}
			}
		}
	}
};
//#endregion
//#region ../engine/src/compute/liste.ts
function texteDe(ligne, clef) {
	const v = ligne[clef];
	return typeof v === "string" ? v : "";
}
function nombreDe(ligne, clef) {
	const v = ligne[clef];
	return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function booleenDe(ligne, clef) {
	return ligne[clef] === true;
}
/** La colonne d'identité : la première, celle qui nomme la ligne. */
function colonneIdentite(config) {
	const premiere = config.colonnes[0];
	if (premiere === void 0) throw new RangeError("liste sans colonne");
	return premiere;
}
/** La colonne bascule, s'il y en a une. Une seule par liste. */
function colonneBascule(config) {
	return config.colonnes.find((c) => c.type === "bascule") ?? null;
}
/** Les colonnes affichées à droite du nom : tout sauf l'identité et la bascule. */
function colonnesSecondaires(config) {
	return config.colonnes.slice(1).filter((c) => c.type !== "bascule");
}
/** Le total de la liste, ou `null` quand la configuration n'en prévoit pas. */
function totalListe(config, etat) {
	const total = config.total;
	if (total === void 0) return null;
	if (total.type === "somme") return etat.lignes.reduce((a, l) => a + nombreDe(l, total.clef), 0);
	return etat.lignes.reduce((a, l) => a + nombreDe(l, total.plus) - nombreDe(l, total.moins), 0);
}
/** Les index des lignes sous le seuil d'alerte. */
function lignesEnAlerte(config, etat) {
	const alerte = config.alerte;
	if (alerte === void 0) return [];
	return etat.lignes.map((l, i) => nombreDe(l, alerte.clef) <= alerte.seuil ? i : -1).filter((i) => i >= 0);
}
/** Combien de lignes sont basculées, sur combien. `null` sans colonne bascule. */
function comptageBascule(config, etat) {
	const bascule = colonneBascule(config);
	if (bascule === null) return null;
	return {
		oui: etat.lignes.filter((l) => booleenDe(l, bascule.clef)).length,
		total: etat.lignes.length
	};
}
/** Une ligne neuve, conforme aux colonnes : chaque type a sa valeur vide. */
function ligneNeuve(config) {
	const ligne = {};
	for (const c of config.colonnes) ligne[c.clef] = c.type === "texte" ? "" : c.type === "bascule" ? false : 0;
	return ligne;
}
/**
* Ajoute une ligne.
* @throws RangeError si la ligne ne porte aucune valeur — une ligne vide dans
*   un registre, c'est du bruit que personne ne relira.
*/
function ajouterLigne(config, etat, ligne) {
	if (!config.colonnes.some((c) => {
		const v = ligne[c.clef];
		return c.type === "texte" ? typeof v === "string" && v.trim() !== "" : v !== 0 && v !== false;
	})) throw new RangeError("ligne vide");
	return {
		...etat,
		lignes: [...etat.lignes, ligne]
	};
}
function retirerLigne(etat, index) {
	if (etat.lignes[index] === void 0) throw new RangeError(`aucune ligne à l'index ${index}`);
	return {
		...etat,
		lignes: etat.lignes.filter((_, i) => i !== index)
	};
}
function basculerLigne(config, etat, index) {
	const bascule = colonneBascule(config);
	if (bascule === null) throw new RangeError("cette liste n’a pas de colonne à basculer");
	if (etat.lignes[index] === void 0) throw new RangeError(`aucune ligne à l'index ${index}`);
	return {
		...etat,
		lignes: etat.lignes.map((l, i) => i === index ? {
			...l,
			[bascule.clef]: !booleenDe(l, bascule.clef)
		} : l)
	};
}
var SCHEMA_PAR_TYPE = {
	texte: (titre) => ({
		type: "string",
		maxLength: 120,
		title: titre
	}),
	montant: (titre) => ({
		type: "integer",
		minimum: 0,
		maximum: 1e9,
		title: titre
	}),
	nombre: (titre) => ({
		type: "number",
		minimum: 0,
		maximum: 1e6,
		title: titre
	}),
	bascule: (titre) => ({
		type: "boolean",
		title: titre
	})
};
/**
* Le schéma de l'état, dérivé des colonnes.
*
* C'est ce qui fait qu'ajouter une colonne à un registre ne demande **aucune**
* autre modification : le schéma suit, la validation suit, et le formulaire
* d'édition suit — il se dresse déjà à partir du schéma.
*/
function schemaListe(config, titreNom) {
	const proprietes = {};
	for (const c of config.colonnes) proprietes[c.clef] = SCHEMA_PAR_TYPE[c.type](c.titre);
	return {
		type: "object",
		additionalProperties: false,
		required: ["nom", "lignes"],
		properties: {
			nom: {
				type: "string",
				minLength: 1,
				maxLength: 60,
				title: titreNom
			},
			lignes: {
				type: "array",
				maxItems: 500,
				title: "Lignes",
				items: {
					type: "object",
					additionalProperties: false,
					required: config.colonnes.map((c) => c.clef),
					properties: proprietes
				}
			}
		}
	};
}
//#endregion
//#region ../engine/src/compute/calc.ts
/** La valeur d'une entrée, nettoyée : jamais NaN, jamais négative. */
function valeurDe(etat, clef) {
	const v = etat.valeurs[clef];
	return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}
function lecteur(etat) {
	return (clef) => valeurDe(etat, clef);
}
/** Le résultat, arrondi au franc. La formule ne voit que des nombres valides. */
function resultatCalc(config, etat) {
	const brut = config.sortie.calcul(lecteur(etat));
	return Number.isFinite(brut) ? Math.round(brut) : 0;
}
function precisionCalc(config, etat) {
	return config.sortie.precision?.(lecteur(etat)) ?? null;
}
function partCalc(config, etat) {
	const part = config.sortie.part?.(lecteur(etat));
	if (part === void 0 || part === null || !Number.isFinite(part)) return null;
	return Math.max(0, Math.min(1, part));
}
/**
* Change une entrée.
* @throws RangeError sur une valeur négative ou non finie — une calculatrice
*   qui accepte n'importe quoi rend n'importe quoi.
*/
function changerValeur(etat, clef, valeur) {
	if (!Number.isFinite(valeur) || valeur < 0) throw new RangeError(`valeur invalide pour « ${clef} » : ${valeur}`);
	return {
		...etat,
		valeurs: {
			...etat.valeurs,
			[clef]: valeur
		}
	};
}
/** L'état de départ : chaque entrée à sa valeur par défaut. */
function valeursParDefaut(config) {
	const valeurs = {};
	for (const e of config.entrees) valeurs[e.clef] = e.defaut;
	return valeurs;
}
function schemaCalc(config, titreNom) {
	const proprietes = {};
	for (const e of config.entrees) proprietes[e.clef] = {
		type: "number",
		minimum: 0,
		maximum: 1e9,
		title: e.unite === "F" ? `${e.titre} (F CFA)` : e.titre
	};
	return {
		type: "object",
		additionalProperties: false,
		required: ["nom", "valeurs"],
		properties: {
			nom: {
				type: "string",
				minLength: 1,
				maxLength: 60,
				title: titreNom
			},
			valeurs: {
				type: "object",
				additionalProperties: false,
				required: config.entrees.map((e) => e.clef),
				properties: proprietes,
				title: "Valeurs"
			}
		}
	};
}
//#endregion
//#region ../engine/src/skeletons/calc.ts
function afficher(valeur, unite) {
	return unite === "F" ? montantF(valeur) : nf(valeur);
}
function squeletteCalc(def) {
	const config = def.config;
	const card = (etat, ctx) => {
		const precision = precisionCalc(config, etat);
		return {
			kicker: config.kicker,
			title: etat.nom,
			sub: def.title,
			tag: null,
			bigLabel: config.sortie.libelle.toUpperCase(),
			big: afficher(resultatCalc(config, etat), config.sortie.unite),
			pct: partCalc(config, etat),
			subline: precision ?? def.title,
			listTitle: "CE QUI A ÉTÉ SAISI",
			items: config.entrees.map((e) => ({
				n: e.titre,
				ok: true,
				warn: false,
				val: afficher(valeurDe(etat, e.clef), e.unite)
			})),
			link: ctx.lien,
			stamp: arreteLe(ctx.maintenant)
		};
	};
	const share = (etat, ctx) => {
		const precision = precisionCalc(config, etat);
		const lignes = [
			`${etat.nom.toUpperCase()} — ${def.title.toLowerCase()}`,
			...config.entrees.map((e) => `${e.titre} : ${afficher(valeurDe(etat, e.clef), e.unite)}`),
			`${config.sortie.libelle} : ${afficher(resultatCalc(config, etat), config.sortie.unite)}`,
			precision ?? "",
			ctx.lien
		].filter((l) => l !== "");
		return {
			title: etat.nom,
			desc: `${config.sortie.libelle} : ${afficher(resultatCalc(config, etat), config.sortie.unite)}`,
			name: def.id,
			txt: lignes.join("\n"),
			broad: null,
			warn: null,
			card: card(etat, ctx),
			relances: [],
			relancesVides: def.relancesVides
		};
	};
	return {
		id: def.id,
		group: def.group,
		title: def.title,
		keywords: def.keywords,
		engine: "calc",
		config,
		schema: schemaCalc(config, def.titreNom),
		defaults: {
			nom: def.title,
			valeurs: valeursParDefaut(config)
		},
		compute: {
			resultatCalc,
			precisionCalc,
			partCalc,
			changerValeur,
			valeurDe
		},
		card,
		share
	};
}
//#endregion
//#region ../engine/src/skeletons/liste.ts
/**
* La fabrique de registres.
*
* Elle prend une configuration de colonnes et rend un squelette complet :
* schéma, calculs, carte et partage. Quatre outils du prototype en sortent sans
* une ligne de code propre — livre de caisse, inventaire, annuaire, liste de
* prix. Le cinquième qui voudra un tableau de lignes n'en demandera pas non plus.
*
* Ce qui reste spécifique à un outil ne passe pas par ici : le njangi a une
* rotation, l'ardoise a un vieillissement, la présence a une matrice. Une
* fabrique qui essaierait de les couvrir aussi serait un langage de
* programmation déguisé, et le brief en veut précisément l'inverse.
*/
/** La valeur d'une cellule, telle qu'elle s'imprime. */
function cellule(ligne, colonne) {
	switch (colonne.type) {
		case "montant": return montantF(nombreDe(ligne, colonne.clef));
		case "nombre": return nf(nombreDe(ligne, colonne.clef));
		case "bascule": return booleenDe(ligne, colonne.clef) ? "oui" : "non";
		default: return texteDe(ligne, colonne.clef);
	}
}
function grandChiffre(config, etat) {
	const compte = comptageBascule(config, etat);
	if (compte !== null) return {
		libelle: (colonneBascule(config)?.titre ?? "Disponibles").toUpperCase(),
		valeur: `${compte.oui} / ${compte.total}`,
		part: compte.total === 0 ? 0 : compte.oui / compte.total
	};
	const total = totalListe(config, etat);
	if (total !== null && config.total !== void 0) {
		const unite = config.total.type === "somme" ? config.total.unite : "F";
		return {
			libelle: config.total.libelle.toUpperCase(),
			valeur: unite === "F" ? montantF(total) : nf(total),
			part: null
		};
	}
	return {
		libelle: "LIGNES",
		valeur: nf(etat.lignes.length),
		part: null
	};
}
function items(config, etat) {
	const identite = colonneIdentite(config);
	const bascule = colonneBascule(config);
	const secondaires = colonnesSecondaires(config);
	const alertees = new Set(lignesEnAlerte(config, etat));
	return etat.lignes.map((ligne, i) => {
		const coche = bascule === null ? true : booleenDe(ligne, bascule.clef);
		const valeur = secondaires.map((c) => cellule(ligne, c)).join(" · ");
		return {
			n: cellule(ligne, identite) === "" ? "—" : cellule(ligne, identite),
			ok: coche && !alertees.has(i),
			warn: alertees.has(i) || bascule !== null && !coche,
			val: valeur === "" ? null : valeur
		};
	});
}
function sousLigne(config, etat) {
	const bouts = [`${etat.lignes.length} ligne${etat.lignes.length > 1 ? "s" : ""}`];
	const total = totalListe(config, etat);
	if (total !== null && config.total !== void 0 && comptageBascule(config, etat) !== null) bouts.push(`${config.total.libelle.toLowerCase()} ${nf(total)}`);
	const alertees = lignesEnAlerte(config, etat);
	if (alertees.length > 0 && config.alerte !== void 0) bouts.push(`${alertees.length} ${config.alerte.libelle}`);
	return bouts.join(" · ");
}
function squeletteListe(def) {
	const config = def.config;
	const card = (etat, ctx) => {
		const grand = grandChiffre(config, etat);
		return {
			kicker: config.kicker,
			title: etat.nom,
			sub: etat.nom === def.title ? "" : def.title,
			tag: null,
			bigLabel: grand.libelle,
			big: grand.valeur,
			pct: grand.part,
			subline: sousLigne(config, etat),
			listTitle: "DÉTAIL",
			items: items(config, etat),
			link: ctx.lien,
			stamp: arreteLe(ctx.maintenant)
		};
	};
	const share = (etat, ctx) => {
		const grand = grandChiffre(config, etat);
		const identite = colonneIdentite(config);
		const secondaires = colonnesSecondaires(config);
		const lignes = [
			`${etat.nom.toUpperCase()} — ${def.title.toLowerCase()}`,
			`${grand.libelle.charAt(0)}${grand.libelle.slice(1).toLowerCase()} : ${grand.valeur}`,
			...etat.lignes.slice(0, 20).map((l) => `• ${texteDe(l, identite.clef)}${secondaires.length > 0 ? ` — ${secondaires.map((c) => cellule(l, c)).join(" · ")}` : ""}`),
			etat.lignes.length > 20 ? `… et ${etat.lignes.length - 20} autres` : "",
			ctx.lien
		].filter((l) => l !== "");
		return {
			title: etat.nom,
			desc: `${def.title} · ${sousLigne(config, etat)}`,
			name: def.id,
			txt: lignes.join("\n"),
			broad: null,
			warn: config.avertissement ?? null,
			card: card(etat, ctx),
			relances: [],
			relancesVides: config.relancesVides
		};
	};
	return {
		id: def.id,
		group: def.group,
		title: def.title,
		keywords: def.keywords,
		engine: "liste",
		config,
		schema: schemaListe(config, def.titreNom),
		defaults: {
			nom: def.title,
			lignes: []
		},
		compute: {
			totalListe,
			lignesEnAlerte,
			comptageBascule,
			ligneNeuve,
			ajouterLigne,
			retirerLigne,
			basculerLigne,
			cellule
		},
		card,
		share
	};
}
//#endregion
//#region ../engine/src/compose.ts
/**
* Un outil composé par le modèle n'a pas de squelette : sa configuration
* voyage avec lui, dans l'outil enregistré. Ces deux fabriques la remontent en
* squelette complet — schéma, calculs, carte et partage.
*
* C'est la thèse du brief prise au mot (§ 2.1, § 4) : le modèle n'a produit que
* de la configuration, et c'est du code écrit à la main et éprouvé qui la
* dessine. Rien ne distingue un outil composé d'un squelette, sinon d'où vient
* sa description.
*
* Elles vivent ici, dans le moteur, et non dans le fragment qui les dessine,
* parce que **le serveur en a besoin aussi**. Tant qu'elles n'étaient que du
* côté de l'écran, la page de lecture ne trouvait rien à dessiner derrière le
* lien d'un outil composé : elle répondait 200 avec « Ce lien ne mène à rien ».
* L'outil payé était le seul qu'on ne pouvait pas partager. Deux définitions
* auraient fini par ne plus dire la même chose ; il n'y en a qu'une.
*/
function squeletteDeRegistre(registre) {
	return squeletteListe({
		id: ID_COMPOSE,
		title: registre.titre,
		group: "registres",
		keywords: [],
		titreNom: registre.titreNom,
		config: {
			kicker: registre.kicker,
			colonnes: registre.colonnes,
			libelleVide: registre.libelleVide,
			libelleAjout: registre.libelleAjout,
			relancesVides: registre.relancesVides,
			...registre.total !== void 0 ? { total: registre.total } : {},
			...registre.personnes !== void 0 ? { personnes: registre.personnes } : {}
		}
	});
}
/**
* La formule est un arbre déclaré, pas du code : `evaluer` l'interprète, et
* c'est ce qui permet au modèle de décrire un calcul sans jamais obtenir le
* droit d'en exécuter un (invariant § 2.1).
*/
function squeletteDeCalcul(demande) {
	return squeletteCalc({
		id: ID_COMPOSE_CALCUL,
		title: demande.titre,
		group: "calculs",
		keywords: [],
		titreNom: demande.titreNom,
		relancesVides: "Une calculatrice se consulte, elle ne se relance pas.",
		config: {
			kicker: demande.kicker,
			entrees: demande.entrees,
			sortie: {
				libelle: demande.sortie.libelle,
				unite: demande.sortie.unite,
				calcul: (val) => evaluer(demande.sortie.formule, val)
			}
		}
	});
}
var caisse = squeletteListe({
	id: "caisse",
	title: "Livre de caisse",
	group: "registres",
	keywords: [
		"caisse",
		"recette",
		"depense",
		"entree sortie",
		"journal",
		"argent du jour",
		"ce que j ai vendu",
		"livre de compte"
	],
	titreNom: "Nom du livre",
	config: {
		kicker: "LIVRE DE CAISSE",
		colonnes: [
			{
				clef: "libelle",
				titre: "Libellé",
				type: "texte"
			},
			{
				clef: "entree",
				titre: "Entrée (F CFA)",
				type: "montant"
			},
			{
				clef: "sortie",
				titre: "Sortie (F CFA)",
				type: "montant"
			}
		],
		total: {
			type: "difference",
			plus: "entree",
			moins: "sortie",
			libelle: "Solde"
		},
		libelleVide: "Aucune écriture pour l’instant.",
		libelleAjout: "Ajouter une écriture",
		relancesVides: "Un livre de caisse se tient, il ne se relance pas."
	}
});
var stock = squeletteListe({
	id: "stock",
	title: "Inventaire",
	group: "registres",
	keywords: [
		"stock",
		"inventaire",
		"magasin",
		"quantite",
		"marchandise",
		"ce qui me reste",
		"reappro"
	],
	titreNom: "Nom du magasin",
	config: {
		kicker: "INVENTAIRE",
		colonnes: [{
			clef: "article",
			titre: "Article",
			type: "texte"
		}, {
			clef: "reste",
			titre: "Quantité restante",
			type: "nombre"
		}],
		total: {
			type: "somme",
			clef: "reste",
			libelle: "Articles",
			unite: ""
		},
		alerte: {
			clef: "reste",
			seuil: 5,
			libelle: "à réapprovisionner"
		},
		libelleVide: "L’inventaire est vide.",
		libelleAjout: "Ajouter un article",
		relancesVides: "Un inventaire se consulte, il ne se relance pas."
	}
});
var clients = squeletteListe({
	id: "clients",
	title: "Clients",
	group: "registres",
	keywords: [
		"client",
		"contact",
		"annuaire",
		"repertoire",
		"numero",
		"carnet d adresses",
		"mes contacts"
	],
	titreNom: "Nom de la liste",
	config: {
		kicker: "ANNUAIRE",
		colonnes: [{
			clef: "nom",
			titre: "Nom",
			type: "texte"
		}, {
			clef: "tel",
			titre: "Téléphone",
			type: "texte"
		}],
		personnes: true,
		libelleVide: "Aucun contact pour l’instant.",
		libelleAjout: "Ajouter un contact",
		relancesVides: "Un annuaire ne se relance pas — ouvre plutôt une ardoise."
	}
});
var prix = squeletteListe({
	id: "prix",
	title: "Liste de prix",
	group: "registres",
	keywords: [
		"prix",
		"tarif",
		"catalogue",
		"boutique",
		"ca coute combien",
		"liste de prix",
		"ce que je vends",
		"mes articles",
		"menu"
	],
	titreNom: "Nom de la boutique",
	config: {
		kicker: "LISTE DE PRIX",
		colonnes: [
			{
				clef: "article",
				titre: "Article",
				type: "texte"
			},
			{
				clef: "prix",
				titre: "Prix (F CFA)",
				type: "montant"
			},
			{
				clef: "disponible",
				titre: "Disponible",
				type: "bascule"
			}
		],
		libelleVide: "Aucun article pour l’instant.",
		libelleAjout: "Ajouter un article",
		relancesVides: "Une liste de prix ne se relance pas, elle se diffuse. Le résumé ci-dessus est prêt à coller dans une discussion ou une liste de diffusion."
	}
});
var scolarite = squeletteCalc({
	id: "scolarite",
	title: "Frais scolaires",
	group: "calculs",
	keywords: [
		"scolarite",
		"frais",
		"ecole",
		"pension",
		"rentree",
		"inscription",
		"fournitures",
		"eleve"
	],
	titreNom: "Nom de l’élève",
	config: {
		kicker: "FRAIS SCOLAIRES",
		entrees: [{
			clef: "total",
			titre: "Total de l’année",
			defaut: 75e3,
			unite: "F"
		}, {
			clef: "verse",
			titre: "Déjà versé",
			defaut: 3e4,
			unite: "F"
		}],
		sortie: {
			libelle: "Reste à payer",
			unite: "F",
			calcul: (val) => Math.max(0, val("total") - val("verse")),
			precision: (val) => {
				const total = val("total");
				const verse = val("verse");
				if (total === 0) return null;
				if (verse > total) return `Trop versé de ${Math.round(verse - total)} F CFA.`;
				return `${Math.round(verse / total * 100)} % réglé.`;
			},
			part: (val) => val("total") === 0 ? null : val("verse") / val("total")
		}
	},
	relancesVides: "Un calcul ne se relance pas — il se montre."
});
var course = squeletteCalc({
	id: "course",
	title: "Partage de course",
	group: "calculs",
	keywords: [
		"course",
		"moto",
		"taxi",
		"partage",
		"diviser",
		"benskin",
		"chacun paye",
		"partager la note",
		"addition"
	],
	titreNom: "Nom du trajet",
	config: {
		kicker: "PARTAGE DE COURSE",
		entrees: [{
			clef: "montant",
			titre: "Montant de la course",
			defaut: 3e3,
			unite: "F"
		}, {
			clef: "personnes",
			titre: "Nombre de personnes",
			defaut: 4,
			unite: ""
		}],
		sortie: {
			libelle: "Part de chacun",
			unite: "F",
			calcul: (val) => {
				const personnes = Math.floor(val("personnes"));
				return personnes <= 0 ? 0 : Math.ceil(val("montant") / personnes);
			},
			precision: (val) => {
				const personnes = Math.floor(val("personnes"));
				if (personnes <= 0) return "Indique combien vous êtes.";
				const ecart = Math.ceil(val("montant") / personnes) * personnes - val("montant");
				return ecart > 0 ? `${Math.round(ecart)} F de plus que la course, arrondi compris.` : null;
			}
		}
	},
	relancesVides: "Un calcul ne se relance pas — il se montre."
});
//#endregion
//#region ../engine/src/skeletons/devis.ts
/** Préfixe de numérotation du devis. La facture prendra `FA`. */
var PREFIXE_DEVIS = PREFIXES_NUMERO.devis;
/**
* État de remplissage d'un devis neuf.
*
* L'émetteur est vide : on ne livre pas à tout le monde la raison sociale d'une
* quincaillerie de Bépanda parce qu'elle sert d'exemple dans le prototype.
* `numero` et `emisLe` sont des valeurs de remplissage conformes au schéma, que
* `initialiser` remplace à la création.
*/
var defaults$2 = {
	nom: "Devis",
	encre: "encre",
	numero: "DV-2026-0001",
	emisLe: "2026-01-01T00:00:00.000Z",
	emetteur: {
		nom: "",
		forme: "",
		activite: "",
		adresse: "",
		tel: "",
		mail: "",
		rccm: "",
		niu: "",
		centre: ""
	},
	client: {
		nom: "",
		niu: "",
		estEntreprise: false
	},
	validite: "15 jours",
	acompte: 50,
	lignes: []
};
function devisCard(etat, ctx) {
	const c = chiffrer(etat);
	return {
		kicker: "DEVIS",
		title: etat.client.nom === "" ? etat.nom : etat.client.nom,
		sub: `N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`,
		tag: null,
		bigLabel: "TOTAL TTC",
		big: montantF(c.totalTTC),
		pct: null,
		subline: `HT ${montantF(c.totalHT)} · TVA 19,25 % ${montantF(c.totalTVA)} · validité ${etat.validite}`,
		listTitle: "DÉTAIL",
		items: c.lignes.map((l) => ({
			n: l.quantite === 1 ? l.designation : `${l.designation} × ${nf(l.quantite)}`,
			ok: true,
			warn: false,
			val: montantF(l.montantTTC)
		})),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function devisShare(etat, ctx) {
	const c = chiffrer(etat);
	const bloquants = controleLegal(etat).filter((m) => m.gravite === "bloquant");
	const lignes = [
		`DEVIS N° ${etat.numero}`,
		etat.emetteur.nom,
		`Client : ${etat.client.nom}`,
		`Total TTC : ${montantF(c.totalTTC)} (dont TVA 19,25 % : ${montantF(c.totalTVA)})`,
		etat.acompte > 0 ? `Acompte à la commande : ${etat.acompte} % — ${montantF(c.acompteDu)}` : null,
		`Validité : ${etat.validite}`,
		ctx.lien
	].filter((l) => l !== null && l !== "");
	return {
		title: `Devis ${etat.numero}`,
		desc: `${etat.client.nom} · ${montantF(c.totalTTC)} TTC · validité ${etat.validite}`,
		name: `devis-${etat.numero.toLowerCase()}`,
		txt: lignes.join("\n"),
		broad: null,
		warn: bloquants.length > 0 ? `Ce devis n'est pas complet : il manque ${bloquants.map((m) => m.libelle).join(", ")}. Sans ces mentions, un client qui veut déduire ne pourra pas s'en servir.` : null,
		card: devisCard(etat, ctx),
		relances: etat.client.nom === "" ? [] : [{
			nom: etat.client.nom,
			tel: etat.client.tel ?? null,
			message: `Bonjour. Voici le devis N° ${etat.numero} de ${etat.emetteur.nom} : ${montantF(c.totalTTC)} TTC, valable ${etat.validite}.` + (ctx.lien === "" ? "" : ` Le détail est ici : ${ctx.lien}`)
		}],
		relancesVides: "Renseigne le client pour préparer l’envoi."
	};
}
/**
* Un devis ne retient que l'acompte.
*
* Une somme dans « devis de 250 000 F » ne dit pas ce qu'elle est : un total
* annoncé, une ligne, un budget à ne pas dépasser. L'écrire dans le document
* serait inventer une ligne que personne n'a chiffrée. « Acompte de 30 % »,
* en revanche, ne veut dire qu'une chose.
*/
function garnir$1(etat, extrait) {
	return extrait.pourcent === null ? etat : {
		...etat,
		acompte: extrait.pourcent
	};
}
var devis = {
	id: "devis",
	group: "documents",
	title: "Devis",
	keywords: [
		"devis",
		"proposition",
		"chiffrage",
		"estimation",
		"cotation",
		"pro forma",
		"proforma",
		"offre de prix",
		"ca va couter"
	],
	engine: "doc",
	schema: devisSchema,
	defaults: defaults$2,
	initialiser: (ctx) => ({
		...defaults$2,
		numero: prochainNumero(PREFIXE_DEVIS, [], ctx.maintenant),
		emisLe: ctx.maintenant.toISOString()
	}),
	compute: {
		chiffrer,
		controleLegal,
		dateEmission,
		prochainNumero,
		piedLegal
	},
	garnir: garnir$1,
	card: devisCard,
	share: devisShare
};
//#endregion
//#region ../engine/src/skeletons/facture.ts
/** Préfixe de numérotation de la facture. Le devis prend `DV`. */
var PREFIXE_FACTURE = PREFIXES_NUMERO.facture;
var TAG$1 = {
	soldee: "SOLDÉE",
	"en-retard": "EN RETARD",
	partielle: "PARTIELLE",
	"a-payer": "À PAYER"
};
/**
* État d'une facture neuve.
*
* `echeance` vaut la date d'émission : **payable à réception**. On ne met pas
* trente jours par défaut — c'est une convention commerciale française, pas une
* règle camerounaise, et le brief interdit d'inventer un délai (§ 9).
* L'utilisateur fixe la sienne.
*/
var defaults$1 = {
	nom: "Facture",
	encre: "encre",
	numero: "FA-2026-0001",
	emisLe: "2026-01-01T00:00:00.000Z",
	echeance: "2026-01-01T00:00:00.000Z",
	emetteur: {
		nom: "",
		forme: "",
		activite: "",
		adresse: "",
		tel: "",
		mail: "",
		rccm: "",
		niu: "",
		centre: ""
	},
	client: {
		nom: "",
		niu: "",
		estEntreprise: false
	},
	conditionsReglement: "",
	lignes: [],
	reglements: []
};
function factureCard(etat, ctx) {
	const c = chiffrerFacture(etat);
	const statut = statutFacture(etat, ctx.maintenant);
	const retard = joursDeRetard(etat, ctx.maintenant);
	const details = [
		`Total TTC ${montantF(c.totalTTC)}`,
		c.verse > 0 ? `versé ${montantF(c.verse)}` : null,
		statut === "soldee" ? "soldée" : retard > 0 ? `${retard} jour${retard > 1 ? "s" : ""} de retard` : `échéance ${dateLongue(dateEcheance(etat))}`
	].filter((d) => d !== null);
	return {
		kicker: "FACTURE",
		title: etat.client.nom === "" ? etat.nom : etat.client.nom,
		sub: `N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`,
		tag: TAG$1[statut] ?? null,
		bigLabel: statut === "soldee" ? "FACTURE RÉGLÉE" : "RESTE À PAYER",
		big: montantF(c.reste),
		pct: c.partReglee,
		subline: details.join(" · "),
		listTitle: "DÉTAIL",
		items: c.lignes.map((l) => ({
			n: l.quantite === 1 ? l.designation : `${l.designation} × ${nf(l.quantite)}`,
			ok: true,
			warn: false,
			val: montantF(l.montantTTC)
		})),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function factureShare(etat, ctx) {
	const c = chiffrerFacture(etat);
	const statut = statutFacture(etat, ctx.maintenant);
	const retard = joursDeRetard(etat, ctx.maintenant);
	const echeance = dateLongue(dateEcheance(etat));
	const bloquants = controleLegal(etat).filter((m) => m.gravite === "bloquant");
	const lignes = [
		`FACTURE N° ${etat.numero}`,
		etat.emetteur.nom,
		`Client : ${etat.client.nom}`,
		`Total TTC : ${montantF(c.totalTTC)} (dont TVA 19,25 % : ${montantF(c.totalTVA)})`,
		c.verse > 0 ? `Déjà réglé : ${montantF(c.verse)}` : null,
		c.estSoldee ? "Facture soldée — merci." : `Reste à payer : ${montantF(c.reste)}`,
		c.estSoldee ? null : `Échéance : ${echeance}`,
		etat.conditionsReglement === "" ? null : etat.conditionsReglement,
		ctx.lien
	].filter((l) => l !== null && l !== "");
	const detail = ctx.lien === "" ? "" : ` Le détail est ici : ${ctx.lien}`;
	const message = retard > 0 ? `Bonjour. La facture N° ${etat.numero} de ${etat.emetteur.nom}, de ${montantF(c.reste)}, était à régler le ${echeance}.${detail}` : `Bonjour. Voici la facture N° ${etat.numero} de ${etat.emetteur.nom} : ${montantF(c.reste)} à régler pour le ${echeance}.${detail}`;
	return {
		title: `Facture ${etat.numero}`,
		desc: c.estSoldee ? `${etat.client.nom} · ${montantF(c.totalTTC)} TTC · soldée` : `${etat.client.nom} · reste ${montantF(c.reste)} sur ${montantF(c.totalTTC)} TTC · ${LIBELLE_STATUT[statut].toLowerCase()}`,
		name: `facture-${etat.numero.toLowerCase()}`,
		txt: lignes.join("\n"),
		broad: null,
		warn: bloquants.length > 0 ? `Cette facture n'est pas complète : il manque ${bloquants.map((m) => m.libelle).join(", ")}. Sans ces mentions, ton client ne pourra pas la déduire, et elle ne tiendra pas devant un contrôle.` : null,
		card: factureCard(etat, ctx),
		relances: c.estSoldee || etat.client.nom === "" ? [] : [{
			nom: etat.client.nom,
			tel: etat.client.tel ?? null,
			message
		}],
		relancesVides: c.estSoldee ? "Facture soldée — rien à relancer." : "Renseigne le client pour préparer l’envoi."
	};
}
var facture = {
	id: "facture",
	group: "documents",
	title: "Facture",
	keywords: [
		"facture",
		"facturation",
		"note a payer",
		"impaye",
		"creance",
		"facturer",
		"reclamer mon argent",
		"doit me payer"
	],
	engine: "doc",
	schema: factureSchema,
	defaults: defaults$1,
	initialiser: (ctx) => ({
		...defaults$1,
		numero: prochainNumero(PREFIXE_FACTURE, [], ctx.maintenant),
		emisLe: ctx.maintenant.toISOString(),
		echeance: ctx.maintenant.toISOString()
	}),
	compute: {
		chiffrerFacture,
		statutFacture,
		joursDeRetard,
		controleLegal,
		dateEmission,
		dateEcheance,
		prochainNumero,
		piedLegal
	},
	card: factureCard,
	share: factureShare
};
//#endregion
//#region ../engine/src/skeletons/njangi.ts
var LIBELLE = {
	semaine: "semaine",
	quinzaine: "quinzaine",
	mois: "mois"
};
var TAG = {
	semaine: "S",
	quinzaine: "Q",
	mois: "M"
};
var BIG_LABEL = {
	semaine: "COLLECTÉ CETTE SEMAINE",
	quinzaine: "COLLECTÉ CETTE QUINZAINE",
	mois: "COLLECTÉ CE MOIS"
};
var defaults = {
	nom: "Njangi",
	cotisation: 5e3,
	periode: "semaine",
	tour: 1,
	historique: [],
	membres: []
};
function njangiCard(etat, ctx) {
	const c = collecte(etat);
	return {
		kicker: "CARNET DE NJANGI",
		title: etat.nom,
		sub: `Cotisation ${montantF(etat.cotisation)} · ${c.nbMembres} membre${c.nbMembres > 1 ? "s" : ""}`,
		tag: `${TAG[etat.periode]}${etat.tour}`,
		bigLabel: BIG_LABEL[etat.periode],
		big: montantF(c.collecte),
		pct: c.taux,
		subline: `${c.nbVerse} sur ${c.nbMembres} ont versé · reste ${montantF(c.reste)}`,
		listTitle: "ÉTAT DES VERSEMENTS",
		items: etat.membres.map((m) => ({
			n: m.nom + (m.estAuTour ? " — reçoit ce tour" : ""),
			ok: m.aVerse,
			warn: !m.aVerse,
			val: m.aVerse ? montantF(etat.cotisation) : "—"
		})),
		link: ctx.lien,
		stamp: arreteLe(ctx.maintenant)
	};
}
function njangiShare(etat, ctx) {
	const c = collecte(etat);
	const tour = beneficiaireDuTour(etat);
	const periode = `${LIBELLE[etat.periode]} ${etat.tour}`;
	const lignes = [
		`${etat.nom.toUpperCase()} — ${periode}`,
		`Collecté : ${montantF(c.collecte)} sur ${montantF(c.attendu)}`,
		`Tour : ${tour?.nom ?? "—"}`,
		c.retardataires.length > 0 ? `En attente : ${c.retardataires.map((m) => m.nom).join(", ")}` : "Personne en retard",
		ctx.lien
	].filter((l) => l !== "");
	const relances = c.retardataires.map((m) => ({
		nom: m.nom,
		tel: m.tel ?? null,
		message: `Bonjour ${m.nom}. Njangi ${etat.nom}, ${periode} : ta part de ${montantF(etat.cotisation)} n'est pas encore enregistrée. ` + (ctx.lien === "" ? "" : `L'état du carnet est ici : ${ctx.lien} — `) + `merci de régulariser dès que possible.`
	}));
	return {
		title: etat.nom,
		desc: `${periode.charAt(0).toUpperCase()}${periode.slice(1)} · ${c.nbVerse} sur ${c.nbMembres} ont versé · reste ${montantF(c.reste)}`,
		name: `njangi-${TAG[etat.periode].toLowerCase()}${etat.tour}`,
		txt: lignes.join("\n"),
		broad: null,
		warn: null,
		card: njangiCard(etat, ctx),
		relances,
		relancesVides: "Personne à relancer — tout le monde est à jour."
	};
}
/**
* Ce qu'un njangi retient de la phrase qui l'a ouvert.
*
* La cotisation d'abord parmi les sommes marquées — « 20 000 F ». À défaut,
* un nombre nu, mais seulement au-dessus de cent : dans « njangi à 8 personnes
* de 20 000 », 8 est un effectif et 20 000 une cotisation, et c'est l'ordre de
* grandeur qui les sépare quand la monnaie n'est pas écrite. Une cotisation de
* huit francs n'existe pas ; un njangi de huit membres, si.
*/
function garnir(etat, extrait) {
	const cotisation = extrait.montants[0] ?? extrait.nombres.filter((n) => n >= 100)[0] ?? null;
	return {
		...etat,
		...cotisation !== null ? { cotisation } : {},
		...extrait.periode !== null ? { periode: extrait.periode } : {}
	};
}
//#endregion
//#region ../engine/src/skeletons/index.ts
/**
* Le registre des squelettes.
*
* Dix-sept écrits sur dix-sept — le catalogue du brief est complet. Six d'entre eux ne portent aucune logique propre :
* prix, caisse, stock et clients sont de la configuration posée sur la fabrique
* de listes ; scolarité et course, sur celle des calculatrices. Les quatre
* actes — attestation, reçu, reconnaissance de dette, lettre de motivation —
* partagent le papier des documents d'affaires sans en partager la fiscalité.
* Le CV, lui, ne partage même pas le papier : c'est le seul document où la
* mise en page est l'enjeu, et il en porte quatre.
*
* L'ordre est celui de l'écran d'accueil : les documents, puis les registres,
* puis les calculs.
*/
var SQUELETTES = [
	devis,
	facture,
	attestation,
	recu,
	dette,
	motivation,
	cv,
	{
		id: "njangi",
		group: "registres",
		title: "Carnet de njangi",
		keywords: [
			"njangi",
			"djangi",
			"tontine",
			"cotis",
			"tour",
			"membre",
			"cagnotte",
			"epargne",
			"association",
			"reunion"
		],
		engine: "registre",
		schema: njangiSchema,
		defaults,
		compute: {
			collecte,
			fiabilite,
			estFiable,
			classementFiabilite,
			beneficiaireDuTour,
			prochainTour,
			basculerVersement,
			ajouterMembre,
			retirerMembre,
			changerCotisation
		},
		garnir,
		card: njangiCard,
		share: njangiShare
	},
	prix,
	caisse,
	stock,
	clients,
	ardoise,
	presence,
	scolarite,
	course,
	callbox
];
function squeletteParId(id) {
	return SQUELETTES.find((s) => s.id === id) ?? null;
}
//#endregion
//#region ../comptes/src/identite.ts
function hex(octets) {
	return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}
/** Ce que le serveur range à la place du jeton. */
async function empreinte(secret) {
	const condense = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
	return hex(new Uint8Array(condense));
}
//#endregion
//#region ../comptes/src/reponses.ts
/** Combien de réponses ce formulaire a déjà reçues. */
async function combienDeReponses(db, lien) {
	return (await db.prepare("SELECT COUNT(*) AS n FROM reponses WHERE lien = ?").bind(lien).first())?.n ?? 0;
}
async function tropTot(db, lien, source, maintenant) {
	const ligne = await db.prepare("SELECT recu_le FROM reponses WHERE lien = ? AND source = ? ORDER BY recu_le DESC LIMIT 1").bind(lien, source).first();
	return ligne !== null && maintenant.getTime() - ligne.recu_le < 3e4;
}
async function rangerReponse(db, reponse, maintenant) {
	await db.prepare("INSERT INTO reponses (id, lien, contenu, source, recu_le) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), reponse.lien, JSON.stringify(reponse.contenu), reponse.source, maintenant.getTime()).run();
}
/**
* L'empreinte d'une adresse, salée par le lien.
*
* Salée, parce que sans sel la même adresse donne la même empreinte sur tous
* les formulaires : on saurait alors qu'une même personne a répondu à celui de
* la tontine et à celui du lycée. Le lien lui-même fait le sel — il est déjà
* secret, et il change d'un formulaire à l'autre.
*/
async function empreinteSource(lien, adresse) {
	return adresse === null || adresse === "" ? null : empreinte(`${lien}:${adresse}`);
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
//#region ../../node_modules/.pnpm/preact@10.29.8_preact-render-to-string@6.7.0/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
var f$1 = 0;
Array.isArray;
function u$1(e, t, n, o, i, u) {
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
		__v: --f$1,
		__i: -1,
		__u: 0,
		__source: i,
		__self: u
	};
	if ("function" == typeof e && (a = e.defaultProps)) for (c in a) void 0 === p[c] && (p[c] = a[c]);
	return l$1.vnode && l$1.vnode(l), l;
}
//#endregion
//#region ../render/src/page/formulaire.tsx
/**
* Un formulaire composé, dessiné à la main.
*
* **Aucun script.** Ce n'est pas une prouesse, c'est la seule façon que ça
* marche : sur un téléphone d'entrée de gamme, dans le navigateur intégré de
* WhatsApp, sur une connexion qui hoquette, un formulaire qui dépend de
* JavaScript est un formulaire qui perd des réponses sans que personne ne le
* sache. Le navigateur sait poster un `<form>` depuis 1995, et il le fait même
* quand la page n'a pas fini de charger.
*
* Le même composant sert l'aperçu dans l'application et la page publiée. Dans
* l'aperçu il ne poste nulle part — `action` est vide et les champs sont
* inertes — mais il montre exactement ce qu'un visiteur verra. Un aperçu qui
* ressemble n'est pas un aperçu.
*/
/**
* Le champ que personne ne doit remplir.
*
* Un robot qui remplit tout ce qu'il trouve remplit aussi celui-là, et sa
* réponse part à la poubelle. C'est la seule défense qui ne demande rien à
* l'utilisateur : pas d'image à déchiffrer, pas de case « je ne suis pas un
* robot » qui charge trois cents kilo-octets de script.
*
* Il est caché par le style et non par `type="hidden"` : un champ caché de
* type `hidden` se repère, un champ de texte hors écran se remplit.
*/
var CHAMP_PIEGE = "ne_rien_ecrire_ici";
function Champ(props) {
	const c = props.champ;
	const id = `f-${c.clef}`;
	const commun = {
		id,
		name: c.clef,
		required: c.obligatoire === true,
		...props.inerte ? { disabled: true } : {}
	};
	return /* @__PURE__ */ u$1("label", {
		class: "form-champ",
		for: id,
		children: [
			/* @__PURE__ */ u$1("span", {
				class: "form-question",
				children: [c.titre, c.obligatoire === true && /* @__PURE__ */ u$1("i", {
					"aria-hidden": "true",
					children: " *"
				})]
			}),
			c.sorte === "paragraphe" && /* @__PURE__ */ u$1("textarea", {
				...commun,
				rows: 3,
				maxLength: 1e3
			}),
			c.sorte === "choix" && /* @__PURE__ */ u$1("select", {
				...commun,
				children: [/* @__PURE__ */ u$1("option", {
					value: "",
					children: "—"
				}), (c.options ?? []).map((o) => /* @__PURE__ */ u$1("option", {
					value: o,
					children: o
				}, o))]
			}),
			c.sorte === "oui-non" && /* @__PURE__ */ u$1("input", {
				...commun,
				type: "checkbox",
				value: "oui"
			}),
			c.sorte === "nombre" && /* @__PURE__ */ u$1("input", {
				...commun,
				type: "text",
				inputMode: "decimal"
			}),
			c.sorte === "telephone" && /* @__PURE__ */ u$1("input", {
				...commun,
				type: "tel",
				inputMode: "tel",
				autocomplete: "tel",
				maxLength: 200
			}),
			c.sorte === "texte" && /* @__PURE__ */ u$1("input", {
				...commun,
				type: "text",
				maxLength: 200
			}),
			c.aide !== void 0 && c.aide !== "" && /* @__PURE__ */ u$1("span", {
				class: "form-aide",
				children: c.aide
			})
		]
	});
}
function PageFormulaire(props) {
	const f = props.formulaire;
	const inerte = props.action === void 0 || props.action === "";
	const manques = props.manques ?? [];
	return /* @__PURE__ */ u$1("article", {
		class: "vitrine form",
		children: [/* @__PURE__ */ u$1("header", {
			class: "vitrine-tete",
			children: [
				/* @__PURE__ */ u$1("p", {
					class: "kicker",
					children: f.kicker
				}),
				/* @__PURE__ */ u$1("h1", { children: f.titre }),
				/* @__PURE__ */ u$1("p", {
					class: "accroche",
					children: f.accroche
				})
			]
		}), props.ferme === true ? /* @__PURE__ */ u$1("p", {
			class: "form-clos",
			children: "Ce formulaire ne prend plus de réponses. Écris directement à la personne qui te l’a envoyé."
		}) : /* @__PURE__ */ u$1("form", {
			class: "form-corps",
			method: "post",
			action: props.action ?? "",
			children: [
				manques.length > 0 && /* @__PURE__ */ u$1("p", {
					class: "form-manque",
					role: "alert",
					children: [
						"Il manque ",
						manques.join(", "),
						"."
					]
				}),
				f.champs.map((c) => /* @__PURE__ */ u$1(Champ, {
					champ: c,
					inerte
				}, c.clef)),
				/* @__PURE__ */ u$1("label", {
					class: "form-piege",
					for: `f-${CHAMP_PIEGE}`,
					"aria-hidden": "true",
					children: ["Laisse ce champ vide", /* @__PURE__ */ u$1("input", {
						id: `f-${CHAMP_PIEGE}`,
						type: "text",
						name: CHAMP_PIEGE,
						tabIndex: -1,
						autocomplete: "off"
					})]
				}),
				/* @__PURE__ */ u$1("button", {
					type: "submit",
					class: "form-envoyer",
					disabled: inerte,
					children: f.bouton
				})
			]
		})]
	});
}
/**
* Ce qu'on lit une fois la réponse partie.
*
* Une page à part, servie après une redirection, et non le même document avec
* un message en haut : rafraîchir après un `POST` renvoie la même réponse une
* deuxième fois, et personne ne le sait avant de compter les commandes.
*/
function PageMerci(props) {
	return /* @__PURE__ */ u$1("article", {
		class: "vitrine form",
		children: [/* @__PURE__ */ u$1("header", {
			class: "vitrine-tete",
			children: [/* @__PURE__ */ u$1("p", {
				class: "kicker",
				children: props.formulaire.kicker
			}), /* @__PURE__ */ u$1("h1", { children: props.formulaire.titre })]
		}), /* @__PURE__ */ u$1("p", {
			class: "form-merci",
			children: props.formulaire.merci
		})]
	});
}
//#endregion
//#region ../render/src/page/vitrine.tsx
/**
* Une page composée, dessinée à la main.
*
* C'est le même composant qui sert l'aperçu dans l'application et la page
* publiée sur le serveur. Deux dessins pour une même configuration finiraient
* par ne plus montrer la même chose, et c'est celui que le client voit qui
* aurait tort.
*
* Il n'y a **aucun script** : ni ici, ni dans ce que le modèle a le droit
* d'écrire. Une page composée ne peut pas en contenir, parce qu'aucun champ du
* contrat n'en accepte — l'invariant § 2.1 tient par la forme du contrat, pas
* par un filtre qu'on pourrait oublier.
*/
function Lignes$1(props) {
	const lignes = props.section.lignes ?? [];
	return /* @__PURE__ */ u$1("ul", {
		class: props.section.sorte === "prix" ? "vitrine-prix" : "vitrine-liste",
		children: lignes.map((l) => /* @__PURE__ */ u$1("li", { children: [/* @__PURE__ */ u$1("span", {
			class: "quoi",
			children: [/* @__PURE__ */ u$1("b", { children: l.nom }), l.detail !== void 0 && l.detail !== "" && /* @__PURE__ */ u$1("span", {
				class: "detail",
				children: l.detail
			})]
		}), l.valeur !== void 0 && l.valeur !== "" && /* @__PURE__ */ u$1("span", {
			class: "combien",
			children: l.valeur
		})] }, l.nom))
	});
}
function PageVitrine(props) {
	const p = props.page;
	const jour = p.date === void 0 ? null : direLeJour(p.date, props.maintenant);
	const sections = sectionsAncrees(p.sections);
	const sommaire = avecSommaire(p);
	const message = `Bonjour ${p.titre}, j’ai vu votre page.`;
	const whatsapp = p.telephone === void 0 || p.telephone === "" ? null : lienWhatsApp(p.telephone, message);
	return /* @__PURE__ */ u$1("article", {
		class: "vitrine",
		children: [
			/* @__PURE__ */ u$1("header", {
				class: "vitrine-tete",
				children: [
					/* @__PURE__ */ u$1("p", {
						class: "kicker",
						children: p.kicker
					}),
					/* @__PURE__ */ u$1("h1", { children: p.titre }),
					/* @__PURE__ */ u$1("p", {
						class: "accroche",
						children: p.accroche
					})
				]
			}),
			jour !== null && /* @__PURE__ */ u$1("p", {
				class: jour.passe ? "vitrine-jour passe" : "vitrine-jour",
				children: [/* @__PURE__ */ u$1("b", { children: jour.delai }), /* @__PURE__ */ u$1("span", { children: [jour.quand, jour.heure === "" ? "" : ` ${jour.heure}`] })]
			}),
			sommaire && /* @__PURE__ */ u$1("nav", {
				class: "vitrine-sommaire",
				"aria-label": "Sections",
				children: sections.map(({ section, ancre }) => /* @__PURE__ */ u$1("a", {
					href: `#${ancre}`,
					children: section.titre
				}, ancre))
			}),
			sections.map(({ section, ancre }) => /* @__PURE__ */ u$1("section", {
				class: "vitrine-section",
				id: sommaire ? ancre : void 0,
				children: [/* @__PURE__ */ u$1("h2", { children: section.titre }), section.sorte === "texte" ? (section.texte ?? "").split("\n").filter((bout) => bout.trim() !== "").map((bout) => /* @__PURE__ */ u$1("p", { children: bout }, bout)) : /* @__PURE__ */ u$1(Lignes$1, { section })]
			}, ancre)),
			(whatsapp !== null || p.adresse !== void 0 && p.adresse !== "" || p.horaires !== void 0 && p.horaires !== "") && /* @__PURE__ */ u$1("footer", {
				class: "vitrine-pied",
				children: [
					whatsapp !== null && /* @__PURE__ */ u$1("a", {
						class: "vitrine-appel",
						href: whatsapp,
						rel: "noreferrer",
						children: ["Écrire sur WhatsApp", /* @__PURE__ */ u$1("span", { children: numeroLisible(p.telephone ?? "") })]
					}),
					p.adresse !== void 0 && p.adresse !== "" && /* @__PURE__ */ u$1("p", {
						class: "vitrine-ou",
						children: [/* @__PURE__ */ u$1("span", {
							class: "etiquette",
							children: "Où"
						}), p.adresse]
					}),
					p.horaires !== void 0 && p.horaires !== "" && /* @__PURE__ */ u$1("p", {
						class: "vitrine-ou",
						children: [/* @__PURE__ */ u$1("span", {
							class: "etiquette",
							children: "Quand"
						}), p.horaires]
					})
				]
			})
		]
	});
}
//#endregion
//#region ../../node_modules/.pnpm/preact-render-to-string@6.7.0_preact@10.29.8/node_modules/preact-render-to-string/dist/index.module.js
var r = "diffed";
var o = "__c";
var i = "__s";
var a = "__c";
var c = "__k";
var u = "__d";
var s = "__s";
var l = /[\s\n\\/='"\0<>]/;
var f = /^(xlink|xmlns|xml)([A-Z])/;
var p = /^(?:accessK|auto[A-Z]|cell|ch|col|cont|cross|dateT|encT|form[A-Z]|frame|hrefL|inputM|maxL|minL|noV|playsI|popoverT|readO|rowS|src[A-Z]|tabI|useM|item[A-Z])/;
var h = /^ac|^ali|arabic|basel|cap|clipPath$|clipRule$|color|dominant|enable|fill|flood|font|glyph[^R]|horiz|image|letter|lighting|marker[^WUH]|overline|panose|pointe|paint|rendering|shape|stop|strikethrough|stroke|text[^L]|transform|underline|unicode|units|^v[^i]|^w|^xH/;
var d = /* @__PURE__ */ new Set(["draggable", "spellcheck"]);
function v(e) {
	void 0 !== e.__g ? e.__g |= 8 : e[u] = !0;
}
function m(e) {
	void 0 !== e.__g ? e.__g &= -9 : e[u] = !1;
}
function y(e) {
	return void 0 !== e.__g ? !!(8 & e.__g) : !0 === e[u];
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
	var l = l$1[i];
	l$1[i] = !0, D = l$1.__b, P = l$1[r], $ = l$1.__r, U = l$1.unmount;
	var f = k$1(S, null);
	f[c] = [a];
	try {
		var p = R(a, u || F, !1, void 0, f, !1, s);
		return W(p) ? p.join(H) : p;
	} catch (e) {
		if (e.then) throw new Error("Use \"renderToStringAsync\" for suspenseful rendering.");
		throw e;
	} finally {
		l$1[o] && l$1[o](a, M), l$1[i] = l, M.length = 0;
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
					f.test(ue) ? ue = ue.replace(f, "$1:$2").toLowerCase() : "-" !== ue[4] && !d.has(ue) || null == se ? o ? h.test(ue) && (ue = "panose1" === ue ? "panose-1" : ue.replace(/([A-Z])/g, "-$1").toLowerCase()) : p.test(ue) && (ue = ue.toLowerCase()) : se += H;
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
var a4_default$1 = "/*\n * Feuille A4 réelle, en millimètres.\n *\n * Le prototype dessinait un aperçu à l'échelle, en pixels minuscules (7,4 px\n * pour le corps de texte). Ça se voit à l'écran et ça s'imprime n'importe\n * comment. Ici la page fait ses 210 × 297 mm et le texte ses points : on rend à\n * la taille vraie, et c'est l'aperçu qui est mis à l'échelle par --echelle.\n *\n * **Cette feuille ignore le thème sombre, et c'est voulu** : un devis part à\n * l'impression et chez un client. Il est blanc chez tout le monde. Elle ne lit\n * donc aucun jeton de l'interface et se suffit à elle-même.\n *\n * Aucune police web : on prend ce que le téléphone a déjà (invariant § 2.6).\n */\n\n.a4-cadre {\n  --echelle: 1;\n  width: calc(210mm * var(--echelle));\n  overflow: hidden;\n}\n\n.a4-cadre > .a4 {\n  transform: scale(var(--echelle));\n  transform-origin: top left;\n  margin-bottom: calc((297mm * var(--echelle)) - 297mm);\n  box-shadow: 0 2px 18px rgb(18 23 16 / 12%);\n}\n\n.a4 {\n  --pa: #1f2a44;\n  --trait: #d7dce1;\n  --trait-fort: #aeb6bd;\n  --gris: #4e575e;\n  --gris-clair: #7b848b;\n\n  box-sizing: border-box;\n  position: relative;\n  width: 210mm;\n  min-height: 297mm;\n  padding: 15mm 16mm 20mm;\n  background: #fff;\n  color: #16191c;\n  font: 9.5pt/1.5 system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n  font-variant-numeric: tabular-nums lining-nums;\n  /* Les aplats d'accent doivent sortir de l'imprimante, pas être « économisés ». */\n  print-color-adjust: exact;\n  -webkit-print-color-adjust: exact;\n}\n\n.a4 * {\n  box-sizing: border-box;\n}\n\n/* ─────────────────────────────── entête ─────────────────────────────── */\n\n.a4-entete {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 10mm;\n  padding-bottom: 3.5mm;\n  border-bottom: 0.7mm solid var(--pa);\n}\n\n.a4-entete .raison {\n  font-size: 14pt;\n  font-weight: 700;\n  line-height: 1.15;\n  letter-spacing: -0.01em;\n  color: var(--pa);\n}\n\n.a4-entete .coordonnees,\n.a4-entete .immat {\n  margin-top: 1.5mm;\n  font-size: 8pt;\n  line-height: 1.55;\n  color: var(--gris);\n}\n\n.a4-entete .immat {\n  text-align: right;\n  white-space: nowrap;\n}\n\n/* ─────────────────────────────── titre ─────────────────────────────── */\n\n.a4-titre {\n  margin: 9mm 0 0;\n  font-size: 22pt;\n  font-weight: 700;\n  line-height: 1;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--pa);\n}\n\n.a4-sous-titre {\n  margin-top: 2mm;\n  font-size: 9pt;\n  color: var(--gris);\n}\n\n.a4-bloc-client {\n  margin-top: 7mm;\n  padding: 3.5mm 4mm;\n  border: 0.25mm solid var(--trait);\n  border-left: 1.2mm solid var(--pa);\n  border-radius: 0 1mm 1mm 0;\n  background: #fbfcfd;\n  font-size: 9pt;\n  line-height: 1.55;\n}\n\n.a4-bloc-client .etiquette {\n  margin-bottom: 0.8mm;\n  font-size: 7.5pt;\n  font-weight: 700;\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  color: var(--gris-clair);\n}\n\n/* ─────────────────────────────── tableau ─────────────────────────────── */\n\n.a4-tableau {\n  width: 100%;\n  margin-top: 7mm;\n  border-collapse: collapse;\n  font-size: 8.5pt;\n}\n\n.a4-tableau th {\n  padding: 2.4mm 2mm;\n  border-bottom: 0.6mm solid var(--pa);\n  font-size: 7.5pt;\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  text-align: left;\n  color: var(--pa);\n  white-space: nowrap;\n}\n\n.a4-tableau td {\n  padding: 2.4mm 2mm;\n  border-bottom: 0.2mm solid var(--trait);\n  vertical-align: top;\n}\n\n/* Une ligne de facture ne se coupe pas au milieu par un saut de page. */\n.a4-tableau tr {\n  break-inside: avoid;\n}\n\n.a4-tableau .nombre {\n  text-align: right;\n  white-space: nowrap;\n}\n\n.a4-tableau tbody tr:last-child td {\n  border-bottom: 0.4mm solid var(--trait-fort);\n}\n\n.a4-vide {\n  padding: 8mm 0;\n  color: var(--gris-clair);\n  font-style: italic;\n  text-align: center;\n}\n\n/* ─────────────────────────────── totaux ─────────────────────────────── */\n\n.a4-totaux {\n  margin-top: 5mm;\n  margin-left: auto;\n  width: 88mm;\n  font-size: 9pt;\n  break-inside: avoid;\n}\n\n.a4-totaux .ligne {\n  display: flex;\n  justify-content: space-between;\n  gap: 6mm;\n  padding: 1.6mm 1mm;\n}\n\n.a4-totaux .ligne + .ligne {\n  border-top: 0.2mm solid var(--trait);\n}\n\n.a4-totaux .fort {\n  margin-top: 1.5mm;\n  padding: 2.6mm 3mm;\n  border: 0;\n  border-radius: 1mm;\n  background: var(--pa);\n  color: #fff;\n  font-size: 11.5pt;\n  font-weight: 700;\n  letter-spacing: 0.01em;\n}\n\n.a4-en-lettres {\n  margin-top: 4mm;\n  font-size: 8.5pt;\n  font-style: italic;\n  line-height: 1.55;\n  color: var(--gris);\n  break-inside: avoid;\n}\n\n/* ─────────────────────── mentions, signatures, pied ─────────────────────── */\n\n.a4-mentions {\n  margin-top: 7mm;\n  font-size: 8pt;\n  line-height: 1.6;\n  color: var(--gris);\n  orphans: 2;\n  widows: 2;\n}\n\n.a4-mentions p {\n  margin: 0 0 2mm;\n}\n\n.a4-signatures {\n  display: flex;\n  gap: 10mm;\n  margin-top: 12mm;\n  break-inside: avoid;\n}\n\n.a4-signatures .zone {\n  flex: 1;\n}\n\n.a4-signatures .libelle {\n  font-size: 7.5pt;\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--pa);\n}\n\n.a4-signatures .mention {\n  margin-top: 0.8mm;\n  font-size: 7.5pt;\n  color: var(--gris-clair);\n}\n\n.a4-signatures .cadre {\n  margin-top: 2.5mm;\n  height: 24mm;\n  border: 0.25mm dashed var(--trait-fort);\n  border-radius: 1mm;\n}\n\n.a4-pied {\n  position: absolute;\n  left: 16mm;\n  right: 16mm;\n  bottom: 11mm;\n  padding-top: 2.5mm;\n  border-top: 0.2mm solid var(--trait);\n  font-size: 7pt;\n  line-height: 1.6;\n  color: var(--gris-clair);\n}\n\n.a4-numero-page {\n  position: absolute;\n  right: 16mm;\n  bottom: 6mm;\n  font-size: 7pt;\n  color: var(--gris-clair);\n}\n\n/* ─────────────────────────────── impression ─────────────────────────── */\n\n@page {\n  size: A4;\n  margin: 0;\n}\n\n@media print {\n  .a4-cadre {\n    --echelle: 1;\n    width: auto;\n    overflow: visible;\n  }\n\n  .a4-cadre > .a4 {\n    transform: none;\n    margin-bottom: 0;\n    box-shadow: none;\n  }\n}\n\n/* ────────────────────── actes et lettres ────────────────────── */\n/*\n * Ces quatre documents ne portent pas de tableau taxé. Ce qui les distingue,\n * c'est la disposition : un acte pose ses parties avant son corps, une lettre\n * française met l'expéditeur à gauche et le destinataire à droite. Le reste —\n * papier, titre, signatures, pied — vient des mêmes pièces que le devis.\n */\n\n/* Un corps de texte long : la mesure compte plus que la taille. */\n.a4-corps {\n  margin-top: 6mm;\n  font-size: 9.5pt;\n  line-height: 1.7;\n  color: var(--encre);\n  text-align: justify;\n}\n\n.a4-corps p {\n  margin: 0 0 3.5mm;\n}\n\n/* Les deux parties d'un acte, nommées avant le corps. */\n.a4-parties {\n  margin-top: 6mm;\n  font-size: 9.5pt;\n  line-height: 1.9;\n}\n\n.a4-parties .qui {\n  font-weight: 700;\n  color: var(--pa);\n}\n\n/* Le montant encadré : ce que l'œil doit trouver en premier sur l'acte. */\n.a4-encadre {\n  margin-top: 6mm;\n  padding: 4mm 5mm;\n  border: 0.5mm solid var(--pa);\n  border-radius: 1mm;\n  break-inside: avoid;\n}\n\n.a4-encadre .etiquette {\n  font-size: 7.5pt;\n  font-weight: 700;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--pa);\n}\n\n.a4-encadre .chiffre {\n  margin-top: 1mm;\n  font-size: 16pt;\n  font-weight: 800;\n  letter-spacing: -0.01em;\n}\n\n.a4-encadre .lettres {\n  margin-top: 0.8mm;\n  font-size: 9pt;\n  font-style: italic;\n  color: var(--gris);\n}\n\n.a4-encadre .echeance {\n  margin-top: 2.5mm;\n  font-size: 9pt;\n}\n\n/* La disposition d'une lettre française. */\n.a4-lettre-tete {\n  display: flex;\n  justify-content: space-between;\n  gap: 10mm;\n  font-size: 9pt;\n  line-height: 1.5;\n}\n\n.a4-lettre-tete .expediteur {\n  max-width: 70mm;\n}\n\n.a4-lettre-tete .destinataire {\n  max-width: 80mm;\n  text-align: right;\n  color: var(--gris);\n}\n\n.a4-lettre-date {\n  margin-top: 8mm;\n  font-size: 9pt;\n  text-align: right;\n  color: var(--gris);\n}\n\n.a4-lettre-objet {\n  display: inline-block;\n  margin-top: 6mm;\n  padding-bottom: 1mm;\n  border-bottom: 0.3mm solid var(--pa);\n  font-size: 10pt;\n  font-weight: 600;\n}\n\n.a4-lettre-signature {\n  margin-top: 10mm;\n  font-size: 10pt;\n  text-align: right;\n}\n\n/* ───────────────────────────── curriculum vitæ ─────────────────────────────\n *\n * Quatre gabarits pour une même feuille. Ils ne diffèrent que par la police,\n * la façon d'annoncer une section et la présence d'une colonne : la structure\n * du contenu est la même pour les quatre, et c'est ce qui permet de changer de\n * gabarit sans rien ressaisir.\n *\n * Aucune police web ici non plus (invariant § 2.6). « Serif » et « grotesque »\n * se jouent avec les familles génériques que tout téléphone possède.\n */\n\n.a4-cv {\n  --cv-inter: 1.5;\n  --cv-saut: 5mm;\n}\n\n.a4-cv.dense {\n  --cv-inter: 1.28;\n  --cv-saut: 3mm;\n  font-size: 9pt;\n}\n\n.a4-cv .cv-nom {\n  font-size: 20pt;\n  font-weight: 700;\n  letter-spacing: 0.02em;\n  line-height: 1.15;\n}\n\n.a4-cv .cv-titre {\n  margin-top: 1mm;\n  color: var(--pa);\n  font-size: 11pt;\n  font-weight: 600;\n}\n\n.a4-cv .cv-contact {\n  margin-top: 2mm;\n  color: var(--gris);\n  font-size: 9pt;\n}\n\n.a4-cv .cv-section {\n  margin: var(--cv-saut) 0 2mm;\n  color: var(--pa);\n  font-size: 9pt;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.a4-cv .cv-profil {\n  line-height: var(--cv-inter);\n  text-align: justify;\n}\n\n.a4-cv .cv-profil p {\n  margin: 0 0 2mm;\n}\n\n.a4-cv .cv-item {\n  margin-bottom: 3mm;\n  line-height: var(--cv-inter);\n}\n\n.a4-cv .cv-quoi {\n  font-size: 10pt;\n  font-weight: 600;\n}\n\n.a4-cv .cv-ou {\n  color: var(--gris);\n  font-size: 9pt;\n}\n\n/* La puce est dessinée, pas listée : un <ul> imprime des marges que le\n * gabarit ne contrôle pas d'un navigateur à l'autre. */\n.a4-cv .cv-fait {\n  position: relative;\n  margin-top: 1mm;\n  padding-left: 4mm;\n  font-size: 9.5pt;\n}\n\n.a4-cv .cv-fait::before {\n  content: \"\";\n  position: absolute;\n  top: 1.7mm;\n  left: 0.8mm;\n  width: 1.2mm;\n  height: 1.2mm;\n  background: var(--pa);\n}\n\n.a4-cv .cv-serie {\n  font-size: 9.5pt;\n  line-height: var(--cv-inter);\n}\n\n/* — Notaire : sérif, tout centré, pour une administration. — */\n.a4-cv.notaire {\n  font-family: Georgia, \"Times New Roman\", serif;\n}\n\n.a4-cv.notaire .cv-tete {\n  padding-bottom: 3mm;\n  border-bottom: 0.4mm solid var(--pa);\n  text-align: center;\n}\n\n.a4-cv.notaire .cv-section {\n  border-bottom: 0.2mm solid var(--trait);\n  padding-bottom: 1mm;\n  text-align: center;\n  letter-spacing: 0.14em;\n}\n\n.a4-cv.notaire .cv-serie {\n  text-align: center;\n}\n\n/* — Exécutif : grotesque, un filet de couleur, pour le privé. — */\n\n/*\n * Le filet sort dans la marge : posé dans la colonne de texte, il décalait le\n * nom de quatre millimètres vers la droite et l'entête ne s'alignait plus sur\n * les titres de section en dessous.\n */\n.a4-cv.executif .cv-tete {\n  /* 5 mm de retrait plus l'épaisseur du filet : sans elle, le nom reste décalé\n   * du filet lui-même et rate l'alignement d'un millimètre et demi. */\n  margin-left: -6.5mm;\n  border-left: 1.5mm solid var(--pa);\n  padding-left: 5mm;\n}\n\n.a4-cv.executif .cv-section {\n  border-bottom: 0.2mm solid var(--trait);\n  padding-bottom: 1mm;\n}\n\n/* — Éditorial : le nom en display, la date en marge, pour un métier créatif. — */\n.a4-cv.editorial .cv-nom {\n  font-size: 28pt;\n  font-weight: 300;\n  letter-spacing: -0.01em;\n}\n\n.a4-cv.editorial .cv-tete {\n  padding-bottom: 4mm;\n  border-bottom: 0.8mm solid var(--pa);\n}\n\n.a4-cv.editorial .cv-section {\n  color: var(--gris-clair);\n  letter-spacing: 0.18em;\n}\n\n/*\n * `column-gap`, pas `gap` : chaque fait occupe sa propre rangée de la grille,\n * et un `gap` de quatre millimètres les écartait tous les uns des autres —\n * trois puces séparées comme trois paragraphes.\n */\n.a4-cv.editorial .cv-item {\n  display: grid;\n  grid-template-columns: 28mm 1fr;\n  column-gap: 4mm;\n}\n\n.a4-cv.editorial .cv-marge {\n  grid-column: 1;\n  grid-row: 1;\n  color: var(--gris);\n  font-size: 9pt;\n  text-align: right;\n}\n\n.a4-cv.editorial .cv-quoi,\n.a4-cv.editorial .cv-ou,\n.a4-cv.editorial .cv-fait {\n  grid-column: 2;\n}\n\n/* — Bloc : une bande latérale porte le contact et les listes. — */\n\n/*\n * La hauteur est celle de la zone de texte de la feuille : 297 mm moins les\n * marges haute et basse. Sans elle, le filet de la bande s'arrête où le\n * contenu s'arrête, et un CV court montre un trait qui meurt au milieu de la\n * page — ce qui se lit comme un défaut de rendu, pas comme un parti pris.\n */\n.a4-cv.bloc {\n  display: grid;\n  grid-template-columns: 58mm 1fr;\n  gap: 8mm;\n  min-height: calc(297mm - 15mm - 20mm);\n}\n\n/* Justifier une colonne de cent millimètres ouvre des rivières entre les mots. */\n.a4-cv.bloc .cv-profil {\n  text-align: left;\n}\n\n.a4-cv.bloc .cv-bande {\n  padding-right: 6mm;\n  border-right: 0.3mm solid var(--trait);\n}\n\n.a4-cv.bloc .cv-bande .cv-nom {\n  font-size: 16pt;\n}\n\n.a4-cv.bloc .cv-bande .cv-titre {\n  font-size: 10pt;\n}\n\n.a4-cv.bloc .cv-ligne {\n  margin-top: 1mm;\n  font-size: 9pt;\n  line-height: 1.35;\n  overflow-wrap: anywhere;\n}\n\n.a4-cv.bloc .cv-principal .cv-section:first-child {\n  margin-top: 0;\n}\n";
//#endregion
//#region ../render/src/styles/vitrine.css?raw
var vitrine_default = "/*\n * La page composée par le modèle.\n *\n * Elle vit à deux endroits : en aperçu dans l'application, et publiée sur le\n * serveur pour qui reçoit le lien. Une seule feuille, pour que les deux\n * montrent la même chose — celle que le client voit ne doit pas être la\n * surprise.\n *\n * Elle se lit d'un pouce, sur un téléphone d'entrée de gamme, souvent dans le\n * navigateur intégré de WhatsApp. Aucune animation, aucune police à charger :\n * ce qui arrive est fini quand il arrive.\n */\n\n.vitrine {\n  max-width: 560px;\n  margin: 0 auto;\n  padding: 4px 0 8px;\n}\n\n.vitrine-tete {\n  padding-bottom: 18px;\n  border-bottom: 2px solid var(--accent);\n}\n\n.vitrine-tete .kicker {\n  margin: 0 0 6px;\n  color: var(--accent);\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n\n.vitrine-tete h1 {\n  margin: 0;\n  font-size: 27px;\n  line-height: 1.15;\n  letter-spacing: -0.02em;\n}\n\n.vitrine-tete .accroche {\n  margin: 8px 0 0;\n  color: var(--encre-2);\n  font-size: 15px;\n  line-height: 1.45;\n}\n\n.vitrine-section {\n  margin-top: 24px;\n}\n\n.vitrine-section h2 {\n  margin: 0 0 10px;\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--encre-3);\n}\n\n.vitrine-section p {\n  margin: 0 0 8px;\n  font-size: 15px;\n  line-height: 1.55;\n  color: var(--encre-2);\n}\n\n.vitrine-liste,\n.vitrine-prix {\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.vitrine-liste li,\n.vitrine-prix li {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 14px;\n  padding: 9px 0;\n  border-top: 1px solid var(--trait);\n  font-size: 15px;\n}\n\n.vitrine-liste li:first-child,\n.vitrine-prix li:first-child {\n  border-top: 0;\n}\n\n.vitrine-liste .quoi,\n.vitrine-prix .quoi {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n}\n\n.vitrine-liste .detail,\n.vitrine-prix .detail {\n  color: var(--encre-3);\n  font-size: 13px;\n}\n\n/* Le prix ne se coupe jamais : c'est le chiffre qu'on cherche du regard. */\n.vitrine-prix .combien {\n  flex: none;\n  color: var(--accent);\n  font-weight: 700;\n  white-space: nowrap;\n}\n\n.vitrine-liste .combien {\n  flex: none;\n  color: var(--encre-3);\n  white-space: nowrap;\n}\n\n.vitrine-pied {\n  margin-top: 26px;\n  padding-top: 18px;\n  border-top: 1px solid var(--trait);\n}\n\n/*\n * Le bouton qui rapporte.\n *\n * Quelqu'un qui lit la page et veut acheter ne doit pas avoir à recopier dix\n * chiffres : `wa.me` ouvre WhatsApp avec le message déjà écrit, gratuitement\n * et sans compte (§ 6).\n */\n.vitrine-appel {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  padding: 13px 16px;\n  border-radius: 12px;\n  background: var(--accent);\n  color: #fff;\n  font-weight: 700;\n  text-decoration: none;\n}\n\n.vitrine-appel span {\n  font-weight: 400;\n  font-size: 13px;\n  opacity: 0.85;\n}\n\n.vitrine-ou {\n  display: flex;\n  gap: 10px;\n  margin: 12px 0 0;\n  color: var(--encre-2);\n  font-size: 14px;\n}\n\n.vitrine-ou .etiquette {\n  /*\n   * Assez large pour « QUAND », le plus long des libellés. À 46 px il touchait\n   * le texte alors que « OÙ » gardait sa gouttière : la colonne était taillée\n   * pour le mot le plus court.\n   */\n  flex: none;\n  width: 58px;\n  color: var(--encre-3);\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  line-height: 1.6;\n}\n\n/*\n * Le sommaire d'un « site ».\n *\n * Des ancres et non des adresses : sur une connexion qui hoquette, un menu qui\n * recharge est un menu qu'on n'ose plus toucher. Il défile horizontalement\n * plutôt que de passer à la ligne — six titres empilés repousseraient la\n * première section sous le pli, et on cacherait le contenu pour montrer son\n * plan.\n */\n.vitrine-sommaire {\n  display: flex;\n  gap: 8px;\n  margin-top: 14px;\n  overflow-x: auto;\n  scrollbar-width: none;\n}\n\n.vitrine-sommaire a {\n  flex: none;\n  padding: 7px 12px;\n  border: 1px solid var(--trait);\n  border-radius: 999px;\n  color: var(--encre-2);\n  font-size: 13px;\n  text-decoration: none;\n  white-space: nowrap;\n}\n\n/* Une section visée par le sommaire ne doit pas coller au bord de l'écran. */\n.vitrine-section {\n  scroll-margin-top: 12px;\n}\n\n/*\n * Le jour d'un événement.\n *\n * Le délai est le gros caractère, pas la date : on ne lit pas une affiche pour\n * sa date, on la lit pour savoir si on a le temps. Quand le jour est passé, le\n * bloc s'éteint — une affiche qui garde son air d'urgence après coup fait\n * traverser la ville pour rien.\n */\n.vitrine-jour {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  margin: 14px 0 0;\n  padding: 12px 14px;\n  border-radius: 12px;\n  background: var(--accent);\n  color: #fff;\n}\n\n.vitrine-jour b {\n  font-size: 19px;\n  line-height: 1.2;\n}\n\n.vitrine-jour span {\n  font-size: 14px;\n  opacity: 0.9;\n}\n\n.vitrine-jour.passe {\n  background: var(--surface);\n  border: 1px solid var(--trait);\n  color: var(--encre-3);\n}\n\n/*\n * Le formulaire.\n *\n * Il partage l'entête de la vitrine — même titre, même accroche, même trait —\n * parce que c'est la même page : ce qui change est qu'elle reçoit au lieu de\n * se lire. Les cibles font 48 px comme partout : on remplit ça au pouce, dans\n * un taxi.\n *\n * Plus étroit qu'une vitrine, et pas par goût : un champ de saisie large de\n * 560 px se remplit sans qu'on voie où il commence, et une question dont\n * l'étiquette est loin de sa réponse se relit deux fois.\n */\n.vitrine.form {\n  max-width: 480px;\n}\n\n.form-corps {\n  display: flex;\n  flex-direction: column;\n  gap: 18px;\n  margin-top: 22px;\n}\n\n.form-champ {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.form-question {\n  font-size: 14px;\n  font-weight: 700;\n}\n\n.form-question i {\n  color: var(--accent);\n  font-style: normal;\n}\n\n.form-aide {\n  color: var(--encre-3);\n  font-size: 13px;\n}\n\n.form-champ input[type=\"text\"],\n.form-champ input[type=\"tel\"],\n.form-champ select,\n.form-champ textarea {\n  width: 100%;\n  min-height: 48px;\n  padding: 12px 14px;\n  border: 1px solid var(--trait);\n  border-radius: 12px;\n  background: var(--surface);\n  color: var(--encre);\n  font: inherit;\n}\n\n.form-champ textarea {\n  min-height: 92px;\n  resize: vertical;\n}\n\n/* La case est petite, mais son étiquette fait la cible. */\n.form-champ input[type=\"checkbox\"] {\n  width: 24px;\n  height: 24px;\n  accent-color: var(--accent);\n}\n\n.form-envoyer {\n  min-height: 52px;\n  padding: 14px 18px;\n  border: 0;\n  border-radius: 12px;\n  background: var(--accent);\n  color: #fff;\n  font: inherit;\n  font-weight: 700;\n  cursor: pointer;\n}\n\n.form-envoyer:disabled {\n  opacity: 0.55;\n}\n\n/*\n * Le champ que personne ne doit remplir : hors écran plutôt que `display:\n * none`, qu'un robot un peu sérieux sait reconnaître. Il sort aussi de l'ordre\n * de tabulation, pour qu'un doigt ou un clavier ne tombe jamais dessus.\n */\n.form-piege {\n  position: absolute;\n  left: -9999px;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n}\n\n.form-manque,\n.form-clos {\n  margin: 0;\n  padding: 12px 14px;\n  border-radius: 12px;\n  background: var(--surface);\n  border: 1px solid var(--alerte);\n  color: var(--alerte);\n  font-size: 14px;\n}\n\n.form-clos {\n  margin-top: 22px;\n}\n\n.form-merci {\n  margin: 24px 0 0;\n  font-size: 17px;\n  line-height: 1.5;\n}\n";
//#endregion
//#region src/a4.css?raw
var a4_default = "/*\n * Ce que seuls les écrits A4 emportent : la mise à l'échelle de la feuille et\n * le lien d'impression. Une vitrine ne se met pas dans une chemise, et une\n * carte ne s'imprime pas — leur donner ces règles serait du poids sans dessin.\n */\n/*\n * La feuille A4 occupe exactement la largeur disponible.\n *\n * Par paliers — 0,44 puis 0,66 puis 0,86 — elle ne la remplissait presque\n * jamais : sur un écran de 500 px elle restait dessinée pour 390, et son texte\n * finissait plus petit que celui du pied de page. Or c'est le document qu'on\n * vient lire. Le calcul le met à la largeur juste à chaque taille d'écran, et\n * s'arrête à 1 : un devis agrandi au-delà de sa taille réelle n'apprend rien de\n * plus et se met à baver.\n *\n * 210 mm valent 793,7 px à 96 ppp ; les 32 px sont les marges du corps. Le\n * diviseur porte son unité : diviser une longueur par un nombre rend une\n * longueur, et `min(1, 0.41px)` mélange un nombre et une longueur — déclaration\n * invalide, silencieusement ignorée. L'échelle retombait alors à 1 et le\n * document sortait à sa taille réelle, coupé par le cadre sur un téléphone.\n */\n.a4-cadre {\n  --echelle: min(1, calc((100vw - 32px) / 793.7px));\n  margin: 0 auto;\n}\n@media print {\n  body { padding: 0; background: #fff; }\n  .lecture-pied { display: none; }\n}\n\n/*\n * « Enregistrer en PDF » : un lien, pas un bouton.\n *\n * La page n'a aucun script, et c'est ce qui la rend fiable dans le navigateur\n * intégré de WhatsApp, sur un téléphone d'entrée de gamme. Un lien de\n * téléchargement n'en demande pas.\n */\n.lecture-pdf { margin: 10px 0 0; }\n.lecture-pdf a {\n  color: var(--accent);\n  font-weight: 600;\n  text-decoration: none;\n  border-bottom: 1px solid currentColor;\n}\n";
//#endregion
//#region src/carte.css?raw
var carte_default = "/*\n * La carte dessinée en HTML, pour un registre publié.\n *\n * Elle vit dans sa propre feuille parce qu'elle ne sert qu'à un tiers des\n * pages : un écrit A4 dessine son document, une page composée dessine sa\n * vitrine, et ni l'un ni l'autre n'a de carte. Inliner ces règles partout\n * mettait deux kilo-octets de style mort dans chaque page — sur un plafond de\n * 25 Ko (§ 8), c'est un douzième dépensé à ne rien dessiner.\n */\n.lecture-carte {\n  max-width: 560px;\n  margin: 0 auto;\n  padding: 20px;\n  border: 1px solid var(--trait);\n  border-radius: 18px;\n  background: var(--surface);\n}\n.lecture-carte .kicker {\n  margin: 0;\n  color: var(--accent);\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n}\n.lecture-carte h1 { margin: 4px 0 0; font-size: 22px; line-height: 1.2; }\n.lecture-carte .sous { margin: 2px 0 0; color: var(--encre-3); font-size: 13px; }\n.lecture-carte .grand { margin-top: 20px; }\n.lecture-carte .etiquette {\n  margin: 0;\n  color: var(--encre-3);\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.09em;\n  text-transform: uppercase;\n}\n.lecture-carte .chiffre {\n  margin: 2px 0 0;\n  color: var(--accent);\n  font-size: 34px;\n  font-weight: 700;\n  line-height: 1.1;\n}\n.lecture-carte .barre {\n  height: 10px;\n  margin-top: 10px;\n  border-radius: 999px;\n  background: #edf1e9;\n  overflow: hidden;\n}\n.lecture-carte .barre i { display: block; height: 100%; background: var(--accent); }\n.lecture-carte .ligne { margin: 8px 0 0; color: var(--encre-2); font-size: 13px; }\n.lecture-carte .detail { margin-top: 20px; }\n.lecture-carte ul { margin: 8px 0 0; padding: 0; list-style: none; }\n.lecture-carte li {\n  display: flex;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 7px 0;\n  border-top: 1px solid var(--trait);\n  font-size: 14px;\n}\n/*\n * Le nom cède, le montant non.\n *\n * Sans `min-width: 0`, un article au nom long et insécable — une référence de\n * pièce, un numéro de série — pousse le montant hors de la rangée : le chiffre\n * qu'on cherche du regard est le seul à disparaître. C'est la même règle que\n * la vitrine applique à ses lignes de prix.\n */\n.lecture-carte .quoi { min-width: 0; }\n.lecture-carte li.alerte .combien { color: var(--alerte); font-weight: 700; }\n.lecture-carte li.fait .combien { color: var(--accent); }\n.lecture-carte .combien { white-space: nowrap; }\n/* « + 47 autres » : la carte est un résumé, elle dit ce qu'elle ne montre pas. */\n.lecture-carte .reste {\n  margin: 10px 0 0;\n  padding-top: 7px;\n  border-top: 1px solid var(--trait);\n  color: var(--encre-2);\n  font-size: 13px;\n}\n";
//#endregion
//#region src/lecture.css?raw
var lecture_default = "/*\n * La page de lecture. Inlinée dans le HTML : une feuille séparée serait une\n * requête de plus sur une connexion qui hoquette, pour deux kilo-octets.\n */\n:root {\n  --encre: #121710;\n  --encre-2: #414b3f;\n  --encre-3: #5e6a5c;\n  --fond: #fafbf7;\n  --surface: #fff;\n  --trait: #dfe5d9;\n  --accent: #1b5e43;\n  --alerte: #9c2717;\n}\n* { box-sizing: border-box; }\nbody {\n  margin: 0;\n  padding: 16px;\n  background: var(--fond);\n  color: var(--encre);\n  font: 15px/1.5 system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n  font-variant-numeric: tabular-nums;\n}\n.lecture { max-width: 760px; margin: 0 auto; }\n/*\n * Le pied s'efface derrière le document.\n *\n * À 12 px sous une feuille mise à l'échelle, il était plus gros que le texte du\n * devis lui-même — la mention de l'atelier se lisait mieux que le montant.\n */\n.lecture-pied {\n  max-width: 560px;\n  margin: 14px auto 0;\n  color: var(--encre-3);\n  font-size: 11px;\n  text-align: center;\n}\n.lecture-pied p { margin: 2px 0; }\n.lecture-marque { font-weight: 700; letter-spacing: 0.08em; opacity: 0.75; }\n.lecture-vide { max-width: 460px; margin: 12vh auto; text-align: center; }\n.lecture-vide h1 { font-size: 20px; }\n.lecture-vide p { color: var(--encre-2); }\n";
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
//#region src/page.tsx
/**
* Le pied de page.
*
* Il dit d'où vient le document et quand il a été arrêté. Un client qui reçoit
* un devis doit pouvoir répondre « celui du 9 septembre » sans ouvrir un
* fichier.
*/
function PiedLecture(props) {
	const quand = new Date(props.instantane.publieLe);
	return /* @__PURE__ */ u$1("footer", {
		class: "lecture-pied",
		children: [
			/* @__PURE__ */ u$1("p", { children: props.recoit === true ? "Ta réponse va à la personne qui t’a envoyé ce lien, et à personne d’autre." : `Arrêté le ${Number.isNaN(quand.getTime()) ? "—" : dateLongue(quand)}. Document en lecture seule.` }),
			props.pdf !== void 0 && /* @__PURE__ */ u$1("p", {
				class: "lecture-pdf",
				children: /* @__PURE__ */ u$1("a", {
					href: props.pdf,
					download: true,
					children: "Enregistrer en PDF"
				})
			}),
			/* @__PURE__ */ u$1("p", {
				class: "lecture-marque",
				children: "Atelier\xA0237"
			})
		]
	});
}
/**
* La page quand le lien ne mène à rien.
*
* Un 404 nu laisse croire à une panne. Celui-ci dit la seule chose utile : le
* lien est peut-être mal recopié, ou le document n'est plus publié.
*/
function PageIntrouvable() {
	return /* @__PURE__ */ u$1("main", {
		class: "lecture lecture-vide",
		children: [
			/* @__PURE__ */ u$1("h1", { children: "Ce lien ne mène à rien" }),
			/* @__PURE__ */ u$1("p", { children: "Le document n’est plus publié, ou le lien a été recopié de travers. Demande-le à nouveau à la personne qui te l’a envoyé." }),
			/* @__PURE__ */ u$1("p", {
				class: "lecture-marque",
				children: "Atelier\xA0237"
			})
		]
	});
}
/**
* La page quand le document est là mais ne se dessine pas.
*
* Distincte de l'introuvable, parce que ce n'est pas la même nouvelle : le
* lien est bon, il a bien été envoyé, et c'est le serveur qui n'y arrive pas.
* Dire « ce lien ne mène à rien » enverrait la personne vérifier une adresse
* qui est correcte.
*/
function PageIllisible() {
	return /* @__PURE__ */ u$1("main", {
		class: "lecture lecture-vide",
		children: [
			/* @__PURE__ */ u$1("h1", { children: "Ce document ne peut pas être affiché" }),
			/* @__PURE__ */ u$1("p", { children: "Le lien est bon, mais le document déposé n’est pas lisible ici. Demande à la personne qui te l’a envoyé de le rediffuser." }),
			/* @__PURE__ */ u$1("p", {
				class: "lecture-marque",
				children: "Atelier\xA0237"
			})
		]
	});
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
	return /* @__PURE__ */ u$1("div", {
		class: "a4-cadre",
		children: /* @__PURE__ */ u$1("article", {
			class: "a4",
			style: { "--pa": hexEncre(props.encre) },
			children: props.children
		})
	});
}
/** Ne rend une ligne que si elle porte quelque chose. */
function Lignes(props) {
	return /* @__PURE__ */ u$1(S, { children: props.valeurs.filter((v) => v !== null && v.trim() !== "").map((v, i) => /* @__PURE__ */ u$1("div", { children: v }, `${i}-${v}`)) });
}
/**
* L'entête légal. Il porte les mentions de la section 5 du brief : raison
* sociale, forme juridique, activité, adresse, RCCM, NIU et centre des impôts.
* Un champ vide ne laisse pas une étiquette orpheline.
*/
function Entete(props) {
	const e = props.emetteur;
	return /* @__PURE__ */ u$1("header", {
		class: "a4-entete",
		children: [/* @__PURE__ */ u$1("div", { children: [/* @__PURE__ */ u$1("div", {
			class: "raison",
			children: e.nom
		}), /* @__PURE__ */ u$1("div", {
			class: "coordonnees",
			children: /* @__PURE__ */ u$1(Lignes, { valeurs: [
				e.activite,
				e.adresse,
				[e.tel && `Tél. ${e.tel}`, e.mail].filter(Boolean).join(" · ") || null
			] })
		})] }), /* @__PURE__ */ u$1("div", {
			class: "immat",
			children: /* @__PURE__ */ u$1(Lignes, { valeurs: [
				e.forme,
				e.rccm && `RCCM ${e.rccm}`,
				e.niu && `NIU ${e.niu}`,
				e.centre
			] })
		})]
	});
}
function TitreDocument(props) {
	return /* @__PURE__ */ u$1(S, { children: [/* @__PURE__ */ u$1("h1", {
		class: "a4-titre",
		children: props.titre
	}), /* @__PURE__ */ u$1("div", {
		class: "a4-sous-titre",
		children: props.sousTitre
	})] });
}
/**
* Le bloc destinataire. Le NIU du client y figure dès qu'on l'a : en B2B il est
* obligatoire, et sans lui le client ne peut pas déduire.
*/
function BlocClient(props) {
	return /* @__PURE__ */ u$1("section", {
		class: "a4-bloc-client",
		children: [
			/* @__PURE__ */ u$1("div", {
				class: "etiquette",
				children: "Client"
			}),
			/* @__PURE__ */ u$1("div", { children: /* @__PURE__ */ u$1("strong", { children: props.nom }) }),
			/* @__PURE__ */ u$1(Lignes, { valeurs: [props.niu && `NIU ${props.niu}`, props.complement] })
		]
	});
}
function ZonesSignature(props) {
	return /* @__PURE__ */ u$1("section", {
		class: "a4-signatures",
		children: props.zones.map((z) => /* @__PURE__ */ u$1("div", {
			class: "zone",
			children: [
				/* @__PURE__ */ u$1("div", {
					class: "libelle",
					children: z.libelle
				}),
				z.mention !== void 0 && /* @__PURE__ */ u$1("div", {
					class: "mention",
					children: z.mention
				}),
				/* @__PURE__ */ u$1("div", { class: "cadre" })
			]
		}, z.libelle))
	});
}
/** Le pied légal, obligatoire, plus d'éventuelles mentions propres au document. */
function PiedLegal(props) {
	return /* @__PURE__ */ u$1("footer", {
		class: "a4-pied",
		children: [/* @__PURE__ */ u$1("div", { children: piedLegal(props.emetteur) }), props.complement !== void 0 && /* @__PURE__ */ u$1("div", { children: props.complement })]
	});
}
function NumeroPage(props) {
	return /* @__PURE__ */ u$1("div", {
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
	return /* @__PURE__ */ u$1(S, { children: props.texte.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b !== "").map((b, i) => /* @__PURE__ */ u$1("p", { children: b }, `${i}-${b.slice(0, 12)}`)) });
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
	if (lignes.length === 0) return /* @__PURE__ */ u$1("div", {
		class: "a4-vide",
		children: "Aucune ligne pour l’instant."
	});
	return /* @__PURE__ */ u$1("table", {
		class: "a4-tableau",
		children: [/* @__PURE__ */ u$1("thead", { children: /* @__PURE__ */ u$1("tr", { children: [
			/* @__PURE__ */ u$1("th", { children: "Désignation" }),
			/* @__PURE__ */ u$1("th", {
				class: "nombre",
				children: "Qté"
			}),
			/* @__PURE__ */ u$1("th", {
				class: "nombre",
				children: "P.U. HT"
			}),
			/* @__PURE__ */ u$1("th", {
				class: "nombre",
				children: "Montant HT"
			}),
			/* @__PURE__ */ u$1("th", {
				class: "nombre",
				children: LIBELLE_TVA_CM
			}),
			/* @__PURE__ */ u$1("th", {
				class: "nombre",
				children: "Montant TTC"
			})
		] }) }), /* @__PURE__ */ u$1("tbody", { children: lignes.map((l, i) => /* @__PURE__ */ u$1("tr", { children: [
			/* @__PURE__ */ u$1("td", { children: l.designation }),
			/* @__PURE__ */ u$1("td", {
				class: "nombre",
				children: nf(l.quantite)
			}),
			/* @__PURE__ */ u$1("td", {
				class: "nombre",
				children: nf(l.prixUnitaire)
			}),
			/* @__PURE__ */ u$1("td", {
				class: "nombre",
				children: nf(l.montantHT)
			}),
			/* @__PURE__ */ u$1("td", {
				class: "nombre",
				children: nf(l.tva)
			}),
			/* @__PURE__ */ u$1("td", {
				class: "nombre",
				children: nf(l.montantTTC)
			})
		] }, `${i}-${l.designation}`)) })]
	});
}
/** Le bloc HT / TVA / TTC, plus ce que le document ajoute au-dessous. */
function BlocTotaux(props) {
	return /* @__PURE__ */ u$1("section", {
		class: "a4-totaux",
		children: props.lignes.map((l) => /* @__PURE__ */ u$1("div", {
			class: l.fort === true ? "ligne fort" : "ligne",
			children: [/* @__PURE__ */ u$1("span", { children: l.libelle }), /* @__PURE__ */ u$1("span", { children: montantF(l.montant) })]
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
	return /* @__PURE__ */ u$1(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u$1(Entete, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u$1(TitreDocument, {
				titre: etat.objet === "" ? "Attestation" : etat.objet,
				sousTitre: `N° ${etat.numero}`
			}),
			/* @__PURE__ */ u$1("section", {
				class: "a4-mentions a4-corps",
				children: etat.texte.trim() === "" ? /* @__PURE__ */ u$1("div", {
					class: "a4-vide",
					children: "Le corps de l’attestation reste à écrire."
				}) : /* @__PURE__ */ u$1(Paragraphes, { texte: etat.texte })
			}),
			/* @__PURE__ */ u$1(ZonesSignature, { zones: [{
				libelle: `${etat.emetteur.adresse === "" ? "Fait" : "Fait à " + villeDe(etat.emetteur.adresse)}, le ${dateLongue(dateEmission(etat))}`,
				mention: "Le responsable — cachet et signature"
			}] }),
			/* @__PURE__ */ u$1(PiedLegal, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u$1(NumeroPage, {
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
	return /* @__PURE__ */ u$1(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u$1(Entete, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u$1(TitreDocument, {
				titre: "Reçu",
				sousTitre: `N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`
			}),
			/* @__PURE__ */ u$1("section", {
				class: "a4-bloc-client",
				children: [/* @__PURE__ */ u$1("div", {
					class: "etiquette",
					children: "Reçu de"
				}), /* @__PURE__ */ u$1("div", { children: /* @__PURE__ */ u$1("strong", { children: etat.recuDe }) })]
			}),
			lignes.length === 0 ? /* @__PURE__ */ u$1("div", {
				class: "a4-vide",
				children: "Aucune ligne pour l’instant."
			}) : /* @__PURE__ */ u$1("table", {
				class: "a4-tableau",
				children: [/* @__PURE__ */ u$1("thead", { children: /* @__PURE__ */ u$1("tr", { children: [/* @__PURE__ */ u$1("th", { children: "Désignation" }), /* @__PURE__ */ u$1("th", {
					class: "nombre",
					children: "Montant"
				})] }) }), /* @__PURE__ */ u$1("tbody", { children: lignes.map((l, i) => /* @__PURE__ */ u$1("tr", { children: [/* @__PURE__ */ u$1("td", { children: l.designation }), /* @__PURE__ */ u$1("td", {
					class: "nombre",
					children: nf(l.montant)
				})] }, `${i}-${l.designation}`)) })]
			}),
			/* @__PURE__ */ u$1(BlocTotaux, { lignes: [
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
			/* @__PURE__ */ u$1("div", {
				class: "a4-en-lettres",
				children: [
					"Somme reçue ce jour : ",
					montantEnLettres(t.avance),
					"."
				]
			}),
			/* @__PURE__ */ u$1(ZonesSignature, { zones: [{
				libelle: "Cachet et signature",
				mention: ""
			}] }),
			/* @__PURE__ */ u$1(PiedLegal, {
				emetteur: etat.emetteur,
				complement: "Reçu établi en francs CFA. Il atteste d’un paiement reçu, il ne remplace pas la facture."
			}),
			/* @__PURE__ */ u$1(NumeroPage, {
				page: 1,
				total: 1
			})
		]
	});
}
function DocumentDette(props) {
	const etat = props.etat;
	return /* @__PURE__ */ u$1(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u$1(TitreDocument, {
				titre: "Reconnaissance de dette",
				sousTitre: `Acte sous seing privé · ${dateLongue(dateEmission(etat))}`
			}),
			/* @__PURE__ */ u$1("section", {
				class: "a4-parties",
				children: [/* @__PURE__ */ u$1("div", { children: [
					/* @__PURE__ */ u$1("span", {
						class: "qui",
						children: "L’emprunteur"
					}),
					" ",
					etat.emprunteur.nom,
					etat.emprunteur.piece === "" ? "" : `, ${etat.emprunteur.piece}`
				] }), /* @__PURE__ */ u$1("div", { children: [
					/* @__PURE__ */ u$1("span", {
						class: "qui",
						children: "Le prêteur"
					}),
					" ",
					etat.preteur.nom,
					etat.preteur.piece === "" ? "" : `, ${etat.preteur.piece}`
				] })]
			}),
			/* @__PURE__ */ u$1("section", {
				class: "a4-mentions a4-corps",
				children: /* @__PURE__ */ u$1(Paragraphes, { texte: etat.texte })
			}),
			/* @__PURE__ */ u$1("section", {
				class: "a4-encadre",
				children: [
					/* @__PURE__ */ u$1("div", {
						class: "etiquette",
						children: "Montant du prêt"
					}),
					/* @__PURE__ */ u$1("div", {
						class: "chiffre",
						children: montantF(etat.montant)
					}),
					/* @__PURE__ */ u$1("div", {
						class: "lettres",
						children: [
							"Soit ",
							montantEnLettres(etat.montant),
							"."
						]
					}),
					etat.echeance === "" ? null : /* @__PURE__ */ u$1("div", {
						class: "echeance",
						children: ["Échéance de remboursement : ", /* @__PURE__ */ u$1("strong", { children: etat.echeance })]
					})
				]
			}),
			/* @__PURE__ */ u$1(ZonesSignature, { zones: [{
				libelle: "L’emprunteur",
				mention: "« Lu et approuvé », date et signature"
			}, {
				libelle: "Le prêteur",
				mention: "Date et signature"
			}] }),
			/* @__PURE__ */ u$1("footer", {
				class: "a4-pied",
				children: [/* @__PURE__ */ u$1("div", { children: [
					etat.lieu === "" ? "Fait" : `Fait à ${etat.lieu}`,
					" le",
					" ",
					dateLongue(dateEmission(etat)),
					", en deux exemplaires originaux, dont un remis à chaque partie."
				] }), /* @__PURE__ */ u$1("div", { children: "Acte sous seing privé. Pour un montant important, l’enregistrement auprès des impôts est conseillé." })]
			}),
			/* @__PURE__ */ u$1(NumeroPage, {
				page: 1,
				total: 1
			})
		]
	});
}
function DocumentMotivation(props) {
	const etat = props.etat;
	const e = etat.expediteur;
	return /* @__PURE__ */ u$1(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u$1("section", {
				class: "a4-lettre-tete",
				children: [/* @__PURE__ */ u$1("div", {
					class: "expediteur",
					children: [/* @__PURE__ */ u$1("strong", { children: e.nom }), [
						e.tel,
						e.mail,
						e.ville
					].filter((s) => s !== "").map((s) => /* @__PURE__ */ u$1("div", { children: s }, s))]
				}), /* @__PURE__ */ u$1("div", {
					class: "destinataire",
					children: etat.destinataire.split("\n").filter((l) => l.trim() !== "").map((l, i) => /* @__PURE__ */ u$1("div", { children: l }, `${i}-${l}`))
				})]
			}),
			/* @__PURE__ */ u$1("div", {
				class: "a4-lettre-date",
				children: [e.ville === "" ? "" : `${e.ville}, le `, dateLongue(dateEmission(etat))]
			}),
			/* @__PURE__ */ u$1("div", {
				class: "a4-lettre-objet",
				children: etat.objet
			}),
			/* @__PURE__ */ u$1("section", {
				class: "a4-mentions a4-corps",
				children: etat.corps.trim() === "" ? /* @__PURE__ */ u$1("div", {
					class: "a4-vide",
					children: "Le corps de la lettre reste à écrire."
				}) : /* @__PURE__ */ u$1(Paragraphes, { texte: etat.corps })
			}),
			/* @__PURE__ */ u$1("div", {
				class: "a4-lettre-signature",
				children: e.nom
			}),
			/* @__PURE__ */ u$1(NumeroPage, {
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
	return /* @__PURE__ */ u$1(S, { children: props.points.filter((p) => p.trim() !== "").map((p, i) => /* @__PURE__ */ u$1("div", {
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
	return /* @__PURE__ */ u$1("div", {
		class: "cv-marge",
		children: props.quand
	});
}
function ligneOu(qui, quand, enMarge, separateur) {
	return [qui, enMarge ? "" : quand].filter((s) => s.trim() !== "").join(` ${separateur} `);
}
function Diplomes(props) {
	return /* @__PURE__ */ u$1(S, { children: props.diplomes.map((d, i) => /* @__PURE__ */ u$1("div", {
		class: "cv-item",
		children: [
			/* @__PURE__ */ u$1(Marge, {
				quand: d.annee,
				enMarge: props.enMarge
			}),
			/* @__PURE__ */ u$1("div", {
				class: "cv-quoi",
				children: d.intitule
			}),
			/* @__PURE__ */ u$1("div", {
				class: "cv-ou",
				children: ligneOu(d.etablissement, d.annee, props.enMarge, props.separateur)
			})
		]
	}, `${i}-${d.intitule}`)) });
}
function Postes(props) {
	return /* @__PURE__ */ u$1(S, { children: props.postes.map((p, i) => /* @__PURE__ */ u$1("div", {
		class: "cv-item",
		children: [
			/* @__PURE__ */ u$1(Marge, {
				quand: p.periode,
				enMarge: props.enMarge
			}),
			/* @__PURE__ */ u$1("div", {
				class: "cv-quoi",
				children: p.intitule
			}),
			/* @__PURE__ */ u$1("div", {
				class: "cv-ou",
				children: ligneOu(p.employeur, p.periode, props.enMarge, props.separateur)
			}),
			/* @__PURE__ */ u$1(Faits, { points: p.points })
		]
	}, `${i}-${p.intitule}`)) });
}
/** Le titre d'une section. Rien ne s'affiche si la section est vide. */
function Section(props) {
	if (props.vide) return null;
	return /* @__PURE__ */ u$1(S, { children: [/* @__PURE__ */ u$1("h4", {
		class: "cv-section",
		children: props.titre
	}), props.children] });
}
/** Le profil, écrit en paragraphes comme partout ailleurs dans l'atelier. */
function Profil(props) {
	if (props.texte.trim() === "") return null;
	return /* @__PURE__ */ u$1(S, { children: [/* @__PURE__ */ u$1("h4", {
		class: "cv-section",
		children: props.titre
	}), /* @__PURE__ */ u$1("div", {
		class: "cv-profil",
		children: /* @__PURE__ */ u$1(Paragraphes, { texte: props.texte })
	})] });
}
function Contact(props) {
	return /* @__PURE__ */ u$1("div", {
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
	const experience = /* @__PURE__ */ u$1(Section, {
		titre: t.experience,
		vide: etat.postes.length === 0,
		children: /* @__PURE__ */ u$1(Postes, {
			postes: etat.postes,
			enMarge,
			separateur
		})
	});
	const formation = /* @__PURE__ */ u$1(Section, {
		titre: t.formation,
		vide: etat.diplomes.length === 0,
		children: /* @__PURE__ */ u$1(Diplomes, {
			diplomes: etat.diplomes,
			enMarge,
			separateur
		})
	});
	if (etat.gabarit === "bloc") return /* @__PURE__ */ u$1(PageA4, {
		encre: etat.encre,
		children: [/* @__PURE__ */ u$1("div", {
			class: classes,
			children: [/* @__PURE__ */ u$1("aside", {
				class: "cv-bande",
				children: [
					/* @__PURE__ */ u$1("div", {
						class: "cv-nom",
						children: id.nom
					}),
					/* @__PURE__ */ u$1("div", {
						class: "cv-titre",
						children: id.titre
					}),
					/* @__PURE__ */ u$1(Section, {
						titre: t.contact,
						vide: false,
						children: /* @__PURE__ */ u$1(S, { children: [
							id.tel,
							id.mail,
							id.ville
						].filter((s) => s.trim() !== "").map((s) => /* @__PURE__ */ u$1("div", {
							class: "cv-ligne",
							children: s
						}, s)) })
					}),
					/* @__PURE__ */ u$1(Section, {
						titre: t.competences,
						vide: etat.competences.length === 0,
						children: /* @__PURE__ */ u$1(S, { children: etat.competences.map((c) => /* @__PURE__ */ u$1("div", {
							class: "cv-ligne",
							children: c
						}, c)) })
					}),
					/* @__PURE__ */ u$1(Section, {
						titre: t.langues,
						vide: etat.langues.length === 0,
						children: /* @__PURE__ */ u$1(S, { children: etat.langues.map((l) => /* @__PURE__ */ u$1("div", {
							class: "cv-ligne",
							children: l
						}, l)) })
					})
				]
			}), /* @__PURE__ */ u$1("div", {
				class: "cv-principal",
				children: [
					/* @__PURE__ */ u$1(Profil, {
						texte: etat.resume,
						titre: t.profil
					}),
					experience,
					formation
				]
			})]
		}), /* @__PURE__ */ u$1(NumeroPage, {
			page: 1,
			total: 1
		})]
	});
	return /* @__PURE__ */ u$1(PageA4, {
		encre: etat.encre,
		children: [/* @__PURE__ */ u$1("div", {
			class: classes,
			children: [
				/* @__PURE__ */ u$1("header", {
					class: "cv-tete",
					children: [
						/* @__PURE__ */ u$1("div", {
							class: "cv-nom",
							children: id.nom
						}),
						/* @__PURE__ */ u$1("div", {
							class: "cv-titre",
							children: id.titre
						}),
						/* @__PURE__ */ u$1(Contact, { id })
					]
				}),
				/* @__PURE__ */ u$1(Profil, {
					texte: etat.resume,
					titre: t.profil
				}),
				experience,
				formation,
				/* @__PURE__ */ u$1(Section, {
					titre: t.competences,
					vide: etat.competences.length === 0,
					children: /* @__PURE__ */ u$1("div", {
						class: "cv-serie",
						children: etat.competences.join(" · ")
					})
				}),
				/* @__PURE__ */ u$1(Section, {
					titre: t.langues,
					vide: etat.langues.length === 0,
					children: /* @__PURE__ */ u$1("div", {
						class: "cv-serie",
						children: etat.langues.join(" · ")
					})
				})
			]
		}), /* @__PURE__ */ u$1(NumeroPage, {
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
	return /* @__PURE__ */ u$1(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u$1(Entete, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u$1(TitreDocument, {
				titre: "Devis",
				sousTitre: `N° ${etat.numero} · émis le ${dateLongue(dateEmission(etat))}`
			}),
			/* @__PURE__ */ u$1(BlocClient, {
				nom: etat.client.nom,
				niu: etat.client.niu,
				complement: etat.objet === void 0 ? null : `Objet : ${etat.objet}`
			}),
			/* @__PURE__ */ u$1(TableauLignes, { totaux: c }),
			/* @__PURE__ */ u$1(BlocTotaux, { lignes: totaux }),
			/* @__PURE__ */ u$1("div", {
				class: "a4-en-lettres",
				children: [
					"Soit ",
					montantEnLettres(c.totalTTC),
					", toutes taxes comprises."
				]
			}),
			/* @__PURE__ */ u$1("section", {
				class: "a4-mentions",
				children: [/* @__PURE__ */ u$1("p", { children: [
					"Validité de la présente offre : ",
					etat.validite,
					" à compter de la date d’émission."
				] }), etat.acompte > 0 && /* @__PURE__ */ u$1("p", { children: [
					"Acompte de ",
					etat.acompte,
					" % à la commande, solde à la livraison."
				] })]
			}),
			/* @__PURE__ */ u$1(ZonesSignature, { zones: [{
				libelle: "Le fournisseur",
				mention: "Cachet et signature"
			}, {
				libelle: "Bon pour accord — le client",
				mention: "Date, signature et cachet"
			}] }),
			/* @__PURE__ */ u$1(PiedLegal, {
				emetteur: etat.emetteur,
				complement: "Devis établi en francs CFA. Numérotation unique, continue et chronologique."
			}),
			/* @__PURE__ */ u$1(NumeroPage, {
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
	return /* @__PURE__ */ u$1(PageA4, {
		encre: etat.encre,
		children: [
			/* @__PURE__ */ u$1(Entete, { emetteur: etat.emetteur }),
			/* @__PURE__ */ u$1(TitreDocument, {
				titre: "Facture",
				sousTitre: `N° ${etat.numero} · émise le ${dateLongue(dateEmission(etat))} · échéance le ${echeance}`
			}),
			/* @__PURE__ */ u$1(BlocClient, {
				nom: etat.client.nom,
				niu: etat.client.niu,
				complement: complementClient
			}),
			/* @__PURE__ */ u$1(TableauLignes, { totaux: c }),
			/* @__PURE__ */ u$1(BlocTotaux, { lignes: totaux }),
			/* @__PURE__ */ u$1("div", {
				class: "a4-en-lettres",
				children: [
					"Arrêtée la présente facture à la somme de ",
					montantEnLettres(c.totalTTC),
					", toutes taxes comprises."
				]
			}),
			/* @__PURE__ */ u$1("section", {
				class: "a4-mentions",
				children: [
					c.estSoldee ? /* @__PURE__ */ u$1("p", { children: "Facture soldée. Reçu vaut quittance." }) : /* @__PURE__ */ u$1("p", { children: [
						"Montant à régler : ",
						montantF(c.reste),
						", au plus tard le ",
						echeance,
						".",
						retard > 0 && ` Échéance dépassée de ${retard} jour${retard > 1 ? "s" : ""}.`
					] }),
					etat.conditionsReglement !== "" && /* @__PURE__ */ u$1("p", { children: etat.conditionsReglement }),
					etat.reglements.length > 0 && /* @__PURE__ */ u$1("p", { children: [
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
			/* @__PURE__ */ u$1(ZonesSignature, { zones: [{
				libelle: "Cachet et signature",
				mention: "Pour l’entreprise"
			}] }),
			/* @__PURE__ */ u$1(PiedLegal, {
				emetteur: etat.emetteur,
				complement: "Facture établie en francs CFA. Numérotation unique, continue et chronologique."
			}),
			/* @__PURE__ */ u$1(NumeroPage, {
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
*
* Une page composée est le cas le plus simple des trois : elle **est** faite
* pour être lue derrière un lien. Rien à résumer, rien à rejouer — on la
* dessine, avec le composant que l'aperçu de l'application emploie déjà.
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
/**
* La page que porte l'instantané, si c'en est une et qu'elle tient debout.
*
* Le contrôle est refait ici et pas seulement à la publication : ce qui est
* déjà dans KV a pu être déposé par une version plus ancienne du contrôle, et
* une page à trous vaut mieux refusée qu'affichée sous le nom de quelqu'un.
*/
function pageDe(instantane) {
	if (instantane.skeleton !== "compose-page") return null;
	return verifierPage(instantane.etat).length > 0 ? null : instantane.etat;
}
/**
* Le formulaire que porte l'instantané, si c'en est un et qu'il tient debout.
*
* Même raison que pour la page : ce qui est déjà dans KV a pu être déposé par
* une version plus ancienne du contrôle. Et ici l'enjeu est plus lourd — une
* configuration à trous ne fait pas seulement une page bancale, elle fait un
* formulaire dont les réponses ne se rangent nulle part.
*/
function formulaireDe(instantane) {
	if (instantane.skeleton !== "compose-formulaire") return null;
	return verifierFormulaire(instantane.etat).length > 0 ? null : instantane.etat;
}
/** La facture a besoin de l'instant pour dire son retard ; les autres non. */
function estFacture(skeleton) {
	return skeleton === "facture";
}
function documentDe(instantane, ctx) {
	const page = pageDe(instantane);
	if (page !== null) return /* @__PURE__ */ u$1(PageVitrine, {
		page,
		maintenant: ctx.maintenant
	});
	const Composant = Object.hasOwn(DOCUMENTS, instantane.skeleton) ? DOCUMENTS[instantane.skeleton] : void 0;
	if (Composant === void 0) return null;
	const etat = instantane.etat;
	return estFacture(instantane.skeleton) ? /* @__PURE__ */ u$1(DocumentFacture, {
		etat,
		maintenant: ctx.maintenant
	}) : /* @__PURE__ */ u$1(Composant, { etat });
}
/**
* La carte d'un instantané, quand il n'y a pas de document à dessiner.
*
* Rend `null` si le squelette est inconnu du serveur : un lien publié par une
* version plus récente de l'application ne doit pas faire tomber la page.
*
* Un outil composé par le modèle n'a pas de squelette — sa configuration
* voyage avec lui, dans l'instantané. On la remonte en squelette, exactement
* comme le fait l'écran : c'est la même fabrique. Sans cela, l'outil payé
* était le seul qu'on ne pouvait pas partager.
*/
function carteDe(instantane, ctx) {
	const page = pageDe(instantane);
	if (page !== null) return carteDePage(page, ctx);
	if (formulaireDe(instantane) !== null) return null;
	const squelette = squeletteCompose(instantane) ?? squeletteParId(instantane.skeleton);
	if (squelette === null) return null;
	try {
		return squelette.card(instantane.etat, ctx);
	} catch {
		return null;
	}
}
/** Le squelette que porte l'instantané lui-même, s'il en porte un. */
function squeletteCompose(instantane) {
	if (instantane.registre !== void 0) return squeletteDeRegistre(instantane.registre);
	if (instantane.calcul !== void 0) return squeletteDeCalcul(instantane.calcul);
	return null;
}
/**
* La carte, dessinée en HTML — pas en image.
*
* Elle plafonne sa liste comme le fait l'image partagée, avec le même
* `limiterItems` du moteur. Sans cela l'image annonçait « + 47 autres » et la
* page en listait cinquante-sept : ce n'était plus le même résumé. Et une
* liste de prix de quincaillerie en compte deux cents, ce qui portait la page
* à 29,6 Ko — au-delà du plafond du § 8, et sans limite au-delà.
*/
function VueCarte(props) {
	const c = props.carte;
	const { visibles, reste } = limiterItems(c.items);
	const autres = texteReste(reste);
	return /* @__PURE__ */ u$1("article", {
		class: "lecture-carte",
		children: [
			/* @__PURE__ */ u$1("header", { children: [
				/* @__PURE__ */ u$1("p", {
					class: "kicker",
					children: c.kicker
				}),
				/* @__PURE__ */ u$1("h1", { children: c.title }),
				c.sub !== "" && /* @__PURE__ */ u$1("p", {
					class: "sous",
					children: c.sub
				})
			] }),
			/* @__PURE__ */ u$1("section", {
				class: "grand",
				children: [
					/* @__PURE__ */ u$1("p", {
						class: "etiquette",
						children: c.bigLabel
					}),
					/* @__PURE__ */ u$1("p", {
						class: "chiffre",
						children: c.big
					}),
					c.pct !== null && /* @__PURE__ */ u$1("div", {
						class: "barre",
						role: "img",
						"aria-label": `${Math.round(c.pct * 100)} %`,
						children: /* @__PURE__ */ u$1("i", { style: { width: `${Math.max(0, Math.min(100, Math.round(c.pct * 100)))}%` } })
					}),
					c.subline !== "" && /* @__PURE__ */ u$1("p", {
						class: "ligne",
						children: c.subline
					})
				]
			}),
			visibles.length > 0 && /* @__PURE__ */ u$1("section", {
				class: "detail",
				children: [
					c.listTitle !== "" && /* @__PURE__ */ u$1("p", {
						class: "etiquette",
						children: c.listTitle
					}),
					/* @__PURE__ */ u$1("ul", { children: visibles.map((i) => /* @__PURE__ */ u$1("li", {
						class: i.warn ? "alerte" : i.ok ? "fait" : "",
						children: [/* @__PURE__ */ u$1("span", {
							class: "quoi",
							children: i.n
						}), i.val !== null && /* @__PURE__ */ u$1("span", {
							class: "combien",
							children: i.val
						})]
					}, i.n)) }),
					autres !== null && /* @__PURE__ */ u$1("p", {
						class: "reste",
						children: autres
					})
				]
			})
		]
	});
}
//#endregion
//#region src/html.tsx
/**
* La page complète, en une chaîne.
*
* Le CSS est **inliné** : une feuille séparée serait une requête de plus sur
* une connexion qui hoquette. Il n'y a aucun script, donc rien à charger après
* le premier octet — la page est finie quand elle arrive. Ses commentaires,
* eux, n'ont rien à y faire : voir `sansCommentaires`.
*/
/**
* Les feuilles, allégées une fois pour toutes au chargement du module, et
* **composées selon ce qu'on dessine**.
*
* Elles n'en faisaient qu'une, inlinée partout. Le plafond du § 8 est de 25 Ko
* par page de lecture, et une page composée pleine en pesait 24,8 : les
* deux kilo-octets de style de carte qu'elle n'emploie jamais lui coûtaient un
* douzième de son budget. Chaque forme n'emporte plus que ce qu'elle dessine.
*
* `CSS_CADRE` est le tronc commun — la palette, le corps, le pied. Il est dans
* les trois, parce que les trois en ont besoin.
*/
var CSS_CADRE = sansCommentaires(lecture_default);
var CSS_CARTE = sansCommentaires(carte_default);
/** La mise à l'échelle de la feuille et le lien d'impression : les écrits seuls. */
var CSS_A4 = sansCommentaires(a4_default) + sansCommentaires(a4_default$1);
var CSS_VITRINE = sansCommentaires(vitrine_default);
/** Échappe ce qui part dans un attribut de métadonnée. */
function attr(valeur) {
	return valeur.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function entete(meta) {
	return [
		"<meta charset=\"utf-8\">",
		"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">",
		`<title>${attr(meta.titre)}</title>`,
		`<meta name="description" content="${attr(meta.description)}">`,
		"<meta property=\"og:type\" content=\"website\">",
		`<meta property="og:title" content="${attr(meta.titre)}">`,
		`<meta property="og:description" content="${attr(meta.description)}">`,
		`<meta property="og:url" content="${attr(meta.lien)}">`,
		"<meta property=\"og:site_name\" content=\"Atelier 237\">",
		...meta.image === void 0 ? ["<meta name=\"twitter:card\" content=\"summary\">"] : [
			`<meta property="og:image" content="${attr(meta.image)}">`,
			"<meta property=\"og:image:width\" content=\"1080\">",
			"<meta property=\"og:image:height\" content=\"1080\">",
			"<meta name=\"twitter:card\" content=\"summary_large_image\">"
		],
		"<meta name=\"theme-color\" content=\"#1B5E43\">",
		"<meta name=\"robots\" content=\"noindex\">"
	].join("");
}
function envelopper(meta, css, corps) {
	return `<!doctype html><html lang="fr"><head>${entete(meta)}<style>${css}</style></head><body>${corps}</body></html>`;
}
/**
* Ce que WhatsApp affichera : deux lignes tirées de la carte du squelette, et
* l'image quand elle existe.
*
* `image` reste absente si la carte n'a pas été déposée. Annoncer une
* `og:image` qui rend 404 ferait un aperçu cassé — pire qu'un aperçu sobre,
* parce qu'il donne l'air d'un lien douteux.
*/
function metaDe(instantane, ctx, lien, image) {
	const formulaire = formulaireDe(instantane);
	if (formulaire !== null) return {
		titre: formulaire.titre,
		description: formulaire.accroche,
		lien
	};
	const carte = carteDe(instantane, ctx);
	return {
		titre: carte === null ? instantane.nom : carte.title,
		description: carte === null ? "Document Atelier 237" : [carte.sub, carte.subline].filter((s) => s !== "").join(" · "),
		lien,
		...image === void 0 ? {} : { image }
	};
}
/**
* La page quand le document est déposé mais ne se dessine pas.
*
* Elle existe pour ce qui est **déjà** dans KV : le contrôle à la publication
* ferme la porte devant, il ne réécrit pas ce qui est passé avant lui, et un
* rendu qui change de forme ne doit pas transformer un lien envoyé hier en
* page d'erreur de l'hébergeur.
*/
function pageIllisible() {
	return envelopper({
		titre: "Document illisible — Atelier 237",
		description: "Ce document ne peut pas être affiché.",
		lien: ""
	}, CSS_CADRE, K(/* @__PURE__ */ u$1(PageIllisible, {})));
}
function pageDeLecture(instantane, ctx, lien, image, etat) {
	try {
		return dessiner(instantane, ctx, lien, image, etat);
	} catch {
		return pageIllisible();
	}
}
/**
* La page qu'on lit une fois sa réponse partie.
*
* Une page à part, servie après une redirection, et non le même document avec
* un message en haut : rafraîchir après un `POST` renvoie la même réponse une
* deuxième fois, et personne ne le sait avant de compter les commandes.
*/
function pageDeMerci(instantane, lien) {
	const formulaire = formulaireDe(instantane);
	if (formulaire === null) return pageIntrouvable();
	return envelopper({
		titre: formulaire.titre,
		description: formulaire.accroche,
		lien
	}, CSS_CADRE + CSS_VITRINE, `<main class="lecture">${K(/* @__PURE__ */ u$1(PageMerci, { formulaire }))}</main>` + K(/* @__PURE__ */ u$1(PiedLecture, {
		instantane,
		recoit: true
	})));
}
function dessiner(instantane, ctx, lien, image, etat) {
	const meta = metaDe(instantane, ctx, lien, image);
	const formulaire = formulaireDe(instantane);
	if (formulaire !== null) return envelopper(meta, CSS_CADRE + CSS_VITRINE, `<main class="lecture">${K(/* @__PURE__ */ u$1(PageFormulaire, {
		formulaire,
		action: lien,
		manques: etat?.manques ?? [],
		ferme: etat?.ferme ?? false
	}))}</main>` + K(/* @__PURE__ */ u$1(PiedLecture, {
		instantane,
		recoit: true
	})));
	const vitrine = pageDe(instantane);
	if (vitrine !== null) return envelopper(meta, CSS_CADRE + CSS_VITRINE, `<main class="lecture">${K(/* @__PURE__ */ u$1(PageVitrine, {
		page: vitrine,
		maintenant: ctx.maintenant
	}))}</main>` + K(/* @__PURE__ */ u$1(PiedLecture, { instantane })));
	const document = documentDe(instantane, ctx);
	if (document !== null) return envelopper(meta, CSS_CADRE + CSS_A4, `<main class="lecture">${K(document)}</main>` + K(/* @__PURE__ */ u$1(PiedLecture, {
		instantane,
		pdf: `${lien.replace("/d/", "/p/")}`
	})));
	const carte = carteDe(instantane, ctx);
	if (carte === null) return pageIntrouvable();
	return envelopper(meta, CSS_CADRE + CSS_CARTE, `<main class="lecture">${K(/* @__PURE__ */ u$1(VueCarte, { carte }))}</main>${K(/* @__PURE__ */ u$1(PiedLecture, { instantane }))}`);
}
function pageIntrouvable() {
	return envelopper({
		titre: "Lien introuvable — Atelier 237",
		description: "Ce document n’est plus publié.",
		lien: ""
	}, CSS_CADRE, K(/* @__PURE__ */ u$1(PageIntrouvable, {})));
}
//#endregion
//#region src/worker-lire.ts
/**
* `form-action` : `'none'` partout, `'self'` sur un formulaire.
*
* La politique interdisait tout envoi de formulaire — ce qui était juste tant
* qu'aucune page n'en portait, et devient exactement le mur qui empêche la
* réponse de partir. On ne l'ouvre donc que sur les pages qui reçoivent, et
* seulement vers leur propre origine : une page de devis qui poste ailleurs
* n'a aucune raison d'exister.
*/
function politique(recoit) {
	return `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action ${recoit ? "'self'" : "'none'"}; frame-ancestors 'none'`;
}
function html(statut, corps, cache, recoit = false) {
	return new Response(corps, {
		status: statut,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": cache,
			"content-security-policy": politique(recoit),
			"x-content-type-options": "nosniff",
			"referrer-policy": "strict-origin-when-cross-origin"
		}
	});
}
/** Un corps de formulaire plus gros que ça vient d'ailleurs que d'un pouce. */
var CORPS_MAX = 16384;
async function onRequest(contexte) {
	const brut = contexte.params.lien;
	const lien = Array.isArray(brut) ? brut[0] ?? "" : brut ?? "";
	if (!lienValide(lien)) return html(404, pageIntrouvable(), "no-store");
	const instantane = await contexte.env.INSTANTANES.get(lien, "json");
	if (instantane === null) return html(404, pageIntrouvable(), "no-store");
	if (contexte.request.method === "POST") return repondreAuFormulaire(contexte, lien, instantane);
	if (new URL(contexte.request.url).searchParams.has("merci")) {
		if (formulaireDe(instantane) !== null) return html(200, pageDeMerci(instantane, lien), "no-store");
	}
	const origine = new URL(contexte.request.url).origin;
	const ctx = {
		lien: `${new URL(contexte.request.url).host}/d/${lien}`,
		maintenant: /* @__PURE__ */ new Date()
	};
	const carte = await contexte.env.CARTES.head(lien) === null ? void 0 : `${origine}/c/${lien}.png`;
	const recoit = formulaireDe(instantane) !== null;
	const ferme = recoit && await combienDeReponses(contexte.env.COMPTES, lien) >= 500;
	return html(200, pageDeLecture(instantane, ctx, `${origine}/d/${lien}`, carte, { ferme }), recoit ? "no-store" : "public, max-age=60", recoit);
}
/**
* Une réponse à un formulaire publié.
*
* C'est la seule écriture que le produit accepte d'un inconnu, et trois choses
* tiennent la porte ouverte sans la laisser fracturer : le piège à robots qui
* vit dans la page, un délai entre deux envois du même endroit, et un plafond
* par formulaire. Aucune ne demande quoi que ce soit au visiteur — ni image à
* déchiffrer, ni case à cocher qui charge trois cents kilo-octets de script.
*
* Ce qui est renvoyé est **revalidé contre la configuration publiée** : le nom
* des champs, leur nombre, leur longueur et les valeurs possibles d'un choix.
* Personne ne fait confiance à un corps de requête.
*/
async function repondreAuFormulaire(contexte, lien, instantane) {
	const formulaire = formulaireDe(instantane);
	if (formulaire === null) return html(404, pageIntrouvable(), "no-store");
	const db = contexte.env.COMPTES;
	const maintenant = /* @__PURE__ */ new Date();
	const url = new URL(contexte.request.url);
	const versLaPage = (etat) => {
		return html(200, pageDeLecture(instantane, {
			lien: `${url.host}/d/${lien}`,
			maintenant
		}, `${url.origin}/d/${lien}`, void 0, etat), "no-store", true);
	};
	const brut = await contexte.request.text();
	if (brut.length > CORPS_MAX) return versLaPage({});
	const champs = new URLSearchParams(brut);
	if ((champs.get("ne_rien_ecrire_ici") ?? "") !== "") return Response.redirect(`${url.origin}/d/${lien}?merci=1`, 303);
	const recu = {};
	for (const [clef, valeur] of champs.entries()) recu[clef] = valeur;
	const { contenu, manques } = depouiller(formulaire, recu);
	if (manques.length > 0) return versLaPage({ manques });
	if (Object.keys(contenu).length === 0) return versLaPage({});
	if (await combienDeReponses(db, lien) >= 500) return versLaPage({ ferme: true });
	const source = await empreinteSource(lien, contexte.request.headers.get("cf-connecting-ip"));
	if (source !== null && await tropTot(db, lien, source, maintenant)) return Response.redirect(`${url.origin}/d/${lien}?merci=1`, 303);
	await rangerReponse(db, {
		lien,
		contenu,
		source
	}, maintenant);
	return Response.redirect(`${url.origin}/d/${lien}?merci=1`, 303);
}
//#endregion
export { onRequest };
