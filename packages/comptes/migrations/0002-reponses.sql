-- Ce qu'un formulaire publié reçoit, et qui l'a publié.
--
-- Deux tables, et elles vont ensemble : une adresse publique où n'importe qui
-- écrit n'a de sens que si quelqu'un est le destinataire. `publications` dit
-- qui ; `reponses` dit quoi.
--
-- C'est la première fois que le produit accepte une écriture venue de
-- l'extérieur. Tout le reste part du téléphone de son propriétaire — un
-- instantané qu'il dépose, un paiement qu'il déclenche. Ici, c'est un inconnu
-- qui écrit, et le plafond, le piège à robots et l'empreinte d'adresse sont ce
-- qui fait tenir la porte ouverte.

CREATE TABLE IF NOT EXISTS publications (
  -- Le lien public, douze caractères. C'est la clef partout ailleurs aussi.
  lien       TEXT PRIMARY KEY,
  compte_id  TEXT NOT NULL REFERENCES comptes(id),
  -- Ce qui a été publié, pour savoir sans lire KV si l'adresse reçoit.
  skeleton   TEXT NOT NULL,
  cree_le    INTEGER NOT NULL,
  maj_le     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS publications_par_compte ON publications(compte_id, maj_le DESC);

CREATE TABLE IF NOT EXISTS reponses (
  id       TEXT PRIMARY KEY,
  lien     TEXT NOT NULL REFERENCES publications(lien),
  -- Le JSON de ce qui a été rempli, déjà ramené à ce que le formulaire
  -- demandait : rien de ce qui n'était pas dans la configuration n'entre ici.
  contenu  TEXT NOT NULL,
  -- L'empreinte de l'adresse, jamais l'adresse. Elle ne sert qu'à espacer deux
  -- envois du même endroit ; une copie de la base ne dit pas qui a répondu, et
  -- c'est le point : un formulaire de tontine reçoit des choses qui ne
  -- regardent pas l'hébergeur.
  source   TEXT,
  recu_le  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reponses_par_lien ON reponses(lien, recu_le DESC);
CREATE INDEX IF NOT EXISTS reponses_par_source ON reponses(lien, source, recu_le DESC);
