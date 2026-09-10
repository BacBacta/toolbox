import type { EnvoiPython, ManifestePython } from '@a237/etabli';
/**
 * Le manifeste, ou rien.
 *
 * Rien est un cas normal, pas une panne : les fichiers de Pyodide ne sont pas
 * versionnés, et une installation qui n'a pas lancé `pnpm pyodide` n'en a
 * simplement pas. L'Établi doit alors marcher exactement comme avant, sans
 * proposer Python — plutôt que de proposer un bouton qui échoue.
 */
export declare function manifestePython(): Promise<ManifestePython | null>;
export interface Avancement {
    readonly recus: number;
    readonly total: number;
}
/**
 * Le moteur, prêt à être posté au cadre.
 *
 * Ce qui est déjà gardé n'est pas redemandé — c'est tout l'objet du module. Ce
 * qui manque est descendu, **vérifié**, puis gardé.
 *
 * La vérification n'est pas de la méfiance envers le serveur : un
 * téléchargement de cinq mégaoctets sur un réseau qui coupe ne rate pas
 * bruyamment, il rend un fichier tronqué. Gardé tel quel, il ferait échouer
 * Python avec une erreur incompréhensible, à chaque lancement, sans que rien
 * ne suggère de recommencer. On préfère redemander.
 */
export declare function moteurPython(manifeste: ManifestePython, avance?: (a: Avancement) => void): Promise<EnvoiPython>;
/**
 * Python est-il déjà sur ce téléphone ?
 *
 * Sert à choisir ce qu'on affiche : le prix et un bouton, ou rien du tout. On
 * ne vérifie que la présence et la taille, pas les empreintes — recalculer
 * douze mégaoctets de SHA-256 pour décider d'un libellé ferait ramer l'écran
 * à chaque ouverture.
 */
/**
 * Poster le moteur au cadre — **sans transférer les octets**.
 *
 * La première version les transférait, pour éviter de recopier douze
 * mégaoctets. Elle marchait au premier lancement et pas au second : transférer
 * détache les tampons du côté du parent, et « Relancer » échouait sur
 * « ArrayBuffer at index 0 is already detached ». Aucun essai unitaire ne
 * l'aurait vu — il fallait lancer deux fois, dans un vrai navigateur.
 *
 * La recopie coûte un memcpy de douze mégaoctets, face aux deux secondes que
 * met Python à démarrer. L'à-coup que la première version voulait éviter était
 * une supposition ; le second lancement cassé, lui, était mesurable.
 */
export declare function posterMoteur(fenetre: Window, envoi: EnvoiPython): void;
export declare function dejaDescendu(manifeste: ManifestePython): Promise<boolean>;
