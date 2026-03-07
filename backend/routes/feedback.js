/**
 * Doctor Feedback Routes
 *
 * Allow doctors to rate AI recommendations (good / okay / bad).
 */

const express = require('express');
const { getDb, queryOne, queryAll, runSql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/ai-feedback — Submit feedback for a visit
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { visitId, feedback } = req.body;

        if (!visitId || !feedback) {
            return res.status(400).json({ error: 'visitId and feedback are required' });
        }

        if (!['good', 'okay', 'bad'].includes(feedback)) {
            return res.status(400).json({ error: 'feedback must be: good, okay, or bad' });
        }

        await getDb();

        // Verify visit belongs to doctor
        const visit = queryOne('SELECT id FROM visits WHERE id = ? AND doctor_id = ?', [parseInt(visitId), req.user.id]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });

        // Upsert: update if feedback already exists for this visit by this doctor
        const existing = queryOne('SELECT id FROM doctor_feedback WHERE visit_id = ? AND doctor_id = ?', [parseInt(visitId), req.user.id]);

        if (existing) {
            runSql('UPDATE doctor_feedback SET feedback = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?', [feedback, existing.id]);
        } else {
            runSql('INSERT INTO doctor_feedback (visit_id, doctor_id, feedback) VALUES (?, ?, ?)', [parseInt(visitId), req.user.id, feedback]);
        }

        res.json({ message: 'Feedback recorded', feedback });
    } catch (err) {
        console.error('[Feedback] Error:', err);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/ai-feedback/:visitId — Get feedback for a visit
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:visitId', authenticateToken, async (req, res) => {
    try {
        const visitId = parseInt(req.params.visitId);
        await getDb();

        const feedback = queryOne('SELECT * FROM doctor_feedback WHERE visit_id = ? AND doctor_id = ?', [visitId, req.user.id]);

        res.json({
            feedback: feedback ? {
                id: feedback.id,
                visitId: feedback.visit_id,
                rating: feedback.feedback,
                createdAt: feedback.created_at,
            } : null
        });
    } catch (err) {
        console.error('[Feedback] Error:', err);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

module.exports = router;
