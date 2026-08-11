/**
 * AI Diagnosis Service
 *
 * Generates differential diagnoses, suggested tests, treatment considerations,
 * and risk flags using consultation data + lab results as context.
 *
 * Uses Gemini API (primary) with heuristic fallback.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getDb, queryAll, queryOne, runSql } = require('../config/db');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'aiDiagnosis.txt');

// ─── Gemini JSON Schema for Diagnosis ────────────────────────────────────────

const DIAGNOSIS_SCHEMA = {
    type: "object",
    properties: {
        possibleConditions: {
            type: "array", items: { type: "string" },
            description: "Differential diagnoses ranked by likelihood"
        },
        suggestedTests: {
            type: "array", items: { type: "string" },
            description: "Additional tests recommended based on findings"
        },
        treatmentConsiderations: {
            type: "array", items: { type: "string" },
            description: "Treatment options and clinical considerations"
        },
        riskFlags: {
            type: "array", items: { type: "string" },
            description: "Risk warnings and red flags identified"
        }
    },
    required: ["possibleConditions", "suggestedTests", "treatmentConsiderations", "riskFlags"]
};

// ─── Main Entry ──────────────────────────────────────────────────────────────

/**
 * Generate AI diagnosis for a visit.
 * Collects all available data (transcript, extracted data, lab reports)
 * and sends to Gemini for analysis.
 *
 * @param {number} visitId
 * @returns {Promise<{analysis: object, method: string}>}
 */
async function generateDiagnosis(visitId) {
    await getDb();

    // Gather all context
    const visit = await queryOne('SELECT * FROM visits WHERE id = ?', [visitId]);
    if (!visit) throw new Error('Visit not found');

    const extractedData = visit.extracted_data ? JSON.parse(visit.extracted_data) : null;
    const transcript = visit.transcript ? (typeof visit.transcript === 'string' ? JSON.parse(visit.transcript) : visit.transcript) : null;

    // Get lab reports for this visit (both parsed data AND raw text)
    const reports = await queryAll('SELECT parsed_data, raw_text, report_type, original_filename FROM medical_reports WHERE visit_id = ?', [visitId]);
    const labResults = reports
        .map(r => { try { return JSON.parse(r.parsed_data); } catch { return null; } })
        .filter(Boolean);

    // Collect raw report text for Gemini (full context including comments, headers, etc.)
    const rawReportTexts = reports
        .filter(r => r.raw_text && r.raw_text.trim().length > 10)
        .map(r => `--- ${r.report_type || 'Report'}: ${r.original_filename || 'Unknown'} ---\n${r.raw_text.substring(0, 3000)}`)
        .join('\n\n');

    // Build context object
    const context = {
        transcript: transcript?.text || '',
        symptoms: extractedData?.Symptoms || [],
        diagnosis: extractedData?.Diagnosis || [],
        vitals: extractedData?.VitalsRecorded || {},
        prescriptions: extractedData?.Prescriptions || [],
        testsAdvised: extractedData?.TestsAdvised || [],
        labResults: labResults.flatMap(lr => lr.testResults || []),
        redFlags: extractedData?.RedFlags || [],
        rawReportText: rawReportTexts,
    };

    let analysis;
    let method = 'heuristic';

    // Try Gemini first
    if (GEMINI_API_KEY) {
        try {
            analysis = await diagnosisWithGemini(context);
            method = `gemini (${GEMINI_MODEL})`;
        } catch (err) {
            console.warn('[Diagnosis] Gemini failed:', err.message);
            analysis = null;
        }
    }

    // Fallback to heuristic
    if (!analysis) {
        analysis = heuristicDiagnosis(context);
        method = 'heuristic';
    }

    // Store in database
    const existing = await queryOne('SELECT id FROM ai_analysis WHERE visit_id = ?', [visitId]);
    if (existing) {
        await runSql(`UPDATE ai_analysis SET possible_conditions = ?, suggested_tests = ?, treatment_considerations = ?, risk_flags = ?, context_used = ?, updated_at = NOW() WHERE visit_id = ?`, [
            JSON.stringify(analysis.possibleConditions),
            JSON.stringify(analysis.suggestedTests),
            JSON.stringify(analysis.treatmentConsiderations),
            JSON.stringify(analysis.riskFlags),
            method,
            visitId
        ]);
    } else {
        await runSql(`INSERT INTO ai_analysis (visit_id, possible_conditions, suggested_tests, treatment_considerations, risk_flags, context_used) VALUES (?, ?, ?, ?, ?, ?)`, [
            visitId,
            JSON.stringify(analysis.possibleConditions),
            JSON.stringify(analysis.suggestedTests),
            JSON.stringify(analysis.treatmentConsiderations),
            JSON.stringify(analysis.riskFlags),
            method
        ]);
    }

    return { analysis, method };
}

// ─── Gemini Diagnosis ────────────────────────────────────────────────────────

async function diagnosisWithGemini(context) {
    let promptTemplate = '';
    try {
        promptTemplate = fs.readFileSync(PROMPT_PATH, 'utf-8');
    } catch {
        promptTemplate = 'You are a clinical decision support AI. Analyze the following patient data and provide differential diagnoses, suggested tests, treatment considerations, and risk flags. Be cautious and evidence-based.';
    }

    const labSummary = context.labResults.length > 0
        ? context.labResults.map(r => `${r.testName}: ${r.value} ${r.unit || ''} (Ref: ${r.referenceRange || 'N/A'}, Status: ${r.flag || 'unknown'})`).join('\n')
        : 'No structured lab values extracted.';

    const rawReportSection = context.rawReportText
        ? `\nMEDICAL REPORTS (raw text from uploaded PDF/images):\n${context.rawReportText}`
        : '';

    const prompt = `${promptTemplate}

PATIENT DATA:
- Symptoms: ${context.symptoms.join(', ') || 'None recorded'}
- Current Diagnosis: ${context.diagnosis.join(', ') || 'None yet'}
- Vitals: ${JSON.stringify(context.vitals) || 'Not recorded'}
- Current Prescriptions: ${context.prescriptions.map(p => `${p.Medicine} ${p.Dosage}`).join(', ') || 'None'}
- Tests Already Advised: ${context.testsAdvised.join(', ') || 'None'}
- Red Flags: ${context.redFlags.join(', ') || 'None'}

PARSED LAB VALUES:
${labSummary}
${rawReportSection}

TRANSCRIPT EXCERPT (first 1000 chars):
${(context.transcript || '').substring(0, 1000)}

Analyze ALL the above data including any uploaded medical reports and lab results. Provide your assessment.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: DIAGNOSIS_SCHEMA,
            temperature: 0.2
        }
    });

    console.log(`[Diagnosis] Calling Gemini ${GEMINI_MODEL}...`);
    const result = await httpsRequest(url, body, 60000);

    if (result.statusCode !== 200) {
        let errMsg = `Gemini responded with status ${result.statusCode}`;
        try {
            const errData = JSON.parse(result.body);
            errMsg += `: ${errData.error?.message || result.body.substring(0, 200)}`;
        } catch { }
        throw new Error(errMsg);
    }

    const data = JSON.parse(result.body);
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!responseText) throw new Error('Empty response from Gemini');

    return JSON.parse(responseText);
}

// ─── Heuristic Fallback ──────────────────────────────────────────────────────

function heuristicDiagnosis(context) {
    const conditions = [];
    const suggestedTests = [];
    const treatments = [];
    const riskFlags = [];

    const symptomsLower = context.symptoms.map(s => s.toLowerCase()).join(' ');
    const labMap = {};
    for (const lr of context.labResults) {
        labMap[lr.testName?.toLowerCase() || ''] = lr;
    }

    // Anemia indicators
    const hb = labMap['hemoglobin'];
    if (hb && hb.flag === 'low') {
        conditions.push('Possible Anemia (low hemoglobin detected)');
        suggestedTests.push('Iron studies', 'Peripheral blood smear', 'Reticulocyte count');
        treatments.push('Iron supplementation if iron deficiency confirmed');
        riskFlags.push(`Low hemoglobin: ${hb.value} ${hb.unit} (Reference: ${hb.referenceRange})`);
    }

    // Thyroid issues
    const tsh = labMap['tsh'];
    if (tsh && tsh.flag === 'high') {
        conditions.push('Possible Hypothyroidism (elevated TSH)');
        suggestedTests.push('Free T4', 'Anti-TPO antibodies');
        treatments.push('Thyroid hormone replacement therapy consideration');
    }
    if (tsh && tsh.flag === 'low') {
        conditions.push('Possible Hyperthyroidism (low TSH)');
        suggestedTests.push('Free T3', 'Free T4', 'TSH receptor antibodies');
    }

    // Diabetes indicators
    const hba1c = labMap['hba1c'];
    const fbs = labMap['fasting blood sugar'];
    if ((hba1c && hba1c.flag === 'high') || (fbs && fbs.flag === 'high')) {
        conditions.push('Possible Diabetes / Pre-diabetes');
        suggestedTests.push('Fasting insulin', 'Oral glucose tolerance test');
        treatments.push('Dietary modifications', 'Blood sugar monitoring');
        riskFlags.push('Elevated blood sugar levels detected');
    }

    // Liver issues
    const sgpt = labMap['sgpt (alt)'];
    const sgot = labMap['sgot (ast)'];
    if ((sgpt && sgpt.flag === 'high') || (sgot && sgot.flag === 'high')) {
        conditions.push('Possible Liver dysfunction (elevated liver enzymes)');
        suggestedTests.push('Hepatitis panel', 'Liver ultrasound');
        riskFlags.push('Elevated liver enzymes detected');
    }

    // Kidney issues
    const creatinine = labMap['creatinine'];
    if (creatinine && creatinine.flag === 'high') {
        conditions.push('Possible Renal impairment (elevated creatinine)');
        suggestedTests.push('GFR calculation', 'Urine albumin-creatinine ratio', 'Renal ultrasound');
        riskFlags.push('Elevated creatinine suggests kidney function needs evaluation');
    }

    // Infection indicators
    const wbc = labMap['wbc'];
    const crp = labMap['crp'];
    if ((wbc && wbc.flag === 'high') || (crp && crp.flag === 'high')) {
        conditions.push('Possible Infection / Inflammation');
        suggestedTests.push('Blood culture', 'Procalcitonin');
    }

    // Symptom-based suggestions
    if (/headache|migraine/i.test(symptomsLower)) {
        if (!conditions.some(c => /anemia/i.test(c))) conditions.push('Tension headache / Migraine');
    }
    if (/chest\s*pain/i.test(symptomsLower)) {
        riskFlags.push('Chest pain requires cardiac evaluation');
        suggestedTests.push('ECG', 'Troponin levels');
    }
    if (/fever/i.test(symptomsLower) && !conditions.some(c => /infection/i.test(c))) {
        conditions.push('Febrile illness — infection to be ruled out');
        suggestedTests.push('CBC with differential', 'Blood culture');
    }

    // Defaults if nothing found
    if (conditions.length === 0) conditions.push('Insufficient data for differential diagnosis');
    if (suggestedTests.length === 0) suggestedTests.push('Complete blood count (CBC)', 'Basic metabolic panel');
    if (treatments.length === 0) treatments.push('Clinical correlation recommended');
    if (riskFlags.length === 0) riskFlags.push('No immediate red flags identified from available data');

    return {
        possibleConditions: [...new Set(conditions)],
        suggestedTests: [...new Set(suggestedTests)],
        treatmentConsiderations: [...new Set(treatments)],
        riskFlags: [...new Set(riskFlags)],
    };
}

// ─── HTTPS Helper ────────────────────────────────────────────────────────────

function httpsRequest(url, body, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            timeout: timeoutMs,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => { resolve({ statusCode: res.statusCode, body: data }); });
        });

        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout after ${timeoutMs}ms`)); });
        req.on('error', (err) => { reject(err); });
        req.write(body);
        req.end();
    });
}

module.exports = { generateDiagnosis };
