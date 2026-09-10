import { describe, expect, it } from 'vitest'
import { lireEnvoiPython, pourApercuPython } from '../src/apercu-python.js'

/**
 * Le document Python, et la seule chose qui compte vraiment : le code de la
 * personne y entre et en ressort **au caractère près**, sans jamais devenir du
 * code de la page.
 */

const projet = (fichiers: readonly { nom: string; contenu: string }[]) => ({
  id: 'p1', nom: 'essai', maj: 0, fichiers,
})

/** Ce que le programme du cadre lira, extrait comme il le lira. */
function plan(doc: string): { fichiers: { nom: string; contenu: string }[]; entree: string | null } {
  const debut = doc.indexOf('id="a237-py">') + 'id="a237-py">'.length
  const fin = doc.indexOf('</script>', debut)
  return JSON.parse(doc.slice(debut, fin))
}

describe('le code de la personne', () => {
  it('traverse le document sans une virgule de différence', () => {
    const contenu = 'prix = 5800\nprint("Total :", prix * 3)\n# accents : é à ù — et 🙂'
    expect(plan(pourApercuPython(projet([{ nom: 'main.py', contenu }]))).fichiers[0]?.contenu)
      .toBe(contenu)
  })

  /*
   * Le cas qui compte.
   *
   * « </script> » dans une chaîne Python fermerait la balise qui transporte le
   * code : la moitié du programme deviendrait du texte affiché, et le reste du
   * balisage — écrit par quelqu'un d'autre — deviendrait du code de la page.
   *
   * `\/` est un échappement JSON valide qui se relit exactement `/`, donc le
   * texte revient entier. On vérifie les deux : la balise tient, et rien n'est
   * perdu.
   */
  it('« </script> » dans le code ne casse pas la balise, et revient entier', () => {
    const contenu = 'aide = "</script><img src=x onerror=alert(1)>"\nprint(aide)'
    const doc = pourApercuPython(projet([{ nom: 'main.py', contenu }]))
    expect(doc).not.toContain('</script><img')
    expect(plan(doc).fichiers[0]?.contenu).toBe(contenu)
  })

  it('emporte tous les fichiers Python, pour que « import » trouve les siens', () => {
    const doc = pourApercuPython(projet([
      { nom: 'main.py', contenu: 'import outils' },
      { nom: 'outils.py', contenu: 'def f(): pass' },
      { nom: 'notes.txt', contenu: 'pas du Python' },
    ]))
    expect(plan(doc).fichiers.map((f) => f.nom)).toEqual(['main.py', 'outils.py'])
  })

  it('lance « main.py » quand il existe', () => {
    const doc = pourApercuPython(projet([
      { nom: 'calcul.py', contenu: '' }, { nom: 'main.py', contenu: '' },
    ]))
    expect(plan(doc).entree).toBe('main.py')
  })

  it('et le dit, plutôt que de rien faire, quand il n’y a pas de Python', () => {
    const doc = pourApercuPython(projet([{ nom: 'index.html', contenu: '<p>' }]))
    expect(plan(doc).entree).toBe(null)
    expect(doc).toContain('n’a pas de fichier Python')
  })

  it('dit ce qu’il fait dans la langue de la personne', () => {
    const p = projet([{ nom: 'main.py', contenu: '' }])
    expect(pourApercuPython(p, 'en')).toContain('Python is starting')
    expect(pourApercuPython(p, 'fr')).toContain('Python démarre')
  })
})

describe('ce que le cadre accepte de recevoir', () => {
  const bon = { a237: 'python', base: 'https://etabli237.pages.dev/pyodide/', textes: {}, octets: {} }

  it('reconnaît un envoi du parent', () => {
    expect(lireEnvoiPython(bon)).not.toBe(null)
  })

  /*
   * N'importe quelle page ou extension peut poster dans ce cadre. Sans cette
   * vérification, son contenu passerait pour le moteur Python — c'est-à-dire
   * pour du code qu'on injecte en balise.
   */
  it('refuse tout le reste', () => {
    expect(lireEnvoiPython(null)).toBe(null)
    expect(lireEnvoiPython('python')).toBe(null)
    expect(lireEnvoiPython({ ...bon, a237: 'etabli' })).toBe(null)
    expect(lireEnvoiPython({ ...bon, textes: null })).toBe(null)
    expect(lireEnvoiPython({ ...bon, octets: 'des octets' })).toBe(null)
  })

  /*
   * Sans adresse absolue, Pyodide lève « Invalid URL » au démarrage : dans un
   * cadre `srcdoc` il n'y a pas de base contre laquelle résoudre du relatif.
   * Le refuser ici vaut mieux qu'un cadre qui démarre pour échouer.
   */
  it('et exige une adresse, parce qu’un cadre « srcdoc » n’a pas de base', () => {
    expect(lireEnvoiPython({ ...bon, base: '' })).toBe(null)
    expect(lireEnvoiPython({ ...bon, base: undefined })).toBe(null)
  })
})
