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

  db.run(`
    CREATE TABLE IF NOT EXISTS medical_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER REFERENCES visits(id) ON DELETE CASCADE,
      doctor_id INTEGER REFERENCES users(id),
      report_type TEXT DEFAULT 'Lab Report',
      original_filename TEXT,
      file_path TEXT,
      mime_type TEXT,
      raw_text TEXT,
      parsed_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
      possible_conditions TEXT,
      suggested_tests TEXT,
      treatment_considerations TEXT,
      risk_flags TEXT,
      context_used TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS doctor_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER REFERENCES visits(id) ON DELETE CASCADE,
      doctor_id INTEGER REFERENCES users(id),
      feedback TEXT CHECK(feedback IN ('good','okay','bad')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS soap_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
      ai_soap TEXT,
      doctor_soap TEXT,
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
