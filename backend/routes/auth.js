const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, queryOne, queryAll, runSql } = require('../config/db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, hospital_name } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });

        await getDb();
        const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) return res.status(409).json({ error: 'Email already registered' });

        const password_hash = bcrypt.hashSync(password, 10);
        const userRole = role === 'admin' ? 'admin' : 'doctor';
        const { lastId } = await runSql('INSERT INTO users (name, email, password_hash, role, hospital_name) VALUES (?, ?, ?, ?, ?)', [name, email, password_hash, userRole, hospital_name || null]);

        const token = jwt.sign({ id: lastId, email, name, role: userRole, hospital_name: hospital_name || null }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ message: 'Registration successful', token, user: { id: lastId, name, email, role: userRole, hospital_name: hospital_name || null } });
    } catch (err) { console.error('Register error:', err); res.status(500).json({ error: 'Registration failed' }); }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        await getDb();
        const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Login failed' }); }
});

router.post('/patient-register', async (req, res) => {
    try {
        const { name, age, gender, medical_history } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        await getDb();
        const patient_uid = `PAT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const { lastId } = await runSql(
            `INSERT INTO patients (doctor_id, patient_uid, name, age, gender, medical_history) VALUES (NULL, ?, ?, ?, ?, ?)`,
            [patient_uid, name, age || null, gender || null, medical_history ? JSON.stringify(medical_history) : null]
        );

        const token = jwt.sign({ id: lastId, name, role: 'patient', patient_uid }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ 
            message: 'Patient registered successfully', 
            token, 
            user: { id: lastId, name, patient_uid, role: 'patient' } 
        });
    } catch (err) {
        console.error('Patient Register error:', err);
        res.status(500).json({ error: 'Patient Registration failed' });
    }
});

router.post('/patient-login', async (req, res) => {
    try {
        const { patient_uid, name } = req.body;
        if (!patient_uid || !name) return res.status(400).json({ error: 'Patient ID and Name are required' });

        await getDb();
        const uid = patient_uid.trim().toUpperCase();
        const patientName = name.trim();
        
        const user = await queryOne('SELECT * FROM patients WHERE UPPER(patient_uid) = ? AND LOWER(name) = LOWER(?)', [uid, patientName]);
        if (!user) return res.status(401).json({ error: 'Invalid Patient ID or Name' });

        const token = jwt.sign({ id: user.id, name: user.name, role: 'patient', patient_uid: user.patient_uid }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
            message: 'Patient Login successful', 
            token, 
            user: { id: user.id, name: user.name, patient_uid: user.patient_uid, role: 'patient' } 
        });
    } catch (err) { 
        console.error('Patient Login error:', err); 
        res.status(500).json({ error: 'Patient Login failed' }); 
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        await getDb();
        if (req.user.role === 'patient') {
            const user = await queryOne('SELECT id, name, patient_uid, created_at FROM patients WHERE id = ?', [req.user.id]);
            if (!user) return res.status(404).json({ error: 'Patient not found' });
            return res.json({ user: { ...user, role: 'patient' } });
        } else {
            const user = await queryOne('SELECT id, name, email, role, hospital_name, created_at FROM users WHERE id = ?', [req.user.id]);
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json({ user });
        }
    } catch (err) { res.status(500).json({ error: 'Failed to fetch profile' }); }
});

router.put('/me', authenticateToken, async (req, res) => {
    try {
        await getDb();
        if (req.user.role === 'patient') {
            return res.status(403).json({ error: 'Patients cannot update doctor profile' });
        }

        const { name, hospital_name } = req.body;
        const fields = []; const values = [];
        if (name !== undefined) { fields.push('name = ?'); values.push(name); }
        if (hospital_name !== undefined) { fields.push('hospital_name = ?'); values.push(hospital_name); }

        if (fields.length > 0) {
            values.push(req.user.id);
            await runSql(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        }

        const user = await queryOne('SELECT id, name, email, role, hospital_name, created_at FROM users WHERE id = ?', [req.user.id]);
        res.json({ user });
    } catch (err) { console.error('Update profile error:', err); res.status(500).json({ error: 'Failed to update profile' }); }
});

module.exports = router;
