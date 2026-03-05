const express = require('express');
const { getDb, queryAll, queryOne, runSql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const visits = queryAll('SELECT id, patient_name, visit_date, status, confidence_score, created_at, updated_at FROM visits WHERE doctor_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json({ visits });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch visits' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const visit = queryOne('SELECT * FROM visits WHERE id = ? AND doctor_id = ?', [parseInt(req.params.id), req.user.id]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        if (visit.extracted_data) visit.extracted_data = JSON.parse(visit.extracted_data);
        if (visit.ai_decision_log) visit.ai_decision_log = JSON.parse(visit.ai_decision_log);
        res.json({ visit });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch visit' }); }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { patient_name, visit_date } = req.body;
        await getDb();
        const { lastId } = runSql('INSERT INTO visits (doctor_id, patient_name, visit_date) VALUES (?, ?, ?)',
            [req.user.id, patient_name || 'Unknown Patient', visit_date || new Date().toISOString().split('T')[0]]);
        const visit = queryOne('SELECT * FROM visits WHERE id = ?', [lastId]);
        res.status(201).json({ visit });
    } catch (err) { console.error('Create visit error:', err); res.status(500).json({ error: 'Failed to create visit' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const check = queryOne('SELECT id FROM visits WHERE id = ? AND doctor_id = ?', [parseInt(req.params.id), req.user.id]);
        if (!check) return res.status(404).json({ error: 'Visit not found' });

        const fields = ['patient_name', 'status', 'transcript', 'doctor_summary', 'patient_summary', 'confidence_score', 'doctor_signature'];
        const updates = []; const values = [];
        fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); } });
        if (req.body.extracted_data !== undefined) { updates.push('extracted_data = ?'); values.push(typeof req.body.extracted_data === 'string' ? req.body.extracted_data : JSON.stringify(req.body.extracted_data)); }
        if (req.body.ai_decision_log !== undefined) { updates.push('ai_decision_log = ?'); values.push(typeof req.body.ai_decision_log === 'string' ? req.body.ai_decision_log : JSON.stringify(req.body.ai_decision_log)); }
        if (updates.length > 0) { updates.push("updated_at = datetime('now')"); values.push(parseInt(req.params.id)); runSql(`UPDATE visits SET ${updates.join(', ')} WHERE id = ?`, values); }

        const visit = queryOne('SELECT * FROM visits WHERE id = ?', [parseInt(req.params.id)]);
        if (visit.extracted_data) visit.extracted_data = JSON.parse(visit.extracted_data);
        res.json({ visit });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update visit' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const check = queryOne('SELECT id FROM visits WHERE id = ? AND doctor_id = ?', [parseInt(req.params.id), req.user.id]);
        if (!check) return res.status(404).json({ error: 'Visit not found' });
        runSql('DELETE FROM visits WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ message: 'Visit deleted' });
    } catch (err) { res.status(500).json({ error: 'Failed to delete visit' }); }
});

module.exports = router;
