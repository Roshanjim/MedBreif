const express = require('express');
const { getDb, queryAll, queryOne, runSql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDb();
        let visits;
        if (req.user.role === 'patient') {
            const p = await queryOne('SELECT name FROM patients WHERE id = ?', [req.user.id]);
            const pName = p ? p.name : '';
            visits = await queryAll(`
                SELECT v.id, v.doctor_id, v.patient_id, v.patient_name, v.visit_date, v.status, v.confidence_score, v.created_at, v.updated_at,
                       u.name AS doctor_name, u.hospital_name
                FROM visits v
                LEFT JOIN users u ON v.doctor_id = u.id
                WHERE v.patient_id = ? OR (LOWER(v.patient_name) = LOWER(?) AND ? != "")
                ORDER BY v.created_at DESC
            `, [req.user.id, pName, pName]);
        } else {
            visits = await queryAll(`
                SELECT v.id, v.doctor_id, v.patient_id, v.patient_name, v.visit_date, v.status, v.confidence_score, v.created_at, v.updated_at,
                       u.name AS doctor_name, u.hospital_name
                FROM visits v
                LEFT JOIN users u ON v.doctor_id = u.id
                WHERE v.doctor_id = ?
                ORDER BY v.created_at DESC
            `, [req.user.id]);
        }
        res.json({ visits });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch visits' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        await getDb();
        let visit;
        if (req.user.role === 'patient') {
            const p = await queryOne('SELECT name FROM patients WHERE id = ?', [req.user.id]);
            const pName = p ? p.name : '';
            visit = await queryOne(`
                SELECT v.*, u.name AS doctor_name, u.hospital_name
                FROM visits v
                LEFT JOIN users u ON v.doctor_id = u.id
                WHERE v.id = ? AND (v.patient_id = ? OR (LOWER(v.patient_name) = LOWER(?) AND ? != ""))
            `, [parseInt(req.params.id), req.user.id, pName, pName]);
        } else {
            visit = await queryOne(`
                SELECT v.*, u.name AS doctor_name, u.hospital_name
                FROM visits v
                LEFT JOIN users u ON v.doctor_id = u.id
                WHERE v.id = ?
            `, [parseInt(req.params.id)]);
        }
        
        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        if (visit.extracted_data) visit.extracted_data = JSON.parse(visit.extracted_data);
        if (visit.ai_decision_log) visit.ai_decision_log = JSON.parse(visit.ai_decision_log);
        res.json({ visit });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch visit' }); }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { patient_name, visit_date, patient_id } = req.body;
        await getDb();

        let pid = null;
        if (patient_id) {
            const p = await queryOne('SELECT id, name FROM patients WHERE id = ? AND (doctor_id = ? OR doctor_id IS NULL)', [patient_id, req.user.id]);
            if (p) pid = p.id;
        }
        if (!pid && patient_name) {
            const p = await queryOne('SELECT id FROM patients WHERE LOWER(name) = LOWER(?) AND (doctor_id = ? OR doctor_id IS NULL)', [patient_name.trim(), req.user.id]);
            if (p) pid = p.id;
        }

        const { lastId } = await runSql('INSERT INTO visits (doctor_id, patient_id, patient_name, visit_date) VALUES (?, ?, ?, ?)',
            [req.user.id, pid, patient_name || 'Unknown Patient', visit_date || new Date().toISOString().split('T')[0]]);
        const visit = await queryOne('SELECT * FROM visits WHERE id = ?', [lastId]);
        res.status(201).json({ visit });
    } catch (err) { console.error('Create visit error:', err); res.status(500).json({ error: 'Failed to create visit' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const check = await queryOne('SELECT id FROM visits WHERE id = ?', [parseInt(req.params.id)]);
        if (!check) return res.status(404).json({ error: 'Visit not found' });

        const fields = ['patient_id', 'patient_name', 'status', 'transcript', 'doctor_summary', 'patient_summary', 'confidence_score', 'doctor_signature'];
        const updates = []; const values = [];
        fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); } });
        if (req.body.extracted_data !== undefined) { updates.push('extracted_data = ?'); values.push(typeof req.body.extracted_data === 'string' ? req.body.extracted_data : JSON.stringify(req.body.extracted_data)); }
        if (req.body.ai_decision_log !== undefined) { updates.push('ai_decision_log = ?'); values.push(typeof req.body.ai_decision_log === 'string' ? req.body.ai_decision_log : JSON.stringify(req.body.ai_decision_log)); }
        if (updates.length > 0) { updates.push("updated_at = NOW()"); values.push(parseInt(req.params.id)); await runSql(`UPDATE visits SET ${updates.join(', ')} WHERE id = ?`, values); }

        const visit = await queryOne('SELECT * FROM visits WHERE id = ?', [parseInt(req.params.id)]);
        if (visit.extracted_data) visit.extracted_data = JSON.parse(visit.extracted_data);
        res.json({ visit });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update visit' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const check = await queryOne('SELECT id FROM visits WHERE id = ?', [parseInt(req.params.id)]);
        if (!check) return res.status(404).json({ error: 'Visit not found' });
        await runSql('DELETE FROM visits WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ message: 'Visit deleted' });
    } catch (err) { res.status(500).json({ error: 'Failed to delete visit' }); }
});

module.exports = router;
