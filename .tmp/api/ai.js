import { gemini, traiter } from '@a237/ia';
/** Une demande plus longue qu'un paragraphe n'est pas une demande d'outil. */
const MAX_DEMANDE = 400;
/** Le taux sert au journal des coûts. Une décision de gestion, pas une constante. */
const TAUX_FCFA_PAR_DOLLAR = Number(process.env.A237_TAUX_FCFA ?? '600');
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ erreur: 'méthode non permise' });
        return;
    }
    const clef = process.env.A237_CLEF_IA ?? '';
    const ouverte = process.env.A237_IA_OUVERTE === '1';
    if (clef === '' || !ouverte) {
        // 503 et non 500 : ce n'est pas cassé, ce n'est pas encore branché. Le
        // client le dit tel quel à l'utilisateur au lieu de tourner dans le vide.
        res.status(503).json({ erreur: 'la composition par le modèle n’est pas encore ouverte' });
        return;
    }
    const corps = req.body;
    const demande = typeof corps?.demande === 'string' ? corps.demande.trim() : '';
    if (demande === '' || demande.length > MAX_DEMANDE) {
        res.status(400).json({ erreur: 'demande absente ou trop longue' });
        return;
    }
    try {
        const resultat = await traiter(demande, gemini(clef), TAUX_FCFA_PAR_DOLLAR);
        // Le coût part dans le journal du serveur en attendant `ai_calls` : la
        // promesse du brief est « moins d'un franc par génération », et une
        // promesse qu'on ne mesure pas est une croyance.
        console.log(JSON.stringify({
            evenement: 'appel_ia',
            essais: resultat.essais,
            fcfa: resultat.cout.fcfa,
            aboutit: resultat.sorte === 'reussi',
        }));
        if (resultat.sorte !== 'reussi') {
            res.status(422).json({
                erreur: 'le modèle n’a pas produit un registre utilisable',
                details: resultat.erreurs.map((e) => `${e.chemin} : ${e.message}`),
            });
            return;
        }
        const registre = resultat.registre;
        res.status(200).json({ registre, fcfa: resultat.cout.fcfa });
    }
    catch (cause) {
        // Le message d'un fournisseur peut contenir la clef en écho : on ne le
        // propage pas au client, on le garde côté serveur.
        console.error('appel_ia_echoue', cause);
        res.status(502).json({ erreur: 'le modèle n’a pas répondu' });
    }
}
