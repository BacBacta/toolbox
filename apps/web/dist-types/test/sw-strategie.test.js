import { describe, expect, it } from 'vitest';
import { cachesAPurger, fichiersAPrecacher, nomCache, strategiePour } from '../src/sw-strategie.js';
const ORIGINE = 'https://atl.cm';
function requete(p = {}) {
    return {
        methode: 'GET',
        mode: 'no-cors',
        url: `${ORIGINE}/assets/app-abc123.js`,
        destination: 'script',
        ...p,
    };
}
describe('strategiePour', () => {
    it('sert la coquille sur une navigation, pour que l’app s’ouvre hors ligne', () => {
        expect(strategiePour(requete({ mode: 'navigate', destination: 'document' }), ORIGINE))
            .toBe('coquille');
    });
    it('met en cache les fichiers de l’application', () => {
        for (const destination of ['script', 'style', 'font', 'image', 'manifest', '']) {
            expect(strategiePour(requete({ destination }), ORIGINE)).toBe('cache-puis-reseau');
        }
    });
    it('ne met jamais en cache autre chose qu’une lecture', () => {
        for (const methode of ['POST', 'PUT', 'DELETE']) {
            expect(strategiePour(requete({ methode }), ORIGINE)).toBe('reseau');
        }
    });
    it('laisse passer ce qui vient d’ailleurs', () => {
        expect(strategiePour(requete({ url: 'https://exemple.cm/pixel.js' }), ORIGINE)).toBe('reseau');
    });
    it('laisse passer une requête de données, qui n’est pas un fichier d’app', () => {
        expect(strategiePour(requete({ destination: 'audio' }), ORIGINE)).toBe('reseau');
    });
    it('ne se casse pas sur une URL illisible', () => {
        expect(strategiePour(requete({ url: 'pas une url' }), ORIGINE)).toBe('reseau');
    });
    it('traite une navigation avant tout le reste, même en POST… non : le POST gagne', () => {
        // Un envoi de formulaire ne doit pas rendre la coquille en cache.
        expect(strategiePour(requete({ methode: 'POST', mode: 'navigate' }), ORIGINE)).toBe('reseau');
    });
});
describe('le nom du cache', () => {
    it('porte sa version', () => {
        expect(nomCache('1')).toBe('atelier237-1');
        expect(nomCache('2')).not.toBe(nomCache('1'));
    });
});
describe('cachesAPurger', () => {
    it('supprime nos anciens caches et garde le courant', () => {
        expect(cachesAPurger(['atelier237-1', 'atelier237-2'], 'atelier237-2')).toEqual(['atelier237-1']);
    });
    it('ne touche pas aux caches des autres', () => {
        expect(cachesAPurger(['un-autre-site', 'atelier237-1'], 'atelier237-1')).toEqual([]);
    });
    it('ne se plaint pas d’une liste vide', () => {
        expect(cachesAPurger([], 'atelier237-1')).toEqual([]);
    });
});
describe('fichiersAPrecacher', () => {
    it('met la coquille en tête', () => {
        expect(fichiersAPrecacher([])).toEqual(['/', '/index.html', '/manifest.webmanifest']);
    });
    it('préfixe les fichiers émis par la construction', () => {
        expect(fichiersAPrecacher(['assets/app-abc.js'])).toContain('/assets/app-abc.js');
    });
    it('dédoublonne — sinon cache.addAll rejette et l’installation échoue en silence', () => {
        const liste = fichiersAPrecacher(['index.html', 'assets/app.js', '/assets/app.js']);
        expect(liste.filter((f) => f === '/index.html')).toHaveLength(1);
        expect(liste.filter((f) => f === '/assets/app.js')).toHaveLength(1);
        expect(new Set(liste).size).toBe(liste.length);
    });
    it('précharge toute l’application, fragments d’outils compris', () => {
        const liste = fichiersAPrecacher(['index.html', 'assets/index.js', 'assets/njangi.js', 'assets/index.css']);
        expect(liste).toContain('/assets/njangi.js');
        expect(liste).toContain('/assets/index.css');
    });
});
