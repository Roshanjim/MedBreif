const express = require('express');
const { getDb, queryAll, queryOne, runSql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate a random patient ID
const generatePatientUid = () => {
    return 'PAT-' + Math.floor(1000 + Math.random() * 9000);
};

// Get all patients for the doctor
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const patients = await queryAll('SELECT id, patient_uid, name, age, gender, created_at FROM patients WHERE doctor_id = ? OR doctor_id IS NULL ORDER BY created_at DESC', [req.user.id]);
        res.json({ patients });
    } catch (err) { 
        console.error('Fetch patients error:', err); 
        res.status(500).json({ error: 'Failed to fetch patients' }); 
    }
});

// Get specific patient details along with their visits and reports
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        await getDb();
        let patient;
        if (req.user.role === 'patient') {
            if (parseInt(req.params.id) !== req.user.id) return res.status(403).json({ error: 'Access denied' });
            patient = await queryOne('SELECT * FROM patients WHERE id = ?', [parseInt(req.params.id)]);
        } else {
            patient = await queryOne('SELECT * FROM patients WHERE id = ? AND (doctor_id = ? OR doctor_id IS NULL)', [parseInt(req.params.id), req.user.id]);
        }
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        if (patient.medical_history) {
            try { patient.medical_history = JSON.parse(patient.medical_history); } catch (e) {}
        }

        const visits = await queryAll('SELECT id, visit_date, status, confidence_score, created_at FROM visits WHERE patient_id = ? ORDER BY visit_date DESC', [patient.id]);
        const reports = await queryAll('SELECT id, report_type, original_filename, created_at FROM medical_reports WHERE patient_id = ? ORDER BY created_at DESC', [patient.id]);

        res.json({ patient, visits, reports });
    } catch (err) { 
        console.error('Fetch patient error:', err); 
        res.status(500).json({ error: 'Failed to fetch patient' }); 
    }
});

// Register a new patient
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, age, gender, medical_history } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        await getDb();
        const patientUid = generatePatientUid();
        
        const historyStr = medical_history ? JSON.stringify(medical_history) : null;

        const { lastId } = await runSql(
            'INSERT INTO patients (doctor_id, patient_uid, name, age, gender, medical_history) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, patientUid, name, age || null, gender || null, historyStr]
        );

        const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [lastId]);
        if (patient.medical_history) patient.medical_history = JSON.parse(patient.medical_history);
        
        res.status(201).json({ patient });
    } catch (err) { 
        console.error('Create patient error:', err); 
        res.status(500).json({ error: 'Failed to register patient' }); 
    }
});

// Update a patient's medical history or details
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { name, age, gender, medical_history } = req.body;
        await getDb();
        
        let check;
        if (req.user.role === 'patient') {
            if (parseInt(req.params.id) !== req.user.id) return res.status(403).json({ error: 'Access denied' });
            check = await queryOne('SELECT id FROM patients WHERE id = ?', [parseInt(req.params.id)]);
        } else {
            check = await queryOne('SELECT id FROM patients WHERE id = ? AND (doctor_id = ? OR doctor_id IS NULL)', [parseInt(req.params.id), req.user.id]);
        }
        if (!check) return res.status(404).json({ error: 'Patient not found' });

        const fields = []; const values = [];
        if (name !== undefined) { fields.push('name = ?'); values.push(name); }
        if (age !== undefined) { fields.push('age = ?'); values.push(age); }
        if (gender !== undefined) { fields.push('gender = ?'); values.push(gender); }
        if (medical_history !== undefined) { 
            fields.push('medical_history = ?'); 
            values.push(JSON.stringify(medical_history)); 
        }

        if (fields.length > 0) {
            values.push(parseInt(req.params.id));
            await runSql(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, values);
        }

        const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [parseInt(req.params.id)]);
        if (patient.medical_history) patient.medical_history = JSON.parse(patient.medical_history);
        
        res.json({ patient });
    } catch (err) { 
        console.error('Update patient error:', err); 
        res.status(500).json({ error: 'Failed to update patient' }); 
    }
});

module.exports = router;
