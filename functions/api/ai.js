/**
* L'abonnement court-il encore ?
*
* Un abonnement expiré n'est pas une erreur : c'est un compte qui redevient un
* essai, sans rien perdre. Les outils vivent sur le téléphone (§ 2.7) et les
* publications restent en ligne ; ce qui s'arrête, c'est la composition par le
* modèle, la seule chose qui coûte de l'argent à chaque usage.
*/
function abonne(compte, maintenant) {
	if (compte.plan !== "atelier") return false;
	return compte.planExpire !== null && compte.planExpire > maintenant.getTime();
}
/** Un compte neuf, tel qu'il naît au premier appareil qui se présente. */
function compteNeuf(id) {
	return {
		id,
		plan: "essai",
		planExpire: null,
		credits: 5
	};
}
//#endregion
//#region ../comptes/src/quota.ts
var POURQUOI_ABONNEMENT = "Cette demande vaut plusieurs outils d’un coup. Compose-les un par un, ou prends un abonnement.";
var POURQUOI_ESSAI = "Tes compositions d’essai sont utilisées. L’abonnement en donne quarante par mois ; tout le reste de l’atelier continue de marcher sans rien payer.";
var POURQUOI_ATELIER = "Tes quarante compositions du mois sont utilisées. Reprends un mois pour les recharger : les jours qui te restent ne sont pas perdus, ils s’ajoutent.";
function controlerQuota(compte, etage, maintenant) {
	if (etage === 3 && !abonne(compte, maintenant)) return {
		sorte: "abonnement-requis",
		pourquoi: POURQUOI_ABONNEMENT
	};
	if (compte.credits <= 0) return {
		sorte: "credits-epuises",
		pourquoi: abonne(compte, maintenant) ? POURQUOI_ATELIER : POURQUOI_ESSAI
	};
	return { sorte: "passe" };
}
//#endregion
//#region ../engine/src/catalogue.ts
var CATALOGUE = [
	{
		id: "devis",
		glyphe: "▤",
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
		]
	},
	{
		id: "facture",
		glyphe: "▥",
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
		]
	},
	{
		id: "attestation",
		glyphe: "◈",
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
		]
	},
	{
		id: "recu",
		glyphe: "▭",
		group: "documents",
		title: "Reçu",
		keywords: [
			"recu",
			"quittance",
			"acompte",
			"j ai recu",
			"preuve de paiement",
			"versement recu"
		]
	},
	{
		id: "dette",
		glyphe: "◧",
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
		]
	},
	{
		id: "motivation",
		glyphe: "▰",
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
		]
	},
	{
		id: "cv",
		glyphe: "◫",
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
		]
	},
	{
		id: "ardoise",
		glyphe: "◷",
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
		]
	},
	{
		id: "presence",
		glyphe: "◰",
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
		]
	},
	{
		id: "callbox",
		glyphe: "▧",
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
		]
	},
	{
		id: "njangi",
		glyphe: "◉",
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
		]
	},
	{
		id: "prix",
		glyphe: "≡",
		group: "registres",
		title: "Liste de prix",
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
		]
	},
	{
		id: "caisse",
		glyphe: "▣",
		group: "registres",
		title: "Livre de caisse",
		keywords: [
			"caisse",
			"recette",
			"depense",
			"entree sortie",
			"journal",
			"argent du jour",
			"ce que j ai vendu",
			"livre de compte"
		]
	},
	{
		id: "stock",
		glyphe: "▦",
		group: "registres",
		title: "Inventaire",
		keywords: [
			"stock",
			"inventaire",
			"magasin",
			"quantite",
			"marchandise",
			"ce qui me reste",
			"reappro"
		]
	},
	{
		id: "clients",
		glyphe: "◇",
		group: "registres",
		title: "Clients",
		keywords: [
			"client",
			"contact",
			"annuaire",
			"repertoire",
			"numero",
			"carnet d adresses",
			"mes contacts"
		]
	},
	{
		id: "scolarite",
		glyphe: "◪",
		group: "calculs",
		title: "Frais scolaires",
		keywords: [
			"scolarite",
			"frais",
			"ecole",
			"pension",
			"rentree",
			"inscription",
			"fournitures",
			"eleve"
		]
	},
	{
		id: "course",
		glyphe: "▲",
		group: "calculs",
		title: "Partage de course",
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
		]
	}
];
//#endregion
//#region ../engine/src/format.ts
/**
* Forme de comparaison : minuscules, sans accent, sans ponctuation.
* Sert à l'étage 1 du moteur (correspondance de mots-clés, zéro jeton).
*/
function normaliser(s) {
	return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
//#endregion
//#region ../engine/src/match.ts
function classer(demande, squelettes) {
	const texte = normaliser(demande);
	if (texte === "") return [];
	return squelettes.map((squelette) => {
		const nom = normaliser(squelette.title ?? "");
		const reconnus = squelette.keywords.filter((k) => texte.includes(normaliser(k)));
		return {
			squelette,
			score: reconnus.reduce((a, k) => {
				const plat = normaliser(k);
				const nomme = nom !== "" && nom.includes(plat);
				return a + k.length * (nomme ? 2 : 1) / (introduitParPreposition(texte, plat) ? 2 : 1);
			}, 0),
			reconnus
		};
	}).filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
}
var PREPOSITION = "(?:pour|de|du|des|a|au|aux|avec|chez|sur|en|dans|par)\\s+(?:mon|ma|mes|le|la|les|un|une|des|ce|cette|ces|l)?\\s*";
/**
* Vrai si **toutes** les occurrences du mot sont introduites par une
* préposition. Une seule occurrence en position de sujet suffit à ce que le
* mot compte plein tarif : « prix, liste de prix » demande bien des prix.
*/
function introduitParPreposition(texte, mot) {
	if (mot === "") return false;
	const echappe = mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const toutes = [...texte.matchAll(new RegExp(echappe, "g"))];
	if (toutes.length === 0) return false;
	const precede = new RegExp(`${PREPOSITION}${echappe}`, "g");
	return [...texte.matchAll(precede)].length === toutes.length;
}
//#endregion
//#region ../engine/src/etage.ts
/**
* Les marques d'une demande qui dépasse un outil.
*
* Elles sont volontairement peu nombreuses et sans ambiguïté. Un classement
* trop zélé enverrait vers l'abonnement quelqu'un qui voulait un seul carnet,
* et c'est le pire des deux échecs : refuser de vendre à quelqu'un qui payait.
*/
var PLURIEL = [
	/\btout ce qu il faut\b/,
	/\btout pour\b/,
	/\btoute (?:ma|la) gestion\b/,
	/\bplusieurs outils?\b/,
	/\bles outils\b/,
	/\bgerer (?:toute|tout)\b/,
	/\bde a a z\b/,
	/\bcomplet(?:e|s)?\b/
];
/**
* Deux familles distinctes dans la même phrase, c'est deux outils.
*
* « un carnet de njangi et une liste de prix » n'est pas une demande ambiguë
* qu'il faudrait faire trancher : c'est deux demandes, et les faire l'une
* après l'autre coûte deux générations.
*/
/**
* Le score en dessous duquel une famille n'a pas vraiment été nommée.
*
* Dix, c'est un mot de cinq lettres qui porte le nom de l'outil — « njangi »,
* « devis », « stock ». En dessous, on a reconnu un mot qui gravite autour de
* l'outil sans le désigner.
*
* Un seuil **absolu**, et non une fraction du meilleur score : le score mesure
* la longueur des mots reconnus, pas la confiance. Dans « un njangi, une liste
* de prix et un inventaire », les trois sont nommés sans ambiguïté et pèsent
* pourtant 30, 20 et 12 — la moitié du meilleur écartait le troisième.
*/
var SCORE_NOMME = 10;
function famillesDistinctes(demande, fiches) {
	return classer(demande, fiches).filter((c) => c.score >= SCORE_NOMME).length;
}
function etageDe(demande, fiches) {
	const plat = normaliser(demande);
	if (plat === "") return 1;
	if (PLURIEL.some((re) => re.test(plat))) return 3;
	if (famillesDistinctes(demande, fiches) >= 3) return 3;
	const classees = classer(demande, fiches);
	const premier = classees[0];
	const second = classees[1];
	if (premier !== void 0 && (second === void 0 || premier.score >= second.score * 1.5)) return 1;
	return premier === void 0 ? 2 : 1;
}
/**
* La description que lit le modèle — en prose, pas en schéma.
*
* Un schéma JSON récursif ne se déclare pas sans `$ref`, que le validateur
* écrit à la main ne connaît pas. La première version dépliait donc l'arbre :
* chaque niveau embarquait deux fois le sous-schéma, soit soixante-quatre
* copies de la feuille et **quarante mille caractères** — dix mille jetons
* d'invite à chaque appel, contre deux mille sept cents pour un registre
* entier. Le coût d'une génération est passé de 0,13 à 0,76 franc, et le
* modèle, noyé sous la répétition, refusait des demandes qu'il savait traiter.
*
* Trois lignes de français disent la même chose et se lisent mieux. La
* vérification, elle, ne coûte rien et reste exhaustive : `verifierExpression`
* parcourt l'arbre lui-même.
*/
var DESCRIPTION_FORMULE = "Un arbre. Chaque nœud est exactement l’une de ces trois formes : {\"nombre\": 19.25} une constante ; {\"ref\": \"total\"} une entrée déclarée ; {\"op\": \"moins\", \"gauche\": …, \"droite\": …} une opération, où gauche et droite sont eux-mêmes des nœuds. Opérations : plus, moins, fois, divise, pourcent (gauche × droite ÷ 100), min, max. Six niveaux d'imbrication au plus. Exemple — le reste à payer : {\"op\":\"moins\",\"gauche\":{\"ref\":\"total\"},\"droite\":{\"ref\":\"verse\"}}";
/**
* Ce que le schéma ne dit pas : qu'un nœud est **exactement** l'une des trois
* formes, et que chaque `ref` désigne une entrée qui existe.
*
* Un schéma d'union serait plus juste, mais `JsonSchema` ici n'a pas de
* `oneOf` — et l'ajouter pour ce seul usage compliquerait un validateur écrit
* à la main que tout le reste du moteur emploie. On le vérifie donc à côté.
*/
function verifierExpression(valeur, clefs, chemin = "$.formule") {
	return formes(valeur, clefs, chemin, 0);
}
var OPERATIONS = [
	"plus",
	"moins",
	"fois",
	"divise",
	"pourcent",
	"min",
	"max"
];
/**
* Vérifie l'arbre nœud par nœud.
*
* Elle fait tout : la forme, les types, l'ensemble fermé des opérations, les
* références, la profondeur. Un schéma déplié faisait la moitié du travail
* pour quarante mille caractères ; cette marche fait tout pour rien.
*/
function formes(valeur, clefs, chemin, niveau) {
	if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return [{
		chemin,
		message: "un nœud de formule est un objet"
	}];
	const o = valeur;
	const inconnus = Object.keys(o).filter((c) => ![
		"nombre",
		"ref",
		"op",
		"gauche",
		"droite"
	].includes(c));
	if (inconnus.length > 0) return [{
		chemin,
		message: `champ inconnu : « ${inconnus.join(" », « ")} »`
	}];
	const presents = [
		"nombre",
		"ref",
		"op"
	].filter((c) => o[c] !== void 0);
	if (presents.length !== 1) return [{
		chemin,
		message: presents.length === 0 ? "un nœud vide : mets « nombre », « ref », ou « op » avec « gauche » et « droite »" : `« ${presents.join(" » et « ")} » ensemble : un nœud est une seule de ces trois formes`
	}];
	if (o["nombre"] !== void 0) return typeof o["nombre"] === "number" && Number.isFinite(o["nombre"]) ? [] : [{
		chemin,
		message: "« nombre » doit être un nombre fini"
	}];
	if (o["ref"] !== void 0) {
		if (typeof o["ref"] !== "string") return [{
			chemin,
			message: "« ref » doit être la clef d’une entrée"
		}];
		return clefs.includes(o["ref"]) ? [] : [{
			chemin,
			message: `« ${o["ref"]} » ne désigne aucune entrée (elles s’appellent ${clefs.join(", ")})`
		}];
	}
	if (typeof o["op"] !== "string" || !OPERATIONS.includes(o["op"])) return [{
		chemin,
		message: `« ${String(o["op"])} » n’est pas une opération connue (${OPERATIONS.join(", ")})`
	}];
	if (niveau >= 6) return [{
		chemin,
		message: `formule trop profonde : 6 niveaux au plus`
	}];
	const erreurs = [];
	for (const cote of ["gauche", "droite"]) if (o[cote] === void 0) erreurs.push({
		chemin: `${chemin}.${cote}`,
		message: `« ${o["op"]} » exige ${cote}`
	});
	else erreurs.push(...formes(o[cote], clefs, `${chemin}.${cote}`, niveau + 1));
	return erreurs;
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
var schemaCalcul = {
	type: "object",
	additionalProperties: false,
	required: [
		"titre",
		"kicker",
		"titreNom",
		"entrees",
		"sortie"
	],
	properties: {
		titre: {
			type: "string",
			minLength: 2,
			maxLength: 40,
			description: "Ce que la calculatrice répond. Ex. « Reste à payer »."
		},
		kicker: {
			type: "string",
			minLength: 2,
			maxLength: 30,
			description: "Le même, en capitales."
		},
		titreNom: {
			type: "string",
			minLength: 2,
			maxLength: 40,
			description: "Comment nommer cet outil-ci. Ex. « Nom de l’élève »."
		},
		entrees: {
			type: "array",
			minItems: 1,
			maxItems: 5,
			description: "Ce que l’utilisateur saisit. Des nombres, jamais du texte.",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"clef",
					"titre",
					"defaut",
					"unite"
				],
				properties: {
					clef: {
						type: "string",
						minLength: 1,
						maxLength: 24,
						description: "Identifiant : lettres non accentuées, chiffres, soulignés."
					},
					titre: {
						type: "string",
						minLength: 1,
						maxLength: 32,
						description: "Ex. « Déjà versé »."
					},
					defaut: {
						type: "number",
						minimum: 0,
						description: "La valeur au départ. 0 si on ne sait pas."
					},
					unite: {
						type: "string",
						enum: ["F", ""],
						description: "F pour des francs, vide sinon."
					}
				}
			}
		},
		sortie: {
			type: "object",
			additionalProperties: false,
			required: [
				"libelle",
				"unite",
				"formule"
			],
			properties: {
				libelle: {
					type: "string",
					minLength: 2,
					maxLength: 32,
					description: "Ex. « Reste à payer »."
				},
				unite: {
					type: "string",
					enum: ["F", ""]
				},
				formule: {
					type: "object",
					properties: {},
					description: DESCRIPTION_FORMULE
				}
			}
		}
	}
};
/**
* Ce que le schéma ne dit pas : que la formule ne parle que d'entrées
* déclarées, et que deux entrées ne portent pas la même clef.
*
* Une formule qui référence une entrée absente rendrait zéro sans rien dire —
* le pire résultat possible pour une calculatrice, parce qu'un zéro ressemble
* à une réponse.
*/
function verifierCalcul(valeur) {
	const erreurs = [...valider(schemaCalcul, valeur)];
	if (erreurs.length > 0) return erreurs;
	const c = valeur;
	const clefs = c.entrees.map((e) => e.clef);
	for (const [i, e] of c.entrees.entries()) if (!/^[a-z][a-zA-Z0-9_]*$/.test(e.clef)) erreurs.push({
		chemin: `$.entrees[${i}].clef`,
		message: `« ${e.clef} » : la clef ne prend que des lettres non accentuées, des chiffres et des soulignés, et commence par une minuscule`
	});
	const doublons = clefs.filter((c2, i) => clefs.indexOf(c2) !== i);
	for (const d of new Set(doublons)) erreurs.push({
		chemin: "$.entrees",
		message: `la clef « ${d} » apparaît deux fois`
	});
	erreurs.push(...verifierExpression(c.sortie.formule, clefs, "$.sortie.formule"));
	return erreurs;
}
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
/**
* Vérifie ce que le modèle a rendu, au-delà de ce que le schéma sait dire.
*
* Deux incohérences que le schéma ne peut pas exprimer, et qui font toutes deux
* un formulaire qu'on ne peut pas remplir : une clef en double — la seconde
* réponse écraserait la première sans que rien ne le montre — et un champ
* « choix » sans options, qui est une question dont aucune réponse n'est
* possible.
*/
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
//#endregion
//#region ../engine/src/schema-modele.ts
/**
* Le schéma tel qu'il part au modèle : sans ce qui ne sert qu'à l'écran.
*
* Un même schéma fait deux métiers. Il dit au modèle quoi remplir, et il dresse
* le formulaire qui permet de corriger ce qu'il a rempli — c'est ce qui fait
* qu'une page composée se reprend : le contrat qui a servi à l'écrire sert à la
* modifier, et un champ ajouté apparaît des deux côtés sans qu'on y pense.
*
* Mais les deux publics ne lisent pas la même chose. `title` nomme un champ
* dans un formulaire ; le modèle, lui, a déjà la clef sous les yeux et n'en
* fait rien. `montrerSi` dit à l'écran quand un champ a lieu d'être montré ;
* pour le modèle, c'est un mot-clef inconnu au milieu d'un schéma qu'on lui
* demande de respecter à la lettre.
*
* Chaque caractère d'invite se paie à chaque appel, sur un budget d'un franc
* la génération (§ 8). Ce qui n'aide pas à remplir un JSON n'a rien à y faire.
*/
function pourLeModele(schema) {
	const { title, ecran, ...reste } = schema;
	if (reste.type === "array") return {
		...reste,
		items: pourLeModele(reste.items)
	};
	if (reste.type === "object") {
		const proprietes = reste.properties;
		return {
			...reste,
			properties: Object.fromEntries(Object.entries(proprietes).map(([clef, sous]) => [clef, pourLeModele(sous)]))
		};
	}
	return reste;
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
						description: "texte : un paragraphe. liste : des noms. prix : des noms avec un montant."
					},
					texte: {
						type: "string",
						maxLength: 400,
						title: "Texte",
						description: "Pour une section « texte ». Deux paragraphes au plus.",
						ecran: { montrerSi: {
							champ: "sorte",
							vaut: ["texte"]
						} }
					},
					lignes: {
						type: "array",
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
						description: "Pour « liste » ou « prix ».",
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
			description: "Le numéro qu’on peut écrire. Ex. « 6 99 41 27 08 »."
		},
		adresse: {
			type: "string",
			maxLength: 90,
			title: "Où",
			description: "Le quartier et la rue. Ex. « Rue Bépanda-Omnisport, en face du marché »."
		},
		horaires: {
			type: "string",
			maxLength: 60,
			title: "Quand",
			description: "Ex. « Lundi à samedi, 7 h – 19 h »."
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
* Le schéma que l'invite impose au modèle.
*
* Les `description` ne sont pas de la documentation : elles sont lues par le
* modèle et ce sont elles qui font la différence entre une colonne « montant »
* et une colonne « nombre ». Écrites pour lui, donc, pas pour nous.
*/
var schemaRegistre = {
	type: "object",
	additionalProperties: false,
	required: [
		"titre",
		"kicker",
		"titreNom",
		"colonnes",
		"libelleVide",
		"libelleAjout",
		"relancesVides"
	],
	properties: {
		titre: {
			type: "string",
			minLength: 2,
			maxLength: 40,
			title: "Nom de l’outil",
			description: "Court, au singulier, sans article. Ex. « Suivi des livraisons »."
		},
		kicker: {
			type: "string",
			minLength: 2,
			maxLength: 30,
			title: "Sur-titre de la carte",
			description: "Le même, en capitales, pour la carte partagée. Ex. « SUIVI DES LIVRAISONS »."
		},
		titreNom: {
			type: "string",
			minLength: 2,
			maxLength: 40,
			title: "Libellé du nom",
			description: "Comment on demande à l’utilisateur de nommer son registre. Ex. « Nom du dépôt »."
		},
		colonnes: {
			type: "array",
			minItems: 1,
			maxItems: 6,
			title: "Colonnes",
			description: "La première nomme la ligne — mets devant celle qui identifie le mieux. Au plus une colonne de type bascule.",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"clef",
					"titre",
					"type"
				],
				properties: {
					clef: {
						type: "string",
						minLength: 1,
						maxLength: 24,
						description: "Identifiant : lettres non accentuées, chiffres, soulignés. Commence par une minuscule. Ex. « prixUnitaire » ou « prix_unitaire »."
					},
					titre: {
						type: "string",
						minLength: 1,
						maxLength: 32,
						description: "Ce que voit l’utilisateur. Ex. « Prix (F CFA) »."
					},
					type: {
						type: "string",
						enum: [
							"texte",
							"montant",
							"nombre",
							"bascule"
						],
						description: "montant = une somme en francs CFA ; nombre = une quantité ; bascule = oui/non."
					}
				}
			}
		},
		libelleVide: {
			type: "string",
			minLength: 4,
			maxLength: 80,
			description: "Ce qu’on lit quand le registre est vide. Ex. « L’inventaire est vide. »"
		},
		libelleAjout: {
			type: "string",
			minLength: 4,
			maxLength: 40,
			description: "Le bouton d’ajout. Ex. « Ajouter un article »."
		},
		relancesVides: {
			type: "string",
			minLength: 4,
			maxLength: 160,
			description: "Pourquoi ce registre ne se relance pas. Une phrase."
		},
		total: {
			type: "object",
			additionalProperties: false,
			required: ["type", "libelle"],
			description: "À n’écrire que si totaliser ce registre a un sens.",
			properties: {
				type: {
					type: "string",
					enum: ["somme", "difference"]
				},
				clef: {
					type: "string",
					maxLength: 24,
					description: "Pour une somme : la colonne à additionner."
				},
				plus: {
					type: "string",
					maxLength: 24,
					description: "Pour une différence : la colonne ajoutée."
				},
				moins: {
					type: "string",
					maxLength: 24,
					description: "Pour une différence : la colonne retranchée."
				},
				libelle: {
					type: "string",
					minLength: 2,
					maxLength: 24,
					description: "Ex. « Solde »."
				},
				unite: {
					type: "string",
					enum: ["F", ""],
					description: "F pour des francs, vide sinon."
				}
			}
		},
		personnes: {
			type: "boolean",
			description: "Vrai seulement si chaque ligne nomme quelqu’un — un annuaire, une présence."
		}
	}
};
var schemaRefus = {
	type: "object",
	additionalProperties: false,
	required: ["impossible"],
	properties: { impossible: {
		type: "string",
		minLength: 4,
		maxLength: 160,
		description: "Pourquoi la demande ne se range pas dans un registre. Une phrase, en français, adressée à l’utilisateur."
	} }
};
function verifierRegistre(valeur) {
	const erreurs = [...valider(schemaRegistre, valeur)];
	if (erreurs.length > 0) return erreurs;
	const r = valeur;
	const clefs = r.colonnes.map((c) => c.clef);
	for (const [i, c] of r.colonnes.entries()) if (!/^[a-z][a-zA-Z0-9_]*$/.test(c.clef)) {
		const fautifs = [...new Set([...c.clef].filter((x) => !/[a-zA-Z0-9_]/.test(x)))];
		erreurs.push({
			chemin: `$.colonnes[${i}].clef`,
			message: fautifs.length > 0 ? `« ${c.clef} » contient ${fautifs.map((x) => `« ${x} »`).join(", ")} : la clef ne prend que des lettres non accentuées, des chiffres et des soulignés` : `« ${c.clef} » doit commencer par une lettre minuscule`
		});
	}
	const doublons = clefs.filter((c, i) => clefs.indexOf(c) !== i);
	for (const d of new Set(doublons)) erreurs.push({
		chemin: "$.colonnes",
		message: `la clef « ${d} » apparaît deux fois`
	});
	if (r.colonnes.filter((c) => c.type === "bascule").length > 1) erreurs.push({
		chemin: "$.colonnes",
		message: "une seule colonne de type bascule : c’est l’interrupteur de la ligne"
	});
	const t = r.total;
	if (t !== void 0) {
		const exige = t.type === "somme" ? [["clef", t.clef]] : [["plus", t.plus], ["moins", t.moins]];
		for (const [champ, clef] of exige) if (clef === void 0) erreurs.push({
			chemin: `$.total.${champ}`,
			message: `un total « ${t.type} » exige ${champ}`
		});
		else if (!clefs.includes(clef)) erreurs.push({
			chemin: `$.total.${champ}`,
			message: `« ${clef} » ne désigne aucune colonne (elles s’appellent ${clefs.join(", ")})`
		});
	}
	return erreurs;
}
//#endregion
//#region ../engine/src/composition.ts
/**
* Coupe à la longueur voulue, et à un mot.
*
* Trancher au caractère près laisserait « je ne peux pas créer ce regis… » :
* la coupure se voit, et elle donne l'air d'une panne plutôt que d'une phrase
* abrégée. On recule jusqu'à la dernière espace, et les points de suspension
* disent qu'il y avait une suite.
*/
function raccourcir(texte, max) {
	if (texte.length <= max) return texte;
	const brut = texte.slice(0, max - 1);
	const espace = brut.lastIndexOf(" ");
	return `${(espace > max / 2 ? brut.slice(0, espace) : brut).trimEnd()}…`;
}
/**
* A-t-on reçu le schéma au lieu d'un objet qui le respecte ?
*
* Mesuré en production : une demande sur dix recevait notre propre schéma,
* renvoyé tel quel. Il est long, il se fait couper en route, et le reproche qui
* suivait — « la réponse n'est pas du JSON » — ne disait rien de ce qui s'était
* passé. La reprise repartait donc au hasard, et coûtait un tour pour rien.
*
* `properties` avec `type` à la racine ne se rencontre que là : un registre a
* `titre` et `colonnes`, une calculatrice `entrees`, un refus `impossible`.
* Une colonne peut très bien s'appeler « type » — un registre de motos en a
* un — mais elle vit dans `colonnes`, pas à la racine.
*/
function estUnSchema(valeur) {
	return "properties" in valeur && ("type" in valeur || "$schema" in valeur);
}
function lireReponseModele(valeur) {
	if (typeof valeur !== "object" || valeur === null) return {
		sorte: "invalide",
		erreurs: [{
			chemin: "$",
			message: "la réponse n’est pas un objet"
		}]
	};
	if (estUnSchema(valeur)) return {
		sorte: "invalide",
		erreurs: [{
			chemin: "$",
			message: "tu as renvoyé le schéma. Renvoie un objet qui le respecte : ses champs remplis pour la demande, pas sa description."
		}]
	};
	if ("impossible" in valeur) {
		const brut = valeur.impossible;
		const coupe = typeof brut === "string" ? raccourcir(brut, 160) : brut;
		const erreurs = valider(schemaRefus, {
			...valeur,
			impossible: coupe
		});
		return erreurs.length > 0 ? {
			sorte: "invalide",
			erreurs
		} : {
			sorte: "refus",
			pourquoi: coupe
		};
	}
	if ("champs" in valeur) {
		const erreurs = verifierFormulaire(valeur);
		return erreurs.length > 0 ? {
			sorte: "invalide",
			erreurs
		} : {
			sorte: "formulaire",
			formulaire: valeur
		};
	}
	if ("sections" in valeur) {
		const erreurs = verifierPage(valeur);
		return erreurs.length > 0 ? {
			sorte: "invalide",
			erreurs
		} : {
			sorte: "page",
			page: valeur
		};
	}
	if ("entrees" in valeur) {
		const erreurs = verifierCalcul(valeur);
		return erreurs.length > 0 ? {
			sorte: "invalide",
			erreurs
		} : {
			sorte: "calcul",
			calcul: valeur
		};
	}
	const erreurs = verifierRegistre(valeur);
	return erreurs.length > 0 ? {
		sorte: "invalide",
		erreurs
	} : {
		sorte: "registre",
		registre: valeur
	};
}
//#endregion
//#region ../comptes/src/identite.ts
function hex(octets) {
	return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}
function jetonValide(jeton) {
	return jeton.length === 32 && /^[0-9a-f]+$/.test(jeton);
}
/** Ce que le serveur range à la place du jeton. */
async function empreinte(secret) {
	const condense = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
	return hex(new Uint8Array(condense));
}
//#endregion
//#region ../comptes/src/base.ts
function versCompte(ligne) {
	return {
		id: ligne.id,
		plan: ligne.plan === "atelier" ? "atelier" : "essai",
		planExpire: ligne.plan_expire,
		credits: ligne.credits
	};
}
/**
* Le compte que porte cet appareil, ouvert s'il n'existait pas.
*
* L'ouverture est paresseuse et sans un mot : personne ne s'inscrit pour se
* servir de l'atelier (§ 2), et le serveur ne voit un appareil qu'au premier
* appel qui coûte quelque chose.
*
* L'ordre des écritures n'est pas indifférent, et la clé étrangère le décide :
* un appareil ne peut pas désigner un compte qui n'existe pas. On ouvre donc un
* compte candidat, puis on tente le lien. Deux requêtes simultanées d'un même
* appareil neuf se disputent la clé primaire de `appareils`, `INSERT OR IGNORE`
* en laisse passer une, et la relecture dit laquelle a gagné — la perdante
* remballe son candidat, qui n'a jamais porté personne.
*
* `INSERT OR IGNORE` sur les comptes compte autant : sans lui, revenir
* remettrait les crédits à cinq et l'essai n'aurait pas de fin.
*/
async function compteDeLAppareil(db, empreinte, maintenant) {
	const t = maintenant.getTime();
	const candidat = compteNeuf(crypto.randomUUID());
	await db.prepare("INSERT OR IGNORE INTO comptes (id, plan, plan_expire, credits, cree_le) VALUES (?, ?, ?, ?, ?)").bind(candidat.id, candidat.plan, candidat.planExpire, candidat.credits, t).run();
	await db.prepare("INSERT OR IGNORE INTO appareils (empreinte, compte_id, vu_le) VALUES (?, ?, ?)").bind(empreinte, candidat.id, t).run();
	const compteId = (await db.prepare("SELECT compte_id FROM appareils WHERE empreinte = ?").bind(empreinte).first())?.compte_id ?? candidat.id;
	if (compteId !== candidat.id) await db.prepare("DELETE FROM comptes WHERE id = ? AND NOT EXISTS (SELECT 1 FROM appareils WHERE compte_id = ?)").bind(candidat.id, candidat.id).run();
	const ligne = await db.prepare("SELECT id, plan, plan_expire, credits FROM comptes WHERE id = ?").bind(compteId).first();
	if (ligne === null) throw new Error(`compte introuvable après ouverture : ${compteId}`);
	await db.prepare("UPDATE appareils SET vu_le = ? WHERE empreinte = ?").bind(t, empreinte).run();
	return versCompte(ligne);
}
/**
* Retire un crédit, ou rend faux.
*
* La condition est **dans la requête** et non autour d'elle. Deux appels
* simultanés d'un compte à qui il reste un crédit passeraient tous les deux un
* contrôle fait en JavaScript, et on paierait deux générations pour un crédit ;
* ici, le second ne change aucune ligne et l'apprend.
*/
async function prendreUnCredit(db, compteId) {
	return ((await db.prepare("UPDATE comptes SET credits = credits - 1 WHERE id = ? AND credits > 0").bind(compteId).run()).meta?.changes ?? 0) > 0;
}
/**
* Rend le crédit d'un appel qui n'est jamais parti.
*
* On réserve avant d'appeler, parce que c'est le seul ordre qui empêche de
* dépenser deux fois. Reste le cas où le modèle n'a jamais été joint : aucun
* jeton n'a été consommé, et retenir le crédit ferait payer une panne de
* réseau à quelqu'un qui n'en a que cinq.
*/
async function rendreUnCredit(db, compteId) {
	await db.prepare("UPDATE comptes SET credits = credits + 1 WHERE id = ?").bind(compteId).run();
}
/** Le journal des coûts. Sans lui, le plafond du § 8 ne se mesure pas. */
async function journaliser(db, appel, maintenant) {
	await db.prepare("INSERT INTO appels_ia (id, compte_id, etage, jetons_entree, jetons_sortie, cout_xaf, ok, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), appel.compteId, appel.etage, appel.jetonsEntree, appel.jetonsSortie, appel.coutXaf, appel.ok ? 1 : 0, maintenant.getTime()).run();
}
function jetonDeLEntete(entetes) {
	const brut = entetes.get("authorization");
	if (brut === null) return null;
	const [schema, jeton] = brut.split(" ");
	if (schema !== "Appareil" || jeton === void 0) return null;
	return jeton;
}
async function ouvrirSeance(db, jeton, maintenant) {
	const compte = await compteDeLAppareil(db, await empreinte(jeton), maintenant);
	return {
		compte,
		maintenant,
		prendreUnCredit: () => prendreUnCredit(db, compte.id),
		rendreUnCredit: () => rendreUnCredit(db, compte.id),
		journaliser: (appel) => journaliser(db, {
			...appel,
			compteId: compte.id
		}, maintenant)
	};
}
//#endregion
//#region src/fournisseur.ts
/**
* Une panne de fournisseur, nommée.
*
* Une seule distinction compte vraiment : **le crédit épuisé n'est pas une
* panne**. C'est un compte à recharger, et le dire « le modèle n'a pas
* répondu » envoie l'utilisateur chercher un problème qui n'existe pas
* pendant que la vraie cause tient en une phrase. Le brief en fait un critère
* d'arrêt : « le chemin plus de crédits est propre » (§ 8).
*/
var ErreurFournisseur = class extends Error {
	sorte;
	constructor(sorte, message) {
		super(message);
		this.sorte = sorte;
		this.name = "ErreurFournisseur";
	}
};
/**
* Gemini 2.5 Flash-Lite, le choix par défaut du brief.
*
* `responseMimeType: application/json` fait produire du JSON par construction
* plutôt que par prière. Ça ne dispense pas de valider — un JSON bien formé
* peut décrire n'importe quoi — mais ça supprime la classe d'échec la plus
* bête : la réponse enveloppée dans un bloc de code et des politesses.
*/
function gemini(clef, modele = "gemini-2.5-flash-lite") {
	return {
		nom: modele,
		prix: {
			entree: .1,
			sortie: .4
		},
		async appeler(demande) {
			const tours = [{
				role: "user",
				parts: [{ text: demande.invite }]
			}];
			if (demande.reprise !== void 0) {
				tours.push({
					role: "model",
					parts: [{ text: demande.reprise.sortie }]
				});
				tours.push({
					role: "user",
					parts: [{ text: demande.reprise.reproches }]
				});
			}
			const reponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-goog-api-key": clef
				},
				body: JSON.stringify({
					contents: tours,
					generationConfig: {
						responseMimeType: "application/json",
						temperature: 0,
						maxOutputTokens: 2048
					}
				})
			});
			if (!reponse.ok) throw new ErreurFournisseur(reponse.status === 429 ? "credit-epuise" : reponse.status === 403 ? "refuse" : "panne", `le modèle a répondu ${reponse.status}`);
			const corps = await reponse.json();
			return {
				texte: corps.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
				jetonsEntree: corps.usageMetadata?.promptTokenCount ?? 0,
				jetonsSortie: corps.usageMetadata?.candidatesTokenCount ?? 0
			};
		}
	};
}
/**
* OpenRouter : un routeur, pas un modèle.
*
* Il parle la forme d'API d'OpenAI et mène à des centaines de modèles, dont
* celui du brief. L'intérêt ici n'est pas la variété — c'est qu'il permet de
* changer de modèle **sans redéployer**, par une variable d'environnement.
* Le brief pose un budget (moins d'un franc la génération, § 8) et non une
* marque ; pouvoir en essayer un autre le lendemain vaut mieux que d'avoir
* bien deviné le premier jour.
*
* Deux prudences.
*
* `response_format` n'est pas compris par tous les modèles du routeur. On le
* demande — il réduit les reprises, et une reprise double le coût — mais si la
* requête est refusée, on recommence **une fois sans lui** : l'invite exige
* déjà du JSON nu et `lireJson` sait déshabiller un bloc de code. Ainsi
* n'importe quel modèle reste utilisable, et le choix redevient une décision
* de gestion plutôt qu'une contrainte technique.
*
* Et le coût vient du routeur quand il le donne (`usage.cost`), parce qu'il
* applique sa marge et que notre table de prix ne la connaît pas.
*/
function openrouter(clef, modele = "google/gemini-2.5-flash-lite", prix = {
	entree: .1,
	sortie: .4
}) {
	return {
		nom: modele,
		prix,
		async appeler(demande) {
			const messages = [{
				role: "user",
				content: demande.invite
			}];
			if (demande.reprise !== void 0) {
				messages.push({
					role: "assistant",
					content: demande.reprise.sortie
				});
				messages.push({
					role: "user",
					content: demande.reprise.reproches
				});
			}
			const base = {
				model: modele,
				messages,
				temperature: 0,
				max_tokens: 2048,
				usage: { include: true }
			};
			let reponse = await envoyer(clef, {
				...base,
				response_format: { type: "json_object" }
			});
			if (reponse.status >= 400 && reponse.status < 500 && reponse.status !== 401) reponse = await envoyer(clef, base);
			if (!reponse.ok) throw new ErreurFournisseur(reponse.status === 402 ? "credit-epuise" : reponse.status === 401 ? "refuse" : "panne", `le routeur a répondu ${reponse.status}`);
			const corps = await reponse.json();
			const dollars = corps.usage?.cost;
			return {
				texte: corps.choices?.[0]?.message?.content ?? "",
				jetonsEntree: corps.usage?.prompt_tokens ?? 0,
				jetonsSortie: corps.usage?.completion_tokens ?? 0,
				...typeof dollars === "number" ? { dollars } : {}
			};
		}
	};
}
function envoyer(clef, corps) {
	return fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			authorization: `Bearer ${clef}`,
			"content-type": "application/json",
			"http-referer": "https://atelier237.pages.dev",
			"x-title": "Atelier 237"
		},
		body: JSON.stringify(corps)
	});
}
//#endregion
//#region src/cout.ts
function couter(jetons, prix, tauxFcfaParDollar) {
	const dollars = (jetons.entree * prix.entree + jetons.sortie * prix.sortie) / 1e6;
	return {
		dollars,
		fcfa: Math.round(dollars * tauxFcfaParDollar * 100) / 100,
		entree: jetons.entree,
		sortie: jetons.sortie
	};
}
//#endregion
//#region src/invite.ts
/**
* L'invite qui impose la sortie en JSON conforme au schéma (§ 3).
*
* Elle est courte exprès. Le schéma porte déjà les consignes là où le modèle
* les lit vraiment — dans les `description` de chaque champ — et rallonger
* l'invite pour redire ce que le schéma dit coûte des jetons d'entrée à chaque
* appel, sur un budget d'un franc.
*
* Trois choses seulement ne peuvent pas vivre dans le schéma : le métier
* (Cameroun, francs CFA, téléphone), l'interdiction de sortir du cadre, et le
* fait que la réponse doit être du JSON nu.
*
* Les quatre schémas pèsent ensemble à peu près deux mille jetons d'entrée,
* soit environ un quart de franc par génération — mesuré, pas estimé. Le
* plafond du § 8 est d'un franc : tant qu'on est là, envoyer tous les schémas
* vaut mieux que deviner lequel envoyer. Se tromper de famille ferait payer un
* refus à quelqu'un dont la demande était parfaitement faisable, et c'est le
* plus cher des deux échecs. Le jour où le total s'approche du franc, c'est le
* routage qu'il faudra écrire, et cette note sera le point de départ.
*/
var CONSIGNES = `Tu fabriques un outil pour un petit commerçant camerounais.

Tu sais fabriquer quatre sortes de choses, et choisir entre elles.

Un **registre** est un tableau de lignes qu'on tient à la main : des ventes,
des dettes, un stock, des présences, des cotisations. Il répond à « qu'est-ce
que j'ai noté ? ».

Une **calculatrice** a quelques champs et un résultat. Elle répond à « combien
ça fait ? » — ce qu'il reste à payer, la part de chacun, une marge, une remise.
Sa formule se déclare en arbre, jamais en code.

Une **page** se publie derrière un lien qu'on envoie sur WhatsApp. Elle répond
à « comment je me montre ? » — une vitrine de boutique, un menu de restaurant,
une liste de prix, un profil d'artisan. C'est ce que demande « je veux un site
internet » : ici, un site et une page sont la même chose, et le champ
« sommaire » met un menu en haut quand il y a plusieurs sujets.

**Un événement est une page datée.** Une annonce de mariage, une réunion de
tontine, une vente de fin d'année ont un nom, un lieu, un programme et une
phrase — tout ce qu'une page porte déjà. Remplis « date » et la page dira
d'elle-même dans combien de jours c'est. Mets le programme en section
« liste », l'heure de chaque moment dans « valeur ».

N'invente jamais un numéro de téléphone, une adresse, une date ni un prix :
laisse le champ vide si la demande ne le donne pas — un prix inventé se lit
comme un engagement, et une date inventée fait déplacer des gens.

Un **formulaire** se publie derrière un lien et **reçoit** des réponses. Il
répond à « comment je ramasse ce que les gens me disent ? » — les commandes du
week-end, les inscriptions à une réunion, qui vient à la fête, ce que chacun
apporte. C'est la seule des quatre qui reçoit ; les trois autres se lisent.
Mets le moins de questions possible : chacune de plus est une réponse de moins.

Réponds par un objet JSON seul, sans texte autour, sans bloc de code.

Les schémas plus bas **décrivent** la forme de ta réponse. Ils ne sont pas la
réponse : renvoie un objet dont les champs sont remplis pour cette demande-là,
jamais la description elle-même.

**Si la demande n'est aucune des quatre, refuse.** Une application à installer,
un logo, une photo, une traduction, un conseil : rien de cela ne se range dans
un tableau, dans une formule, dans une page ni dans un formulaire. Réponds
alors par un objet qui
n'a qu'un champ « impossible », en disant en une phrase ce que tu ne peux pas
faire, et ce que tu sais faire. Ne fabrique jamais un outil plausible pour une
demande qui n'en réclame pas : un outil inventé se remplit une fois, puis se
referme pour toujours.

Règles :
- Les montants sont en francs CFA, entiers, sans décimale.
- Les libellés sont en français, courts, tutoiement, sans jargon comptable.
- 6 colonnes, 5 champs, 8 sections ou
  8 questions au maximum : ça se lit sur un téléphone de 360 pixels.
- La première colonne nomme la ligne : mets devant celle qui l'identifie.
- Au plus une colonne de type bascule.
- N'invente pas de colonne que la demande ne réclame pas.
- Si la demande décrit une dette entre personnes, ne mets aucun montant en
  sur-titre : ça se partage, et humilier quelqu'un fait perdre le client avec
  l'argent.`;
var REGISTRE = JSON.stringify(pourLeModele(schemaRegistre));
var CALCUL = JSON.stringify(pourLeModele(schemaCalcul));
var PAGE = JSON.stringify(pourLeModele(schemaPage));
var FORMULAIRE = JSON.stringify(pourLeModele(schemaFormulaire));
var REFUS = JSON.stringify(pourLeModele(schemaRefus));
function batirInvite(demande) {
	return `${CONSIGNES}

Un registre doit respecter ce schéma :
${REGISTRE}

Une calculatrice doit respecter celui-ci :
${CALCUL}

Une page, celui-ci :
${PAGE}

Un formulaire, celui-ci :
${FORMULAIRE}

Un refus, celui-ci :
${REFUS}

Demande de l'utilisateur :
${demande}`;
}
/**
* Le tour de reprise. Un seul est prévu (§ 3), donc il doit porter.
*
* On renvoie les reproches tels que `verifierRegistre` les a écrits — chemin et
* message — parce qu'ils nomment le champ fautif et la correction. « Ce n'est
* pas valide » ferait recommencer au hasard.
*/
function batirReproches(erreurs) {
	return `Ta réponse n'est pas conforme. Corrige exactement ceci et renvoie l'objet JSON entier :

${erreurs.map((e) => `- ${e.chemin} : ${e.message}`).join("\n")}`;
}
//#endregion
//#region src/traiter.ts
async function traiter(demande, fournisseur, tauxFcfaParDollar) {
	const jetons = {
		entree: 0,
		sortie: 0
	};
	let dollarsAnnonces = null;
	let sortie = "";
	let erreurs = [];
	for (let essai = 1; essai <= 2; essai++) {
		const reponse = await fournisseur.appeler(essai === 1 ? { invite: batirInvite(demande) } : {
			invite: batirInvite(demande),
			reprise: {
				sortie,
				reproches: batirReproches(erreurs)
			}
		});
		jetons.entree += reponse.jetonsEntree;
		jetons.sortie += reponse.jetonsSortie;
		if (reponse.dollars !== void 0) dollarsAnnonces = (dollarsAnnonces ?? 0) + reponse.dollars;
		sortie = reponse.texte;
		const valeur = lireJson(reponse.texte);
		if (valeur === void 0) {
			console.error(JSON.stringify({
				evenement: "json_illisible",
				essai,
				debut: reponse.texte.slice(0, 300)
			}));
			erreurs = [{
				chemin: "$",
				message: "la réponse n’est pas du JSON"
			}];
			continue;
		}
		const lu = lireReponseModele(valeur);
		if (lu.sorte === "registre") return {
			sorte: "reussi",
			registre: lu.registre,
			cout: cout(),
			essais: essai
		};
		if (lu.sorte === "calcul") return {
			sorte: "calcule",
			calcul: lu.calcul,
			cout: cout(),
			essais: essai
		};
		if (lu.sorte === "page") return {
			sorte: "page",
			page: lu.page,
			cout: cout(),
			essais: essai
		};
		if (lu.sorte === "formulaire") return {
			sorte: "formulaire",
			formulaire: lu.formulaire,
			cout: cout(),
			essais: essai
		};
		if (lu.sorte === "refus") return {
			sorte: "hors-sujet",
			pourquoi: lu.pourquoi,
			cout: cout(),
			essais: essai
		};
		erreurs = lu.erreurs;
	}
	return {
		sorte: "invalide",
		erreurs,
		cout: cout(),
		essais: 2
	};
	function cout() {
		return dollarsAnnonces === null ? couter(jetons, fournisseur.prix, tauxFcfaParDollar) : {
			dollars: dollarsAnnonces,
			fcfa: Math.round(dollarsAnnonces * tauxFcfaParDollar * 100) / 100,
			entree: jetons.entree,
			sortie: jetons.sortie
		};
	}
}
/**
* Le JSON du modèle, ou rien.
*
* `responseMimeType` le demande déjà, et le modèle déborde quand même : mesuré
* en production sur dix générations réelles, une demande sur dix a échoué sur
* « la réponse n'est pas du JSON », deux fois de suite, pour soixante centimes.
* Un bloc de code entouré d'une phrase de politesse suffit à faire tomber une
* configuration parfaitement valable.
*
* C'est une faute de forme et non de fond : on déshabille plutôt que de faire
* payer un tour de plus. Trois tentatives, de la plus stricte à la plus large,
* et la dernière ne cherche que ce qui ne peut pas être de la prose — le
* premier `{` jusqu'au dernier `}`. Ce qu'on ne trouve pas ainsi n'était pas
* une configuration enveloppée : c'était autre chose, et ça reste un échec.
*/
function lireJson(texte) {
	const brut = texte.trim();
	for (const candidat of candidatsJson(brut)) try {
		return JSON.parse(candidat);
	} catch {}
}
function* candidatsJson(brut) {
	yield brut;
	const bloc = /```(?:json)?\s*([\s\S]*?)```/i.exec(brut);
	if (bloc?.[1] !== void 0) yield bloc[1].trim();
	const debut = brut.indexOf("{");
	const fin = brut.lastIndexOf("}");
	if (debut !== -1 && fin > debut) yield brut.slice(debut, fin + 1);
}
//#endregion
//#region src/fonction.ts
/**
* Le proxy IA (§ 3, « Appeler l'IA »).
*
* Il existe pour une seule raison : **aucune clef d'API dans le client, jamais**
* (invariant § 2.8). La clef est lue ici, dans l'environnement de la fonction,
* et ne traverse pas la frontière. Le client ne reçoit qu'une configuration
* déjà validée — jamais de HTML, jamais de code (§ 3, point 5).
*
* Il ne connaît pas son hébergeur. `repondre` prend une demande et des
* réglages, et rend un code et un corps ; l'adaptateur qui la relie à un
* `Request` tient en dix lignes et vit ailleurs. C'est ce qui a permis de
* passer de Vercel à Cloudflare sans toucher à une seule décision — et ce qui
* permet d'éprouver tout ce fichier sans réseau, sans clef et sans serveur.
*
* Les réglages arrivent en argument et ne se lisent pas dans
* `process.env` : un Worker n'a pas de `process`, ses variables arrivent dans
* un objet passé à chaque requête. Les lire au chargement du module aurait
* marché sur Vercel et rendu partout `undefined` sur Cloudflare.
*
* Le quota et le journal des coûts sont **obligatoires**, et c'est voulu : il
* n'existe pas de chemin par lequel une génération se paie sans être comptée.
* `repondre` ne connaît pourtant ni D1 ni les comptes — elle reçoit une séance,
* qui porte le compte déjà lu et sait retirer, rendre et journaliser. Ce qui
* décide du droit de composer reste dans `@a237/comptes` ; ce fichier
* l'applique.
*/
/** Une demande plus longue qu'un paragraphe n'est pas une demande d'outil. */
var MAX_DEMANDE = 400;
var MODELE_PAR_DEFAUT = "google/gemini-2.5-flash-lite";
function nombre(brut, defaut) {
	const n = Number(brut);
	return Number.isFinite(n) ? n : defaut;
}
function reglagesDe(env) {
	return {
		clef: env.A237_CLEF_IA ?? "",
		ouverte: env.A237_IA_OUVERTE === "1",
		fournisseur: env.A237_FOURNISSEUR ?? "openrouter",
		modele: env.A237_MODELE ?? MODELE_PAR_DEFAUT,
		prixEntree: nombre(env.A237_PRIX_ENTREE, .1),
		prixSortie: nombre(env.A237_PRIX_SORTIE, .4),
		tauxFcfa: nombre(env.A237_TAUX_FCFA, 600)
	};
}
/**
* Le fournisseur et le modèle se choisissent dans l'environnement.
*
* Le brief pose un **budget** — moins d'un franc la génération (§ 8) — et non
* une marque. Pouvoir changer de modèle sans redéployer, c'est pouvoir tenir
* ce budget quand les prix bougent, et essayer mieux quand un modèle plus
* fidèle au schéma apparaît. Une reprise double le coût : un modèle qui se
* trompe moins peut revenir moins cher qu'un modèle moins cher.
*
* Le prix sert au journal quand le fournisseur ne dit pas ce qu'il a facturé.
* OpenRouter, lui, le dit, et son chiffre l'emporte — il applique sa marge.
*/
function fournisseurChoisi(r) {
	return r.fournisseur === "gemini" ? gemini(r.clef, r.modele === MODELE_PAR_DEFAUT ? "gemini-2.5-flash-lite" : r.modele) : openrouter(r.clef, r.modele, {
		entree: r.prixEntree,
		sortie: r.prixSortie
	});
}
async function repondre(corpsRecu, r, seance) {
	if (r.clef === "" || !r.ouverte) return {
		statut: 503,
		corps: { erreur: "la composition par le modèle n’est pas encore ouverte" }
	};
	const recu = corpsRecu;
	const demande = typeof recu?.demande === "string" ? recu.demande.trim() : "";
	if (demande === "" || demande.length > MAX_DEMANDE) return {
		statut: 400,
		corps: { erreur: "demande absente ou trop longue" }
	};
	const etage = etageDe(demande, CATALOGUE);
	const verdict = controlerQuota(seance.compte, etage, seance.maintenant);
	if (verdict.sorte !== "passe") return {
		statut: 402,
		corps: {
			erreur: verdict.sorte,
			pourquoi: verdict.pourquoi
		}
	};
	if (!await seance.prendreUnCredit()) return {
		statut: 402,
		corps: {
			erreur: "credits-epuises",
			pourquoi: "Tes compositions sont utilisées. L’abonnement en donne quarante par mois."
		}
	};
	try {
		const resultat = await traiter(demande, fournisseurChoisi(r), r.tauxFcfa);
		await seance.journaliser({
			etage,
			jetonsEntree: resultat.cout.entree,
			jetonsSortie: resultat.cout.sortie,
			coutXaf: resultat.cout.fcfa,
			ok: resultat.sorte === "reussi" || resultat.sorte === "calcule" || resultat.sorte === "page" || resultat.sorte === "formulaire"
		});
		console.log(JSON.stringify({
			evenement: "appel_ia",
			modele: r.modele,
			essais: resultat.essais,
			fcfa: resultat.cout.fcfa,
			issue: resultat.sorte
		}));
		if (resultat.sorte === "hors-sujet") return {
			statut: 200,
			corps: {
				impossible: resultat.pourquoi,
				fcfa: resultat.cout.fcfa
			}
		};
		if (resultat.sorte === "calcule") return {
			statut: 200,
			corps: {
				calcul: resultat.calcul,
				fcfa: resultat.cout.fcfa
			}
		};
		if (resultat.sorte === "page") return {
			statut: 200,
			corps: {
				page: resultat.page,
				fcfa: resultat.cout.fcfa
			}
		};
		if (resultat.sorte === "formulaire") return {
			statut: 200,
			corps: {
				formulaire: resultat.formulaire,
				fcfa: resultat.cout.fcfa
			}
		};
		if (resultat.sorte !== "reussi") return {
			statut: 422,
			corps: {
				erreur: "le modèle n’a pas produit un outil utilisable",
				details: resultat.erreurs.map((e) => `${e.chemin} : ${e.message}`),
				fcfa: resultat.cout.fcfa
			}
		};
		return {
			statut: 200,
			corps: {
				registre: resultat.registre,
				fcfa: resultat.cout.fcfa
			}
		};
	} catch (cause) {
		console.error("appel_ia_echoue", cause);
		await seance.rendreUnCredit();
		if (cause instanceof ErreurFournisseur && cause.sorte === "credit-epuise") return {
			statut: 402,
			corps: { erreur: "plus de crédit pour composer" }
		};
		return {
			statut: 502,
			corps: { erreur: "le modèle n’a pas répondu" }
		};
	}
}
//#endregion
//#region src/worker.ts
/** Ce que `reglagesDe` sait lire : les chaînes, et elles seules. */
function chainesDe(env) {
	const propre = {};
	for (const [clef, valeur] of Object.entries(env)) if (typeof valeur === "string") propre[clef] = valeur;
	return propre;
}
function json(statut, corps) {
	return new Response(JSON.stringify(corps), {
		status: statut,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
async function onRequest(contexte) {
	if (contexte.request.method !== "POST") return json(405, { erreur: "méthode non permise" });
	const base = contexte.env.COMPTES;
	if (base === void 0) return json(503, { erreur: "la composition par le modèle n’est pas encore ouverte" });
	const jeton = jetonDeLEntete(contexte.request.headers);
	if (jeton === null || !jetonValide(jeton)) return json(401, {
		erreur: "appareil-inconnu",
		pourquoi: "Cet appareil ne s’est pas présenté."
	});
	let corps;
	try {
		corps = await contexte.request.json();
	} catch {
		corps = void 0;
	}
	const seance = await ouvrirSeance(base, jeton, /* @__PURE__ */ new Date());
	const { statut, corps: reponse } = await repondre(corps, reglagesDe(chainesDe(contexte.env)), seance);
	const restants = statut === 200 ? Math.max(0, seance.compte.credits - 1) : seance.compte.credits;
	return json(statut, {
		...reponse,
		credits: restants,
		plan: seance.compte.plan
	});
}
//#endregion
export { onRequest };
