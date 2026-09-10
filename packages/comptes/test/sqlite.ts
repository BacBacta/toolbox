import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import type { BaseD1, Requete } from '../src/base.js'

/**
 * D1 est du SQLite. Les essais en prennent donc du vrai, pas une imitation.
 *
 * Un faux objet qui rendrait ce qu'on attend vérifierait que le code appelle
 * les méthodes qu'on a prévues — pas que la requête dit ce qu'on croit. C'est
 * précisément là que se cachent les erreurs qui comptent ici : `AND credits > 0`
 * dans la requête plutôt qu'autour, `INSERT OR IGNORE` qui laisse passer un
 * seul de deux appels simultanés, `UNIQUE(fournisseur, reference)` qui refuse
 * le second rappel.
 *
 * Ce que ce pont ne reproduit pas : `batch` n'est ici qu'une transaction, alors
 * que D1 la joue à distance. La sémantique — tout ou rien — est la même.
 */

/*
 * Toutes les migrations, dans l'ordre. Une base d'essai qui n'en jouerait
 * qu'une reproduirait un schéma qui n'existe nulle part.
 */
const MIGRATIONS = [
  new URL('../migrations/0001-comptes.sql', import.meta.url),
  new URL('../migrations/0002-reponses.sql', import.meta.url),
]

class RequeteSqlite implements Requete {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly valeurs: readonly unknown[] = [],
  ) {}

  bind(...valeurs: unknown[]): Requete {
    return new RequeteSqlite(this.db, this.sql, valeurs)
  }

  first<T>(): Promise<T | null> {
    const ligne = this.db.prepare(this.sql).get(...(this.valeurs as never[]))
    return Promise.resolve((ligne === undefined ? null : (ligne as T)))
  }

  all<T>(): Promise<{ readonly results: readonly T[] }> {
    return Promise.resolve({ results: this.db.prepare(this.sql).all(...(this.valeurs as never[])) as T[] })
  }

  run(): Promise<{ readonly meta?: { readonly changes?: number } }> {
    const r = this.db.prepare(this.sql).run(...(this.valeurs as never[]))
    return Promise.resolve({ meta: { changes: Number(r.changes) } })
  }

  /** Rejouée telle quelle dans la transaction de `batch`. */
  jouer(): void {
    this.db.prepare(this.sql).run(...(this.valeurs as never[]))
  }
}

export function baseDEssai(): BaseD1 {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  for (const m of MIGRATIONS) db.exec(readFileSync(m, 'utf8'))
  return {
    prepare: (sql: string) => new RequeteSqlite(db, sql),
    batch: (requetes: readonly Requete[]) => {
      db.exec('BEGIN')
      try {
        for (const r of requetes) (r as RequeteSqlite).jouer()
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      return Promise.resolve(undefined)
    },
  }
}
