//#region src/fournisseur.ts
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
			if (!reponse.ok) throw new Error(`le modèle a répondu ${reponse.status}`);
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
			if (!reponse.ok) throw new Error(`le modèle a répondu ${reponse.status}`);
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
			"http-referer": "https://atelier237.vercel.app",
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
		fcfa: Math.round(dollars * tauxFcfaParDollar * 100) / 100
	};
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
			description: "La première nomme la ligne et doit être de type texte. Au plus une colonne de type bascule.",
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
/**
* Ce que le schéma ne peut pas dire.
*
* JSON Schema vérifie des formes, pas des accords : que `total.clef` désigne
* une colonne qui existe, qu'une seule bascule serve d'interrupteur, que la
* première colonne nomme bien la ligne. Sans ces contrôles, une configuration
* « valide » ferait un registre qui totalise une colonne absente — et
* l'utilisateur verrait un zéro qu'il ne saurait pas expliquer.
*
* Un seul essai de reprise est prévu (§ 3) : ces messages repartent au modèle,
* donc ils lui disent quoi corriger, pas seulement que c'est faux.
*/
function verifierRegistre(valeur) {
	const erreurs = [...valider(schemaRegistre, valeur)];
	if (erreurs.length > 0) return erreurs;
	const r = valeur;
	const clefs = r.colonnes.map((c) => c.clef);
	const premiere = r.colonnes[0];
	if (premiere !== void 0 && premiere.type !== "texte") erreurs.push({
		chemin: "$.colonnes[0].type",
		message: "la première colonne nomme la ligne : elle doit être de type texte"
	});
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
*/
var CONSIGNES = `Tu configures un registre pour un petit commerçant camerounais.

Réponds par un objet JSON seul, sans texte autour, sans bloc de code.
Il doit être conforme au schéma donné plus bas.

Règles :
- Les montants sont en francs CFA, entiers, sans décimale.
- Les libellés sont en français, courts, tutoiement, sans jargon comptable.
- 6 colonnes au maximum : ça se lit sur un téléphone de 360 pixels.
- La première colonne nomme la ligne et est de type texte.
- Au plus une colonne de type bascule.
- N'invente pas de colonne que la demande ne réclame pas.
- Si la demande décrit une dette entre personnes, ne mets aucun montant en
  sur-titre : ça se partage, et humilier quelqu'un fait perdre le client avec
  l'argent.`;
function batirInvite(demande) {
	return `${CONSIGNES}

Schéma :
${JSON.stringify(schemaRegistre)}

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
			erreurs = [{
				chemin: "$",
				message: "la réponse n’est pas du JSON"
			}];
			continue;
		}
		erreurs = verifierRegistre(valeur);
		if (erreurs.length === 0) return {
			sorte: "reussi",
			registre: valeur,
			cout: cout(),
			essais: essai
		};
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
			fcfa: Math.round(dollarsAnnonces * tauxFcfaParDollar * 100) / 100
		};
	}
}
/**
* Le JSON du modèle, ou rien.
*
* `responseMimeType` le demande déjà, mais un fournisseur de secours pourrait
* envelopper la réponse dans un bloc de code. On le déshabille plutôt que de
* refuser — c'est une faute de forme, pas de fond.
*/
function lireJson(texte) {
	const propre = texte.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
	try {
		return JSON.parse(propre);
	} catch {
		return;
	}
}
//#endregion
//#region src/fonction.ts
/** Une demande plus longue qu'un paragraphe n'est pas une demande d'outil. */
var MAX_DEMANDE = 400;
/** Le taux sert au journal des coûts. Une décision de gestion, pas une constante. */
var TAUX_FCFA_PAR_DOLLAR = Number(process.env.A237_TAUX_FCFA ?? "600");
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
function fournisseurChoisi(clef) {
	const modele = process.env.A237_MODELE;
	const prix = {
		entree: Number(process.env.A237_PRIX_ENTREE ?? "0.1"),
		sortie: Number(process.env.A237_PRIX_SORTIE ?? "0.4")
	};
	return process.env.A237_FOURNISSEUR === "gemini" ? gemini(clef, modele ?? "gemini-2.5-flash-lite") : openrouter(clef, modele ?? "google/gemini-2.5-flash-lite", prix);
}
async function handler(req, res) {
	if (req.method !== "POST") {
		res.status(405).json({ erreur: "méthode non permise" });
		return;
	}
	const clef = process.env.A237_CLEF_IA ?? "";
	const ouverte = process.env.A237_IA_OUVERTE === "1";
	if (clef === "" || !ouverte) {
		res.status(503).json({ erreur: "la composition par le modèle n’est pas encore ouverte" });
		return;
	}
	const corps = req.body;
	const demande = typeof corps?.demande === "string" ? corps.demande.trim() : "";
	if (demande === "" || demande.length > MAX_DEMANDE) {
		res.status(400).json({ erreur: "demande absente ou trop longue" });
		return;
	}
	try {
		const resultat = await traiter(demande, fournisseurChoisi(clef), TAUX_FCFA_PAR_DOLLAR);
		console.log(JSON.stringify({
			evenement: "appel_ia",
			modele: process.env.A237_MODELE ?? "google/gemini-2.5-flash-lite",
			essais: resultat.essais,
			fcfa: resultat.cout.fcfa,
			aboutit: resultat.sorte === "reussi"
		}));
		if (resultat.sorte !== "reussi") {
			res.status(422).json({
				erreur: "le modèle n’a pas produit un registre utilisable",
				details: resultat.erreurs.map((e) => `${e.chemin} : ${e.message}`),
				fcfa: resultat.cout.fcfa
			});
			return;
		}
		const registre = resultat.registre;
		res.status(200).json({
			registre,
			fcfa: resultat.cout.fcfa
		});
	} catch (cause) {
		console.error("appel_ia_echoue", cause);
		res.status(502).json({ erreur: "le modèle n’a pas répondu" });
	}
}
//#endregion
export { handler as default };
