const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'medbrief.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'doctor' CHECK(role IN ('doctor','admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER REFERENCES users(id),
      patient_name TEXT NOT NULL DEFAULT 'Unknown Patient',
      visit_date DATE DEFAULT (date('now')),
      status TEXT DEFAULT 'recording' CHECK(status IN ('recording','transcribing','reviewing','finalized')),
      audio_path TEXT,
      transcript TEXT,
      extracted_data TEXT,
      doctor_summary TEXT,
      patient_summary TEXT,
      confidence_score REAL,
      doctor_signature TEXT,
      ai_decision_log TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDb();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/** Run a SELECT query and return array of row objects */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** Run a SELECT query and return first row as object, or null */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Run an INSERT/UPDATE/DELETE and return info */
function runSql(sql, params = []) {
  db.run(sql, params);
  const id = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
  const changes = db.getRowsModified();
  saveDb();
  return { lastId: id, changes };
}

module.exports = { getDb, saveDb, queryAll, queryOne, runSql };
