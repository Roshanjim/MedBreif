const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, queryOne, runSql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { transcribeAudio } = require('../services/transcription');
const { extractMedicalData } = require('../services/extraction');
const { generateDoctorSummary, generatePatientSummary } = require('../services/summaryFormatter');
const { generateDiagnosis } = require('../services/aiDiagnosis');
const { generateSOAP, updateDoctorSOAP } = require('../services/soapGenerator');

const router = express.Router();

// ─── Multer config for standalone transcribe endpoint ─────────────────────────

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = `ai_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname) || '.webm'}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.mp3', '.wav', '.webm', '.ogg', '.m4a', '.mp4', '.flac'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  STANDALONE ROUTES (no visit/auth required)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/ai/transcribe-audio
 * Upload an audio file → get English transcript back.
 * Standalone endpoint, no authentication or visit required.
 *
 * Body: multipart/form-data with field "audio"
 * Response: { full_text, language, duration, processing_time }
 */
router.post('/transcribe-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided. Use field name "audio".' });
        }

        console.log(`[AI] Transcribing: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

        const { transcript, decisionLog } = await transcribeAudio(req.file.path);

        res.json({
            full_text: transcript.text,
            language: transcript.language,
            duration: transcript.duration,
            confidence: transcript.confidence,
            processing: decisionLog
        });
    } catch (err) {
        console.error('[AI] Transcription error:', err.message);
        res.status(500).json({ error: `Transcription failed: ${err.message}` });
    }
});

/**
 * POST /api/ai/summarize-text
 * Takes a transcript string → returns structured medical JSON.
 * Standalone endpoint, no authentication or visit required.
 *
 * Body: { "transcript": "..." }
 * Response: { Symptoms, Diagnosis, Prescriptions, ... }
 */
router.post('/summarize-text', async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript || typeof transcript !== 'string') {
            return res.status(400).json({ error: 'Missing "transcript" field in request body.' });
        }

        console.log(`[AI] Summarizing transcript (${transcript.length} chars)`);

        const { extractedData, decisionLog } = await extractMedicalData(transcript);

        res.json({
            Symptoms: extractedData.Symptoms || [],
            Diagnosis: extractedData.Diagnosis || [],
            Prescriptions: extractedData.Prescriptions || [],
            TestsAdvised: extractedData.TestsAdvised || [],
            LifestyleAdvice: extractedData.LifestyleAdvice || [],
            FollowUp: extractedData.FollowUp || '',
            UnclearItems: extractedData.UnclearItems || [],
            // Also include full data for completeness
            _full: extractedData,
            _processing: decisionLog
        });
    } catch (err) {
        console.error('[AI] Summarization error:', err.message);
        res.status(500).json({ error: `Summarization failed: ${err.message}` });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VISIT-BASED ROUTES (require authentication and visit context)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/transcribe/:visitId', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const visit = await queryOne('SELECT * FROM visits WHERE id = ?', [parseInt(req.params.visitId)]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });

        const lang = req.headers['accept-language'] || 'en';
        const { transcript, decisionLog } = await transcribeAudio(visit.audio_path, lang);
        const existingLog = visit.ai_decision_log ? JSON.parse(visit.ai_decision_log) : {};
        existingLog.transcription = decisionLog;

        await runSql("UPDATE visits SET transcript = ?, status = 'reviewing', ai_decision_log = ?, updated_at = NOW() WHERE id = ?",
            [JSON.stringify(transcript), JSON.stringify(existingLog), visit.id]);
        res.json({ transcript, decisionLog });
    } catch (err) { console.error('Transcription error:', err); res.status(500).json({ error: 'Transcription failed' }); }
});

router.post('/extract/:visitId', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const visit = await queryOne('SELECT * FROM visits WHERE id = ?', [parseInt(req.params.visitId)]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        const transcript = visit.transcript ? JSON.parse(visit.transcript) : null;
        if (!transcript) return res.status(400).json({ error: 'No transcript. Transcribe first.' });

        const lang = req.headers['accept-language'] || 'en';
        const { extractedData, decisionLog } = await extractMedicalData(transcript.text, lang);
        const existingLog = visit.ai_decision_log ? JSON.parse(visit.ai_decision_log) : {};
        existingLog.extraction = decisionLog;

        await runSql("UPDATE visits SET extracted_data = ?, confidence_score = ?, ai_decision_log = ?, updated_at = NOW() WHERE id = ?",
            [JSON.stringify(extractedData), parseFloat(extractedData.ConfidenceScore) || 0, JSON.stringify(existingLog), visit.id]);
        res.json({ extractedData, decisionLog });
    } catch (err) { console.error('Extraction error:', err); res.status(500).json({ error: 'Extraction failed' }); }
});

router.post('/summarize/:visitId', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const visit = await queryOne('SELECT * FROM visits WHERE id = ?', [parseInt(req.params.visitId)]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        const extractedData = visit.extracted_data ? JSON.parse(visit.extracted_data) : null;
        if (!extractedData) return res.status(400).json({ error: 'No extracted data. Run extraction first.' });

        const doctorSummary = generateDoctorSummary(extractedData);
        const patientSummary = generatePatientSummary(extractedData);

        await runSql("UPDATE visits SET doctor_summary = ?, patient_summary = ?, status = 'reviewing', updated_at = NOW() WHERE id = ?",
            [doctorSummary, patientSummary, visit.id]);
        res.json({ doctorSummary, patientSummary });
    } catch (err) { console.error('Summarize error:', err); res.status(500).json({ error: 'Summary generation failed' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AI DIAGNOSIS — Differential diagnosis with lab context
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/diagnose/:visitId', authenticateToken, async (req, res) => {
    try {
        const visitId = parseInt(req.params.visitId);
        await getDb();

        const visit = await queryOne('SELECT id FROM visits WHERE id = ?', [visitId]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });

        const lang = req.headers['accept-language'] || 'en';
        console.log(`[AI] Generating diagnosis for visit ${visitId} in language ${lang}...`);
        const { analysis, method } = await generateDiagnosis(visitId, lang);

        res.json({
            analysis,
            method,
            disclaimer: 'AI suggestions are for clinical decision support only. Final diagnosis must be made by the physician.'
        });
    } catch (err) {
        console.error('[AI] Diagnosis error:', err);
        res.status(500).json({ error: err.message || 'Diagnosis generation failed' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SOAP SUMMARIES — Generate and manage SOAP notes
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/soap/:visitId', authenticateToken, async (req, res) => {
    try {
        const visitId = parseInt(req.params.visitId);
        await getDb();

        const visit = await queryOne('SELECT id FROM visits WHERE id = ?', [visitId]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });

        const lang = req.headers['accept-language'] || 'en';
        console.log(`[AI] Generating SOAP summary for visit ${visitId} in language ${lang}...`);
        const { aiSoap, doctorSoap } = await generateSOAP(visitId, lang);

        res.json({ aiSoap, doctorSoap });
    } catch (err) {
        console.error('[AI] SOAP error:', err);
        res.status(500).json({ error: err.message || 'SOAP generation failed' });
    }
});

router.put('/soap/:visitId', authenticateToken, async (req, res) => {
    try {
        const visitId = parseInt(req.params.visitId);
        const { doctorSoap } = req.body;

        if (!doctorSoap) return res.status(400).json({ error: 'doctorSoap is required' });

        await getDb();
        const visit = await queryOne('SELECT id FROM visits WHERE id = ?', [visitId]);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });

        const result = await updateDoctorSOAP(visitId, doctorSoap);
        res.json(result);
    } catch (err) {
        console.error('[AI] SOAP update error:', err);
        res.status(500).json({ error: err.message || 'SOAP update failed' });
    }
});

module.exports = router;

