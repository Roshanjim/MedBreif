const express = require('express');
const { getDb, queryOne } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { generatePDF } = require('../services/pdfGenerator');

const router = express.Router();

router.get('/:visitId', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const visit = await queryOne('SELECT * FROM visits WHERE id = ? AND doctor_id = ?', [parseInt(req.params.visitId), req.user.id]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        const extractedData = visit.extracted_data ? JSON.parse(visit.extracted_data) : null;
        if (!extractedData) return res.status(400).json({ error: 'No extracted data for PDF' });

        const pdfBuffer = await generatePDF(visit, extractedData, visit.doctor_summary);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=MedBrief_Visit_${visit.id}.pdf`);
        res.send(pdfBuffer);
    } catch (err) { console.error('PDF error:', err); res.status(500).json({ error: 'PDF generation failed' }); }
});

module.exports = router;
