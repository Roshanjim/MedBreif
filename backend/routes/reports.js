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
        const allowed = [
            'application/pdf', 
            'image/png', 
            'image/jpeg', 
            'image/jpg', 
            'image/webp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, Word Docs (DOC/DOCX), and image files are supported.'));
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
        const visit = await queryOne('SELECT id FROM visits WHERE id = ? AND doctor_id = ?', [visitId, req.user.id]);
        if (!visit) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Visit not found' });
        }

        console.log(`[Reports] Parsing report: ${req.file.originalname} (${req.file.mimetype})`);

        // Parse the report — extract text + structured lab values
        const { rawText, parsed } = await parseReport(req.file.path, req.file.mimetype);

        // Store in database
        const { lastId } = await runSql(
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
//  POST /api/reports/upload/patient/:patientId — Upload & parse a medical report for a patient
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/upload/patient/:patientId', authenticateToken, upload.single('report'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No report file provided. Use field name "report".' });
        }

        const patientId = parseInt(req.params.patientId);
        await getDb();

        let patient;
        let doctorIdToInsert = null;
        if (req.user.role === 'patient') {
            if (patientId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
            patient = await queryOne('SELECT id, doctor_id FROM patients WHERE id = ?', [patientId]);
            if (patient) doctorIdToInsert = patient.doctor_id;
        } else {
            patient = await queryOne('SELECT id, doctor_id FROM patients WHERE id = ? AND (doctor_id = ? OR doctor_id IS NULL)', [patientId, req.user.id]);
            doctorIdToInsert = req.user.id;
        }
        if (!patient) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Patient not found' });
        }

        console.log(`[Reports] Parsing patient report: ${req.file.originalname}`);
        const { rawText, parsed } = await parseReport(req.file.path, req.file.mimetype);

        const { lastId } = await runSql(
            `INSERT INTO medical_reports (patient_id, doctor_id, report_type, original_filename, file_path, mime_type, raw_text, parsed_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [patientId, doctorIdToInsert, parsed.reportType || 'Lab Report', req.file.originalname, req.file.path, req.file.mimetype, rawText, JSON.stringify(parsed)]
        );

        res.status(201).json({
            message: 'Patient report uploaded',
            report: { id: lastId, patientId, reportType: parsed.reportType, filename: req.file.originalname }
        });
    } catch (err) {
        console.error('[Reports] Upload error:', err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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
        const visit = await queryOne('SELECT id FROM visits WHERE id = ? AND doctor_id = ?', [visitId, req.user.id]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });

        const reports = await queryAll('SELECT * FROM medical_reports WHERE visit_id = ? ORDER BY created_at DESC', [visitId]);

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

// Helper to check report authorization
async function fetchAuthorizedReport(reportId, user) {
    const report = await queryOne('SELECT * FROM medical_reports WHERE id = ?', [reportId]);
    if (!report) return null;
    if (user.role === 'patient') {
        if (report.patient_id === user.id) return report;
        return null;
    }
    // Doctors can access if they uploaded it, or if it's assigned to a patient
    return report;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/reports/:reportId — Get single report details (JSON)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:reportId', authenticateToken, async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        await getDb();

        const report = await fetchAuthorizedReport(reportId, req.user);
        if (!report) return res.status(404).json({ error: 'Report not found or access denied' });

        res.json({
            report: {
                id: report.id,
                visitId: report.visit_id,
                patientId: report.patient_id,
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
//  GET /api/reports/:reportId/file — View/Download actual report file
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:reportId/file', authenticateToken, async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        await getDb();

        const report = await fetchAuthorizedReport(reportId, req.user);
        if (!report || !report.file_path || !fs.existsSync(report.file_path)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.contentType(report.mime_type || 'application/octet-stream');
        res.sendFile(path.resolve(report.file_path));
    } catch (err) {
        console.error('[Reports] File fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch file' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/reports/:reportId — Delete a report
// ═══════════════════════════════════════════════════════════════════════════════

router.delete('/:reportId', authenticateToken, async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        await getDb();

        const report = await fetchAuthorizedReport(reportId, req.user);
        if (!report) return res.status(404).json({ error: 'Report not found or access denied' });

        // Delete file from disk
        if (report.file_path && fs.existsSync(report.file_path)) {
            fs.unlinkSync(report.file_path);
        }

        await runSql('DELETE FROM medical_reports WHERE id = ?', [reportId]);

        res.json({ message: 'Report deleted successfully' });
    } catch (err) {
        console.error('[Reports] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

module.exports = router;
