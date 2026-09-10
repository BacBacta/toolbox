//#region ../../packages/etabli/src/assembler.ts
var EXTENSIONS = {
	html: "html",
	htm: "html",
	css: "css",
	js: "js"
};
function sorteDuFichier(nom) {
	const point = nom.lastIndexOf(".");
	if (point === -1) return "inconnu";
	return EXTENSIONS[nom.slice(point + 1).toLowerCase()] ?? "inconnu";
}
var REPROCHES = {
	fr: {
		vide: () => "Donne-lui un nom.",
		espace: () => "Un nom ne commence ni ne finit par une espace.",
		dossier: () => "Pas de dossiers ici : un nom simple, comme « page.html ».",
		caracteres: () => "Lettres, chiffres, points, tirets et soulignés seulement.",
		extension: () => "Termine par .html, .css ou .js — ce sont les trois que je sais exécuter.",
		pris: (nom) => `« ${nom} » existe déjà dans ce projet.`
	},
	en: {
		vide: () => "Give it a name.",
		espace: () => "A name cannot start or end with a space.",
		dossier: () => "No folders here: a plain name, like \"page.html\".",
		caracteres: () => "Letters, digits, dots, dashes and underscores only.",
		extension: () => "End it with .html, .css or .js — those are the three I can run.",
		pris: (nom) => `"${nom}" already exists in this project.`
	}
};
/**
* Le nom d'un fichier, vérifié. `null` quand il va.
*
* Il sert de clef dans le projet et de libellé sur un onglet. Une barre oblique
* laisserait croire à des dossiers qui n'existent pas ; un doublon rendrait
* l'un des deux fichiers inatteignable — celui qu'on vient d'écrire, parce que
* la recherche s'arrête au premier.
*
* Le reproche est dit dans la langue de la personne. C'est le seul moment où
* l'éditeur refuse quelque chose ; le dire dans une langue qu'elle ne lit pas
* en ferait un refus sans raison.
*/
function verifierNomDeFichier(nom, pris, langue = "fr") {
	const dit = REPROCHES[langue];
	if (nom.trim() === "") return dit["vide"](nom);
	if (nom !== nom.trim()) return dit["espace"](nom);
	if (/[/\\]/.test(nom)) return dit["dossier"](nom);
	if (!/^[A-Za-z0-9._-]+$/.test(nom)) return dit["caracteres"](nom);
	if (sorteDuFichier(nom) === "inconnu") return dit["extension"](nom);
	if (pris.includes(nom)) return dit["pris"](nom);
	return null;
}
//#endregion
//#region ../../packages/etabli/src/depot.ts
/**
* Le dépôt : ce qui sauve un projet du téléphone perdu, et ce qui le partage.
*
* C'est le même travail, et c'était le premier écart bloquant face à Replit.
* Les projets ne vivaient que dans l'IndexedDB de l'appareil : téléphone volé,
* vendu, réinitialisé, ou simplement « effacer les données du site », et trois
* mois de travail disparaissaient sans avertissement. Personne ne découvre ça
* avant le jour où c'est arrivé.
*
* Et pas de compte pour autant. Créer un compte avant d'avoir écrit trois
* lignes est exactement la marche que cet outil existe pour retirer : un lien
* qu'on garde, une clef qui autorise à réécrire, et rien d'autre.
*/
/**
* L'alphabet du lien : celui des liens de l'atelier, et pour la même raison.
*
* Ni I, ni 1, ni O, ni 0, ni U. Un lien se dicte au téléphone et se recopie sur
* un cahier ; deux caractères qu'on confond à l'œil font perdre le travail
* qu'ils devaient retrouver.
*/
var ALPHABET_LIEN = "23456789ABCDEFGHJKLMNPQRSTVWXYZ";
/** Le nom d'un projet, à l'écran comme dans une liste. */
var MAX_NOM = 60;
var MOTIF_LIEN = new RegExp(`^[${ALPHABET_LIEN}]{10}$`);
var MOTIF_CLEF = /^[0-9a-f]+$/;
function lienValide(lien) {
	return typeof lien === "string" && MOTIF_LIEN.test(lien);
}
function clefValide(clef) {
	return typeof clef === "string" && clef.length === 32 && MOTIF_CLEF.test(clef);
}
/**
* Ce qui revient du serveur, vérifié.
*
* Un dépôt se lit publiquement : celui qui a le lien l'ouvre. Ce qui en revient
* a donc pu être écrit par n'importe qui, et ne devient un projet qu'après ce
* contrôle — sinon un dépôt trafiqué ferait tomber l'éditeur de celui qui ouvre
* un lien reçu sur WhatsApp, et il ne saurait même pas pourquoi.
*
* Les noms de fichiers passent par le même contrôle que la saisie à la main :
* c'est la seule façon que le lecteur d'un lien ne se retrouve pas avec un
* projet que son propre éditeur refuserait.
*/
function lireDepot(valeur) {
	if (typeof valeur !== "object" || valeur === null) return null;
	const d = valeur;
	if (typeof d.nom !== "string") return null;
	if (!Array.isArray(d.fichiers) || d.fichiers.length === 0) return null;
	if (d.fichiers.length > 8) return null;
	const fichiers = [];
	const vus = [];
	for (const brut of d.fichiers) {
		if (typeof brut !== "object" || brut === null) return null;
		const f = brut;
		if (typeof f.nom !== "string" || typeof f.contenu !== "string") return null;
		if (verifierNomDeFichier(f.nom, vus) !== null) return null;
		vus.push(f.nom);
		fichiers.push({
			nom: f.nom,
			contenu: f.contenu
		});
	}
	if (fichiers.reduce((t, f) => t + f.nom.length + f.contenu.length, 0) > 256e3) return null;
	return {
		nom: d.nom.slice(0, MAX_NOM),
		fichiers
	};
}
//#endregion
//#region src/worker-projet.ts
function json(statut, corps) {
	return new Response(JSON.stringify(corps), {
		status: statut,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
function segment(params) {
	const brut = params["lien"];
	return Array.isArray(brut) ? brut[0] ?? "" : brut ?? "";
}
async function onRequest(contexte) {
	const rangement = contexte.env.PROJETS;
	if (rangement === void 0) return json(503, { erreur: "le partage n’est pas ouvert" });
	const lien = segment(contexte.params);
	if (!lienValide(lien)) return json(404, { erreur: "lien-inconnu" });
	if (contexte.request.method === "GET") {
		const range = await rangement.get(lien, "json");
		if (range === null) return json(404, { erreur: "lien-inconnu" });
		return json(200, {
			nom: range.nom,
			fichiers: range.fichiers
		});
	}
	if (contexte.request.method !== "PUT") return json(405, { erreur: "méthode non permise" });
	if (Number(contexte.request.headers.get("content-length") ?? "0") > 512e3) return json(413, { erreur: "projet-trop-gros" });
	let recu;
	try {
		recu = await contexte.request.json();
	} catch {
		return json(400, { erreur: "corps-illisible" });
	}
	if (!clefValide(recu.clef)) return json(400, { erreur: "clef-invalide" });
	const depot = lireDepot({
		nom: recu.nom,
		fichiers: recu.fichiers
	});
	if (depot === null) return json(400, { erreur: "projet-invalide" });
	const existant = await rangement.get(lien, "json");
	if (existant !== null && existant.clef !== recu.clef) return json(404, { erreur: "lien-inconnu" });
	const range = {
		nom: depot.nom,
		fichiers: depot.fichiers,
		clef: recu.clef,
		depuis: existant?.depuis ?? Date.now()
	};
	await rangement.put(lien, JSON.stringify(range));
	return json(200, { lien });
}
//#endregion
export { onRequest };
