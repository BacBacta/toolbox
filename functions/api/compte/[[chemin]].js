//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __esmMin = (fn, res, err) => () => {
	if (err) throw err[0];
	try {
		return fn && (res = fn(fn = 0)), res;
	} catch (e) {
		throw err = [e], e;
	}
};
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/plan.ts
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
/** Le plan tel qu'il vaut aujourd'hui, expiration comprise. */
function planEffectif(compte, maintenant) {
	return abonne(compte, maintenant) ? "atelier" : "essai";
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
var init_plan = __esmMin((() => {}));
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
async function poserCode(db, compteId, empreinte) {
	await db.prepare("UPDATE comptes SET code_empreinte = ? WHERE id = ?").bind(empreinte, compteId).run();
}
async function compteParCode(db, empreinte) {
	const ligne = await db.prepare("SELECT id, plan, plan_expire, credits FROM comptes WHERE code_empreinte = ?").bind(empreinte).first();
	return ligne === null ? null : versCompte(ligne);
}
/**
* Rattache cet appareil à ce compte.
*
* L'appareil quitte son compte précédent — celui qu'on lui avait ouvert en
* arrivant — sans que ce compte disparaisse : il peut porter d'autres
* appareils, et il porte peut-être un abonnement.
*/
async function rattacherAppareil(db, empreinte, compteId, maintenant) {
	await db.prepare("INSERT INTO appareils (empreinte, compte_id, vu_le) VALUES (?, ?, ?) ON CONFLICT(empreinte) DO UPDATE SET compte_id = excluded.compte_id, vu_le = excluded.vu_le").bind(empreinte, compteId, maintenant.getTime()).run();
}
var init_base = __esmMin((() => {
	init_plan();
})), ALPHABET_LIEN;
var init_publication = __esmMin((() => {
	ALPHABET_LIEN = "23456789ABCDEFGHJKLMNPQRSTVWXYZ";
	new RegExp(`^[${ALPHABET_LIEN}]{12}$`);
}));
//#endregion
//#region ../engine/src/index.ts
var init_src = __esmMin((() => {
	init_publication();
}));
//#endregion
//#region src/identite.ts
var identite_exports = /* @__PURE__ */ __exportAll({
	codeLisible: () => codeLisible,
	empreinte: () => empreinte,
	jetonValide: () => jetonValide,
	normaliserCode: () => normaliserCode,
	tirerCode: () => tirerCode,
	tirerJeton: () => tirerJeton
});
function hex(octets) {
	return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}
/** Le jeton d'un appareil. Tiré sur l'appareil, jamais par le serveur. */
function tirerJeton() {
	const octets = new Uint8Array(OCTETS_JETON);
	crypto.getRandomValues(octets);
	return hex(octets);
}
function jetonValide(jeton) {
	return jeton.length === 32 && /^[0-9a-f]+$/.test(jeton);
}
/** Ce que le serveur range à la place du jeton. */
async function empreinte(secret) {
	const condense = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
	return hex(new Uint8Array(condense));
}
/** Un code de récupération, montré une fois et jamais rangé en clair. */
function tirerCode() {
	const octets = new Uint8Array(LONGUEUR_CODE);
	crypto.getRandomValues(octets);
	const lettres = Array.from(octets, (o) => "23456789ABCDEFGHJKLMNPQRSTVWXYZ"[o % 31] ?? "2");
	const groupes = [];
	for (let i = 0; i < lettres.length; i += GROUPE) groupes.push(lettres.slice(i, i + GROUPE).join(""));
	return groupes.join("-");
}
/**
* Ce qu'on accepte de ce qui est tapé.
*
* Les tirets sont une aide à la lecture, pas une donnée ; les espaces arrivent
* d'un copier-coller ; les minuscules d'un clavier de téléphone. Rend `null`
* si ce qui reste n'est pas un code, plutôt que de comparer une bouillie.
*/
function normaliserCode(saisi) {
	const propre = saisi.toUpperCase().replace(/[\s-]/g, "");
	if (propre.length !== LONGUEUR_CODE) return null;
	for (const lettre of propre) if (!"23456789ABCDEFGHJKLMNPQRSTVWXYZ".includes(lettre)) return null;
	return propre;
}
/** Le code tel qu'il se montre, une seule fois. */
function codeLisible(code) {
	const groupes = [];
	for (let i = 0; i < code.length; i += GROUPE) groupes.push(code.slice(i, i + GROUPE));
	return groupes.join("-");
}
var OCTETS_JETON, LONGUEUR_CODE, GROUPE;
var init_identite = __esmMin((() => {
	init_src();
	OCTETS_JETON = 16;
	LONGUEUR_CODE = 16;
	GROUPE = 4;
}));
//#endregion
//#region src/seance.ts
var seance_exports = /* @__PURE__ */ __exportAll({
	SCHEMA_AUTORISATION: () => SCHEMA_AUTORISATION,
	jetonDeLEntete: () => jetonDeLEntete,
	ouvrirSeance: () => ouvrirSeance
});
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
var SCHEMA_AUTORISATION;
var init_seance = __esmMin((() => {
	init_base();
	init_identite();
	SCHEMA_AUTORISATION = "Appareil";
}));
//#endregion
//#region src/worker-compte.ts
init_base();
init_identite();
init_plan();
init_seance();
function json(statut, corps) {
	return new Response(JSON.stringify(corps), {
		status: statut,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
/** Ce que l'écran a besoin de savoir, et rien de plus. */
function vue(compte, aUnCode, maintenant) {
	return {
		plan: planEffectif(compte, maintenant),
		credits: compte.credits,
		expire: abonne(compte, maintenant) ? compte.planExpire : null,
		aUnCode
	};
}
async function aUnCode(db, id) {
	return ((await db.prepare("SELECT code_empreinte FROM comptes WHERE id = ?").bind(id).first())?.code_empreinte ?? null) !== null;
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
		console.error("compte_echoue", cause);
		return json(503, { erreur: "les comptes sont indisponibles" });
	}
}
async function servir(contexte) {
	const db = contexte.env.COMPTES;
	if (db === void 0) return json(503, { erreur: "les comptes ne sont pas branchés" });
	const jeton = jetonDeLEntete(contexte.request.headers);
	if (jeton === null || !jetonValide(jeton)) return json(401, {
		erreur: "appareil-inconnu",
		pourquoi: "Cet appareil ne s’est pas présenté."
	});
	const maintenant = /* @__PURE__ */ new Date();
	const { ouvrirSeance } = await Promise.resolve().then(() => (init_seance(), seance_exports));
	const seance = await ouvrirSeance(db, jeton, maintenant);
	const chemin = new URL(contexte.request.url).pathname;
	const methode = contexte.request.method;
	if (chemin.endsWith("/compte") && methode === "GET") return json(200, vue(seance.compte, await aUnCode(db, seance.compte.id), maintenant));
	if (chemin.endsWith("/compte/code") && methode === "POST") {
		const code = tirerCode();
		await poserCode(db, seance.compte.id, await empreinte(code.replace(/-/g, "")));
		return json(200, {
			code: codeLisible(code.replace(/-/g, "")),
			pourquoi: "Écris-le quelque part. Il ne sera plus jamais affiché, et c’est lui qui te rendra ton atelier si tu changes de téléphone."
		});
	}
	if (chemin.endsWith("/compte/reprendre") && methode === "POST") {
		const { normaliserCode } = await Promise.resolve().then(() => (init_identite(), identite_exports));
		let recu;
		try {
			recu = await contexte.request.json();
		} catch {
			recu = void 0;
		}
		const brut = recu?.code;
		const code = typeof brut === "string" ? normaliserCode(brut) : null;
		if (code === null) return json(400, { erreur: "code-invalide" });
		const vise = await compteParCode(db, await empreinte(code));
		if (vise === null) return json(404, { erreur: "code-inconnu" });
		await rattacherAppareil(db, await empreinte(jeton), vise.id, maintenant);
		return json(200, vue(await compteParId(db, vise.id) ?? vise, true, maintenant));
	}
	return json(404, { erreur: "chemin-inconnu" });
}
//#endregion
export { onRequest };
