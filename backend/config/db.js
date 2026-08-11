const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

async function getDb() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medbrief',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
  });

  // Test connection and create tables
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('doctor', 'admin') DEFAULT 'doctor',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT,
        patient_uid VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        age INT,
        gender VARCHAR(50),
        medical_history LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (doctor_id, patient_uid)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT,
        patient_name VARCHAR(255) NOT NULL DEFAULT 'Unknown Patient',
        visit_date DATE DEFAULT (CURDATE()),
        status ENUM('recording', 'transcribing', 'reviewing', 'finalized') DEFAULT 'recording',
        audio_path TEXT,
        transcript LONGTEXT,
        extracted_data LONGTEXT,
        doctor_summary LONGTEXT,
        patient_summary LONGTEXT,
        confidence_score REAL,
        doctor_signature TEXT,
        ai_decision_log LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS medical_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visit_id INT,
        doctor_id INT,
        report_type VARCHAR(255) DEFAULT 'Lab Report',
        original_filename VARCHAR(255),
        file_path VARCHAR(255),
        mime_type VARCHAR(255),
        raw_text LONGTEXT,
        parsed_data LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ai_analysis (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visit_id INT UNIQUE,
        possible_conditions LONGTEXT,
        suggested_tests LONGTEXT,
        treatment_considerations LONGTEXT,
        risk_flags LONGTEXT,
        context_used LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS doctor_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visit_id INT,
        doctor_id INT,
        feedback ENUM('good', 'okay', 'bad'),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS soap_summaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visit_id INT UNIQUE,
        ai_soap LONGTEXT,
        doctor_soap LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
      )
    `);

    // Add patient_id to visits if not exists
    try {
        await connection.query('ALTER TABLE visits ADD COLUMN patient_id INT');
        await connection.query('ALTER TABLE visits ADD CONSTRAINT fk_patient_visit FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL');
    } catch (e) { /* Ignore if exists */ }

    // Add patient_id to medical_reports if not exists
    try {
        await connection.query('ALTER TABLE medical_reports ADD COLUMN patient_id INT');
        await connection.query('ALTER TABLE medical_reports ADD CONSTRAINT fk_patient_report FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE');
    } catch (e) { /* Ignore if exists */ }

    connection.release();
  } catch (err) {
    console.error('MySQL connection or setup failed:', err);
    throw err;
  }

  return pool;
}

/** Run a SELECT query and return array of row objects */
async function queryAll(sql, params = []) {
  if (!pool) await getDb();
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a SELECT query and return first row as object, or null */
async function queryOne(sql, params = []) {
  if (!pool) await getDb();
  const [rows] = await pool.query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Run an INSERT/UPDATE/DELETE and return info */
async function runSql(sql, params = []) {
  if (!pool) await getDb();
  const [result] = await pool.query(sql, params);
  return { lastId: result.insertId, changes: result.affectedRows };
}

module.exports = { getDb, queryAll, queryOne, runSql };
