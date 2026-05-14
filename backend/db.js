const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'shelfy.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'box',
    description TEXT DEFAULT '',
    location_id INTEGER NOT NULL,
    qr_token TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1,
    tags TEXT DEFAULT '',
    container_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE
  );
`);

// Add qr_token column to existing databases that pre-date this column.
const hasQrToken = db.prepare(
  `SELECT COUNT(*) AS c FROM pragma_table_info('containers') WHERE name = 'qr_token'`
).get().c > 0;

if (!hasQrToken) {
  db.exec(`ALTER TABLE containers ADD COLUMN qr_token TEXT`);
}

// Ensure the unique index exists (safe to run on both fresh and existing DBs).
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_containers_qr_token ON containers(qr_token)`);

// Backfill any rows that still have a NULL qr_token (new column or pre-existing rows).
const backfill = db.prepare(`UPDATE containers SET qr_token = ? WHERE id = ? AND qr_token IS NULL`);
const backfillAll = db.transaction(() => {
  const rows = db.prepare(`SELECT id FROM containers WHERE qr_token IS NULL`).all();
  for (const row of rows) {
    backfill.run(crypto.randomBytes(16).toString('hex'), row.id);
  }
});
backfillAll();

module.exports = db;
