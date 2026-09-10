/** Un compte neuf, tel qu'il naît au premier appareil qui se présente. */
function compteNeuf(id) {
	return {
		id,
		plan: "essai",
		planExpire: null,
		credits: 5
	};
}
var MOTIF_LIEN = new RegExp(`^[23456789ABCDEFGHJKLMNPQRSTVWXYZ]{12}$`);
function lienValide(lien) {
	return MOTIF_LIEN.test(lien);
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
//#endregion
//#region ../comptes/src/reponses.ts
/** Le compte à qui ce lien appartient, ou `null` s'il n'a pas été noté. */
async function proprietaireDe(db, lien) {
	return (await db.prepare("SELECT compte_id FROM publications WHERE lien = ?").bind(lien).first())?.compte_id ?? null;
}
async function lireReponses(db, lien, avant) {
	const { results } = await (avant === void 0 ? db.prepare("SELECT contenu, recu_le FROM reponses WHERE lien = ? ORDER BY recu_le DESC LIMIT ?").bind(lien, 100) : db.prepare("SELECT contenu, recu_le FROM reponses WHERE lien = ? AND recu_le < ? ORDER BY recu_le DESC LIMIT ?").bind(lien, avant, 100)).all();
	return results;
}
function jetonDeLEntete(entetes) {
	const brut = entetes.get("authorization");
	if (brut === null) return null;
	const [schema, jeton] = brut.split(" ");
	if (schema !== "Appareil" || jeton === void 0) return null;
	return jeton;
}
//#endregion
//#region src/worker-reponses.ts
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
	if (contexte.request.method !== "GET") return json(405, { erreur: "méthode non permise" });
	const brut = contexte.params.lien;
	const lien = Array.isArray(brut) ? brut[0] ?? "" : brut ?? "";
	if (!lienValide(lien)) return json(404, { erreur: "introuvable" });
	const jeton = jetonDeLEntete(contexte.request.headers);
	if (jeton === null) return json(401, { erreur: "appareil-absent" });
	const db = contexte.env.COMPTES;
	const proprietaire = await proprietaireDe(db, lien);
	if (proprietaire === null) return json(404, { erreur: "introuvable" });
	if ((await compteDeLAppareil(db, await empreinte(jeton), /* @__PURE__ */ new Date())).id !== proprietaire) return json(404, { erreur: "introuvable" });
	const avant = Number(new URL(contexte.request.url).searchParams.get("avant") ?? "");
	return json(200, { reponses: (await lireReponses(db, lien, Number.isFinite(avant) && avant > 0 ? avant : void 0)).map((l) => ({
		contenu: lire(l.contenu),
		recuLe: l.recu_le
	})) });
}
/**
* Le contenu est du JSON écrit par nous, mais il a fait un aller-retour en
* base : une ligne abîmée ne doit pas faire tomber la lecture des cent autres.
*/
function lire(brut) {
	try {
		const valeur = JSON.parse(brut);
		return typeof valeur === "object" && valeur !== null ? valeur : {};
	} catch {
		return {};
	}
}
//#endregion
export { onRequest };
