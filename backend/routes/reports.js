/**
 * Medical Reports Routes
 *
 * Upload, parse, retrieve, and delete medical reports (PDF/images).
 * Text extraction + lab value parsing happens at upload time — no AI call.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, queryAll, queryOne, runSql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { parseReport } = require('../services/labReportParser');

const router = express.Router();

// ─── File Upload Config ──────────────────────────────────────────────────────

const reportsDir = path.join(__dirname, '..', 'uploads', 'reports');
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, reportsDir),
    filename: (req, file, cb) => {
        const uniqueName = `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and image files (PNG, JPG, WEBP) are supported.'));
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/reports/upload/:visitId — Upload & parse a medical report
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/upload/:visitId', authenticateToken, upload.single('report'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No report file provided. Use field name "report".' });
        }

        const visitId = parseInt(req.params.visitId);
        await getDb();

        // Verify visit belongs to the doctor
        const visit = queryOne('SELECT id FROM visits WHERE id = ? AND doctor_id = ?', [visitId, req.user.id]);
        if (!visit) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Visit not found' });
        }

        console.log(`[Reports] Parsing report: ${req.file.originalname} (${req.file.mimetype})`);

        // Parse the report — extract text + structured lab values
        const { rawText, parsed } = await parseReport(req.file.path, req.file.mimetype);

        // Store in database
        const { lastId } = runSql(
            `INSERT INTO medical_reports (visit_id, doctor_id, report_type, original_filename, file_path, mime_type, raw_text, parsed_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                visitId,
                req.user.id,
                parsed.reportType || 'Lab Report',
                req.file.originalname,
                req.file.path,
                req.file.mimetype,
                rawText,
                JSON.stringify(parsed),
            ]
        );

        console.log(`[Reports] Report parsed and stored. ID: ${lastId}, Type: ${parsed.reportType}, Tests found: ${parsed.testResults?.length || 0}`);

        res.status(201).json({
            message: 'Report uploaded and parsed successfully',
            report: {
                id: lastId,
                visitId,
                reportType: parsed.reportType,
                filename: req.file.originalname,
                testResults: parsed.testResults || [],
                rawTextLength: rawText.length,
            }
        });
    } catch (err) {
        console.error('[Reports] Upload error:', err);
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: err.message || 'Report upload failed' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/reports/visit/:visitId — Get all reports for a visit
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/visit/:visitId', authenticateToken, async (req, res) => {
    try {
        const visitId = parseInt(req.params.visitId);
        await getDb();

        // Verify visit belongs to doctor
        const visit = queryOne('SELECT id FROM visits WHERE id = ? AND doctor_id = ?', [visitId, req.user.id]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });

        const reports = queryAll('SELECT * FROM medical_reports WHERE visit_id = ? ORDER BY created_at DESC', [visitId]);

        // Parse the JSON fields
        const parsed = reports.map(r => ({
            id: r.id,
            visitId: r.visit_id,
            reportType: r.report_type,
            filename: r.original_filename,
            mimeType: r.mime_type,
            parsedData: r.parsed_data ? JSON.parse(r.parsed_data) : null,
            createdAt: r.created_at,
        }));

        res.json({ reports: parsed });
    } catch (err) {
        console.error('[Reports] Fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/reports/:reportId — Get single report
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:reportId', authenticateToken, async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        await getDb();

        const report = queryOne('SELECT * FROM medical_reports WHERE id = ? AND doctor_id = ?', [reportId, req.user.id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        res.json({
            report: {
                id: report.id,
                visitId: report.visit_id,
                reportType: report.report_type,
                filename: report.original_filename,
                rawText: report.raw_text,
                parsedData: report.parsed_data ? JSON.parse(report.parsed_data) : null,
                createdAt: report.created_at,
            }
        });
    } catch (err) {
        console.error('[Reports] Fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/reports/:reportId — Delete a report
// ═══════════════════════════════════════════════════════════════════════════════

router.delete('/:reportId', authenticateToken, async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        await getDb();

        const report = queryOne('SELECT * FROM medical_reports WHERE id = ? AND doctor_id = ?', [reportId, req.user.id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        // Delete file from disk
        if (report.file_path && fs.existsSync(report.file_path)) {
            fs.unlinkSync(report.file_path);
        }

        runSql('DELETE FROM medical_reports WHERE id = ?', [reportId]);

        res.json({ message: 'Report deleted successfully' });
    } catch (err) {
        console.error('[Reports] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

module.exports = router;
