/** Trente jours, en millisecondes. */
var DUREE_ABONNEMENT = 2592e6;
/** Le prix du mois, en francs CFA. */
var PRIX_MENSUEL_XAF = 1e3;
/** Ce que devient un compte quand un paiement aboutit. */
function apresPaiement(compte, maintenant) {
	const depart = Math.max(compte.planExpire ?? 0, maintenant.getTime());
	return {
		...compte,
		plan: "atelier",
		planExpire: depart + DUREE_ABONNEMENT,
		credits: 40
	};
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
//#region src/base.ts
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
async function compteParId(db, id) {
	const ligne = await db.prepare("SELECT id, plan, plan_expire, credits FROM comptes WHERE id = ?").bind(id).first();
	return ligne === null ? null : versCompte(ligne);
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
async function ouvrirPaiement(db, p) {
	await db.prepare("INSERT INTO paiements (id, compte_id, fournisseur, reference, montant_xaf, etat, telephone, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(p.id, p.compteId, p.fournisseur, p.reference, p.montantXaf, p.etat, p.telephone, p.creeLe).run();
}
function versPaiement(l) {
	const etat = l.etat === "reussi" ? "reussi" : l.etat === "echoue" ? "echoue" : "attente";
	return {
		id: l.id,
		compteId: l.compte_id,
		fournisseur: l.fournisseur,
		reference: l.reference,
		montantXaf: l.montant_xaf,
		etat,
		telephone: l.telephone,
		creeLe: l.cree_le
	};
}
var COLONNES_PAIEMENT = "id, compte_id, fournisseur, reference, montant_xaf, etat, telephone, cree_le";
async function paiementParReference(db, fournisseur, reference) {
	const l = await db.prepare(`SELECT ${COLONNES_PAIEMENT} FROM paiements WHERE fournisseur = ? AND reference = ?`).bind(fournisseur, reference).first();
	return l === null ? null : versPaiement(l);
}
async function paiementParId(db, id) {
	const l = await db.prepare(`SELECT ${COLONNES_PAIEMENT} FROM paiements WHERE id = ?`).bind(id).first();
	return l === null ? null : versPaiement(l);
}
/**
* Écrit ce que le rappel a décidé — le paiement et le compte, ensemble.
*
* `batch` est une transaction chez D1 : le paiement ne peut pas passer à
* « réussi » sans que l'abonnement suive, ni l'inverse. Le contraire laisserait
* quelqu'un ayant payé sans abonnement, et un rejeu ne le rattraperait pas
* puisque le paiement ne serait plus en attente.
*
* Le numéro suit le compte qui vient de payer. Il est unique en base, et il
* peut déjà appartenir à un compte abandonné — un téléphone perdu, un
* appareil neuf. Un numéro désigne une personne : il va au compte dont elle se
* sert aujourd'hui. L'ancien compte garde tout le reste.
*/
async function ecrireSuite(db, suite, brut) {
	if (suite.sorte === "inconnu" || suite.sorte === "deja-traite") return;
	if (suite.sorte === "echoue") {
		await db.prepare("UPDATE paiements SET etat = ?, brut = ? WHERE id = ?").bind("echoue", brut, suite.paiement.id).run();
		return;
	}
	await db.batch([
		db.prepare("UPDATE paiements SET etat = ?, brut = ? WHERE id = ? AND etat = ?").bind("reussi", brut, suite.paiement.id, "attente"),
		db.prepare("UPDATE comptes SET telephone = NULL WHERE telephone = ? AND id != ?").bind(suite.paiement.telephone, suite.compte.id),
		db.prepare("UPDATE comptes SET plan = ?, plan_expire = ?, credits = ?, telephone = ? WHERE id = ?").bind(suite.compte.plan, suite.compte.planExpire, suite.compte.credits, suite.paiement.telephone, suite.compte.id)
	]);
}
//#endregion
//#region src/faux.ts
/**
* Un fournisseur qui n'encaisse rien, et qui se comporte comme s'il encaissait.
*
* Il existe pour que tout le reste soit fini avant qu'un compte marchand ne le
* soit : ouvrir un compte CamPay ou Fapshi demande des pièces et du délai
* (§ 7, phase 0), et rien de ce qui est écrit autour du paiement n'a besoin
* d'attendre ça.
*
* Il **signe vraiment** ses rappels. Un faux qui répondrait « oui » à tout
* n'éprouverait pas la seule chose qui compte vraiment ici : sans vérification
* de signature, n'importe qui s'offre un abonnement avec `curl`. Le jour où un
* vrai fournisseur arrive, c'est le même chemin qui s'exécute.
*/
var ENTETE_SIGNATURE = "x-signature-a237";
function hex$1(octets) {
	return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}
async function clef(secret) {
	return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
}
/** La signature d'un corps. Publique : le faux fournisseur s'en sert aussi. */
async function signer(corps, secret) {
	const octets = await crypto.subtle.sign("HMAC", await clef(secret), new TextEncoder().encode(corps));
	return hex$1(new Uint8Array(octets));
}
/**
* Comparaison à durée constante.
*
* Un `===` sur des chaînes s'arrête au premier caractère qui diffère, et le
* temps que ça prend dit combien de caractères étaient bons. On compare donc
* tout, toujours.
*/
function memeSignature(a, b) {
	if (a.length !== b.length) return false;
	let ecart = 0;
	for (let i = 0; i < a.length; i++) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return ecart === 0;
}
function fauxFournisseur(secret) {
	return {
		nom: "faux",
		demarrer(demande) {
			return Promise.resolve({
				reference: demande.reference,
				consigne: `Fournisseur d’essai : aucun paiement n’est demandé sur ${demande.telephone}. Le rappel se déclenche à la main.`
			});
		},
		async lireRappel(corps, entetes) {
			const donnee = entetes.get(ENTETE_SIGNATURE);
			if (donnee === null) return null;
			if (!memeSignature(donnee, await signer(corps, secret))) return null;
			let lu;
			try {
				lu = JSON.parse(corps);
			} catch {
				return null;
			}
			const r = lu;
			if (typeof r.reference !== "string" || typeof r.reussi !== "boolean") return null;
			if (typeof r.montantXaf !== "number" || !Number.isFinite(r.montantXaf)) return null;
			return {
				reference: r.reference,
				reussi: r.reussi,
				montantXaf: r.montantXaf
			};
		}
	};
}
//#endregion
//#region src/identite.ts
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
//#region src/paiement.ts
/**
* Ce que devient le monde quand un rappel arrive.
*
* Deux verrous contre le rejeu, et il en faut deux. Le premier est dans la
* base — `UNIQUE(fournisseur, reference)` empêche deux lignes. Le second est
* ici : un paiement qui n'est plus en attente ne se retranche pas. Sans lui,
* trois rappels identiques donneraient quatre-vingt-dix jours d'abonnement.
*/
function appliquerRappel(paiement, compte, rappel, maintenant) {
	if (paiement === null) return { sorte: "inconnu" };
	if (paiement.etat !== "attente") return {
		sorte: "deja-traite",
		etat: paiement.etat
	};
	if (!rappel.reussi) return {
		sorte: "echoue",
		paiement: {
			...paiement,
			etat: "echoue"
		},
		pourquoi: "Le paiement n’a pas abouti."
	};
	if (rappel.montantXaf < paiement.montantXaf) return {
		sorte: "echoue",
		paiement: {
			...paiement,
			etat: "echoue"
		},
		pourquoi: `Reçu ${rappel.montantXaf} F sur ${paiement.montantXaf} F attendus.`
	};
	return {
		sorte: "reussi",
		paiement: {
			...paiement,
			etat: "reussi"
		},
		compte: apresPaiement(compte, maintenant)
	};
}
/** Ce qu'on demande pour un mois. Un seul montant : il n'y a qu'un plan. */
function montantDuMois() {
	return PRIX_MENSUEL_XAF;
}
/**
* Le numéro tel qu'on l'accepte : format international, opérateurs camerounais.
*
* `+237 6XX XX XX XX` — neuf chiffres après l'indicatif, commençant par 6
* depuis le passage à neuf chiffres. On normalise plutôt que de refuser : les
* gens écrivent leur numéro avec des espaces, des points, un zéro devant, ou
* sans indicatif du tout.
*/
function normaliserTelephone(saisi) {
	const chiffres = saisi.replace(/[\s.\-()]/g, "").replace(/^\+/, "");
	const national = (chiffres.startsWith("237") ? chiffres.slice(3) : chiffres).replace(/^0+/, "");
	if (!/^6\d{8}$/.test(national)) return null;
	return `+237${national}`;
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
//#region src/worker-pay.ts
function json(statut, corps) {
	return new Response(JSON.stringify(corps), {
		status: statut,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
function texte(env, clef) {
	const v = env[clef];
	return typeof v === "string" ? v : "";
}
/**
* Sans secret, pas de paiement.
*
* Le secret sert à vérifier la signature des rappels. Sans lui on ne saurait
* pas distinguer le fournisseur de n'importe qui, et le refuser franchement
* vaut mieux que d'encaisser à l'aveugle.
*/
function fournisseurChoisi(env) {
	const secret = texte(env, "A237_PAIEMENT_SECRET");
	if (secret === "") return null;
	return fauxFournisseur(secret);
}
/**
* Rien de ce qui casse ici ne part en clair au client.
*
* Une base non migrée, une liaison qui répond mal, et l'exception remonte : la
* plateforme rend alors sa propre page d'erreur, avec la pile d'appels et les
* chemins de fichiers. Le destinataire n'y peut rien et n'a rien à y lire.
* 503 : ce n'est pas sa faute, et ça se réessaie.
*/
async function onRequest(contexte) {
	try {
		return await servir(contexte);
	} catch (cause) {
		console.error("pay_echoue", cause);
		return json(503, { erreur: "les comptes sont indisponibles" });
	}
}
async function servir(contexte) {
	const db = contexte.env.COMPTES;
	if (db === void 0) return json(503, { erreur: "les comptes ne sont pas branchés" });
	const fournisseur = fournisseurChoisi(contexte.env);
	if (fournisseur === null) return json(503, { erreur: "le paiement n’est pas encore ouvert" });
	const chemin = new URL(contexte.request.url).pathname;
	const methode = contexte.request.method;
	const maintenant = /* @__PURE__ */ new Date();
	if (chemin.endsWith("/pay/rappel") && methode === "POST") {
		const brut = await contexte.request.text();
		const rappel = await fournisseur.lireRappel(brut, contexte.request.headers);
		if (rappel === null) return json(401, { erreur: "signature-invalide" });
		const paiement = await paiementParReference(db, fournisseur.nom, rappel.reference);
		const compte = paiement === null ? null : await compteParId(db, paiement.compteId);
		if (paiement === null || compte === null) return json(200, {
			recu: true,
			applique: false
		});
		const suite = appliquerRappel(paiement, compte, rappel, maintenant);
		await ecrireSuite(db, suite, brut);
		return json(200, {
			recu: true,
			applique: suite.sorte === "reussi",
			etat: suite.sorte
		});
	}
	const jeton = jetonDeLEntete(contexte.request.headers);
	if (jeton === null || !jetonValide(jeton)) return json(401, {
		erreur: "appareil-inconnu",
		pourquoi: "Cet appareil ne s’est pas présenté."
	});
	const seance = await ouvrirSeance(db, jeton, maintenant);
	if (chemin.endsWith("/pay/demarrer") && methode === "POST") {
		let recu;
		try {
			recu = await contexte.request.json();
		} catch {
			recu = void 0;
		}
		const saisi = recu?.telephone;
		const telephone = typeof saisi === "string" ? normaliserTelephone(saisi) : null;
		if (telephone === null) return json(400, {
			erreur: "telephone-invalide",
			pourquoi: "Un numéro camerounais : neuf chiffres commençant par 6."
		});
		const paiement = {
			id: crypto.randomUUID(),
			compteId: seance.compte.id,
			fournisseur: fournisseur.nom,
			reference: crypto.randomUUID(),
			montantXaf: montantDuMois(),
			etat: "attente",
			telephone,
			creeLe: maintenant.getTime()
		};
		await ouvrirPaiement(db, paiement);
		const amorce = await fournisseur.demarrer({
			telephone,
			montantXaf: paiement.montantXaf,
			reference: paiement.reference
		});
		return json(200, {
			id: paiement.id,
			montantXaf: paiement.montantXaf,
			consigne: amorce.consigne
		});
	}
	const suivi = /\/pay\/([0-9a-f-]{36})$/.exec(chemin);
	if (suivi !== null && methode === "GET") {
		const paiement = await paiementParId(db, suivi[1] ?? "");
		if (paiement === null || paiement.compteId !== seance.compte.id) return json(404, { erreur: "paiement-inconnu" });
		const compte = await compteParId(db, seance.compte.id);
		return json(200, {
			etat: paiement.etat,
			plan: compte?.plan ?? "essai",
			credits: compte?.credits ?? 0
		});
	}
	return json(404, { erreur: "chemin-inconnu" });
}
//#endregion
export { onRequest };
