-- Les comptes, les appareils qui les portent, ce qui a été payé et ce qui a
-- été dépensé. Quatre tables, et pas une de plus.
--
-- Le § 3.4 du brief en dessine cinq : il y a aussi `tools`. Elle n'est pas ici,
-- et c'est délibéré. Un outil vit sur le téléphone, dans IndexedDB (§ 2.7), et
-- son instantané publié vit dans KV : une troisième copie en base ne serait lue
-- par personne, et il faudrait pourtant la tenir à jour. On range ce qu'on
-- relit.
--
-- Les noms sont en français comme le reste du dépôt (§ 9). Le bloc SQL du brief
-- est une illustration — elle porte aussi un `slug` de quatre caractères, devenu
-- douze pour la même raison qu'une clé de coffre n'a pas quatre chiffres.

CREATE TABLE IF NOT EXISTS comptes (
  id             TEXT PRIMARY KEY,
  plan           TEXT NOT NULL DEFAULT 'essai',   -- essai | atelier
  plan_expire    INTEGER,                         -- ms depuis l'époque, NULL en essai
  credits        INTEGER NOT NULL DEFAULT 5,
  -- Renseigné au premier paiement, et par lui seul : avant, on n'en a pas
  -- besoin, et ce qu'on ne demande pas ne se perd pas.
  telephone      TEXT UNIQUE,
  -- L'empreinte du code de récupération. Le code lui-même n'est montré qu'une
  -- fois et n'est rangé nulle part.
  code_empreinte TEXT,
  cree_le        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS appareils (
  -- L'empreinte du jeton, jamais le jeton : une copie de la base ne distribue
  -- pas d'identités.
  empreinte  TEXT PRIMARY KEY,
  compte_id  TEXT NOT NULL REFERENCES comptes(id),
  etiquette  TEXT,
  vu_le      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS appareils_par_compte ON appareils(compte_id);

CREATE TABLE IF NOT EXISTS paiements (
  id           TEXT PRIMARY KEY,
  compte_id    TEXT NOT NULL REFERENCES comptes(id),
  fournisseur  TEXT NOT NULL,
  reference    TEXT NOT NULL,
  montant_xaf  INTEGER NOT NULL,
  etat         TEXT NOT NULL,                     -- attente | reussi | echoue
  telephone    TEXT NOT NULL,
  brut         TEXT,                              -- la charge du rappel, telle quelle
  cree_le      INTEGER NOT NULL,
  -- Le premier des deux verrous contre le rejeu. Le second est dans le code :
  -- un paiement qui n'est plus en attente ne se retranche pas.
  UNIQUE(fournisseur, reference)
);
CREATE INDEX IF NOT EXISTS paiements_par_compte ON paiements(compte_id);

CREATE TABLE IF NOT EXISTS appels_ia (
  id            TEXT PRIMARY KEY,
  compte_id     TEXT NOT NULL REFERENCES comptes(id),
  -- L'étage plutôt que la « sorte » du brief : il est déjà calculé, il dit la
  -- même chose, et c'est lui qui décide du prix.
  etage         INTEGER NOT NULL,
  jetons_entree INTEGER,
  jetons_sortie INTEGER,
  cout_xaf      REAL,
  ok            INTEGER NOT NULL,
  cree_le       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS appels_par_compte ON appels_ia(compte_id, cree_le);
