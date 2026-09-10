var MOTIF_LIEN = new RegExp(`^[23456789ABCDEFGHJKLMNPQRSTVWXYZ]{12}$`);
function lienValide(lien) {
	return MOTIF_LIEN.test(lien);
}
//#endregion
//#region src/worker-carte.ts
/** Une carte fait cent kilo-octets ; au-delà de deux cents, ce n'en est pas une. */
var TAILLE_MAX_CARTE = 204800;
/** Les huit premiers octets d'un PNG. Rien d'autre n'entre dans le seau. */
var SIGNATURE_PNG = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
];
function estPng(octets) {
	if (octets.length < SIGNATURE_PNG.length) return false;
	return SIGNATURE_PNG.every((o, i) => octets[i] === o);
}
function refus(statut, erreur) {
	return new Response(JSON.stringify({ erreur }), {
		status: statut,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
async function onRequest(contexte) {
	const brut = contexte.params.lien;
	const nom = Array.isArray(brut) ? brut[0] ?? "" : brut ?? "";
	const lien = nom.endsWith(".png") ? nom.slice(0, -4) : nom;
	if (!lienValide(lien)) return refus(404, "lien-invalide");
	if (contexte.request.method === "GET") {
		const objet = await contexte.env.CARTES.get(lien);
		if (objet === null) return refus(404, "carte-absente");
		return new Response(objet.body, { headers: {
			"content-type": "image/png",
			"cache-control": "public, max-age=31536000, immutable",
			"x-content-type-options": "nosniff"
		} });
	}
	if (contexte.request.method !== "PUT") return refus(405, "méthode non permise");
	const annonce = Number(contexte.request.headers.get("content-length") ?? "0");
	if (Number.isFinite(annonce) && annonce > 204800) return refus(413, "carte-trop-grosse");
	const octets = await contexte.request.arrayBuffer();
	if (octets.byteLength > 204800) return refus(413, "carte-trop-grosse");
	if (!estPng(new Uint8Array(octets))) return refus(415, "pas-une-image");
	await contexte.env.CARTES.put(lien, octets, { httpMetadata: { contentType: "image/png" } });
	return new Response(JSON.stringify({ lien }), { headers: {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	} });
}
//#endregion
export { TAILLE_MAX_CARTE, estPng, onRequest };
