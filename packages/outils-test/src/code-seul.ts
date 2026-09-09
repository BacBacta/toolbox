/**
 * Ne garde que le code : commentaires retirés, texte des chaînes retiré, mais
 * **expressions d'interpolation conservées** — `${etat.nom}` est du code.
 *
 * Sans ça le scanner criait sur le mot « document » écrit en français dans une
 * description de schéma. Un garde-fou qui hurle à tort finit par être désactivé.
 * Il est lui-même testé : un scanner devenu aveugle ne se voit pas.
 */
export function codeSeul(source: string): string {
  let out = ''
  let i = 0
  const n = source.length

  while (i < n) {
    const c = source.charAt(i)
    const suivant = source.charAt(i + 1)

    if (c === '/' && suivant === '*') {
      const fin = source.indexOf('*/', i + 2)
      i = fin === -1 ? n : fin + 2
      out += ' '
      continue
    }

    if (c === '/' && suivant === '/') {
      const fin = source.indexOf('\n', i + 2)
      i = fin === -1 ? n : fin
      out += ' '
      continue
    }

    if (c === "'" || c === '"') {
      i += 1
      while (i < n) {
        const d = source.charAt(i)
        if (d === '\\') {
          i += 2
          continue
        }
        i += 1
        if (d === c || d === '\n') break
      }
      out += ' "" '
      continue
    }

    if (c === '`') {
      i += 1
      while (i < n) {
        const d = source.charAt(i)
        if (d === '\\') {
          i += 2
          continue
        }
        if (d === '`') {
          i += 1
          break
        }
        if (d === '$' && source.charAt(i + 1) === '{') {
          i += 2
          const debut = i
          let profondeur = 1
          while (i < n && profondeur > 0) {
            const e = source.charAt(i)
            if (e === '{') profondeur += 1
            else if (e === '}') profondeur -= 1
            i += 1
          }
          out += ` ${source.slice(debut, Math.max(debut, i - 1))} `
          continue
        }
        i += 1
      }
      continue
    }

    out += c
    i += 1
  }

  return out
}
