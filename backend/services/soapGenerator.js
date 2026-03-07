/**
 * SOAP Summary Generator Service
 *
 * Generates SOAP (Subjective, Objective, Assessment, Plan) notes
 * from extracted consultation data and lab results.
 *
 * Produces both:
 *   - AI SOAP (auto-generated, read-only)
 *   - Doctor SOAP (initialized blank for doctor editing)
 */

const { getDb, queryAll, queryOne, runSql } = require('../config/db');

/**
 * Generate SOAP summaries for a visit.
 * @param {number} visitId
 * @returns {Promise<{aiSoap: object, doctorSoap: object}>}
 */
async function generateSOAP(visitId) {
    await getDb();

    const visit = queryOne('SELECT * FROM visits WHERE id = ?', [visitId]);
    if (!visit) throw new Error('Visit not found');

    const extractedData = visit.extracted_data ? JSON.parse(visit.extracted_data) : {};

    // Get lab reports
    const reports = queryAll('SELECT parsed_data FROM medical_reports WHERE visit_id = ?', [visitId]);
    const labResults = reports
        .map(r => { try { return JSON.parse(r.parsed_data); } catch { return null; } })
        .filter(Boolean)
        .flatMap(lr => lr.testResults || []);

    // ─── Build AI SOAP ───────────────────────────────────────────────────────

    const aiSoap = {
        Subjective: buildSubjective(extractedData),
        Objective: buildObjective(extractedData, labResults),
        Assessment: buildAssessment(extractedData),
        Plan: buildPlan(extractedData),
    };

    // ─── Doctor SOAP (blank template or existing) ────────────────────────────

    const existing = queryOne('SELECT * FROM soap_summaries WHERE visit_id = ?', [visitId]);

    let doctorSoap;
    if (existing && existing.doctor_soap) {
        doctorSoap = JSON.parse(existing.doctor_soap);
    } else {
        doctorSoap = {
            Subjective: '',
            Objective: '',
            Assessment: '',
            Plan: '',
        };
    }

    // ─── Store / Update ──────────────────────────────────────────────────────

    const aiSoapStr = JSON.stringify(aiSoap);
    const doctorSoapStr = JSON.stringify(doctorSoap);

    if (existing) {
        runSql(`UPDATE soap_summaries SET ai_soap = ?, updated_at = datetime('now') WHERE visit_id = ?`, [aiSoapStr, visitId]);
    } else {
        runSql(`INSERT INTO soap_summaries (visit_id, ai_soap, doctor_soap) VALUES (?, ?, ?)`, [visitId, aiSoapStr, doctorSoapStr]);
    }

    return { aiSoap, doctorSoap };
}

/**
 * Update the doctor's SOAP notes.
 * @param {number} visitId
 * @param {object} doctorSoap — { Subjective, Objective, Assessment, Plan }
 */
async function updateDoctorSOAP(visitId, doctorSoap) {
    await getDb();

    const existing = queryOne('SELECT id FROM soap_summaries WHERE visit_id = ?', [visitId]);
    const doctorSoapStr = JSON.stringify(doctorSoap);

    if (existing) {
        runSql(`UPDATE soap_summaries SET doctor_soap = ?, updated_at = datetime('now') WHERE visit_id = ?`, [doctorSoapStr, visitId]);
    } else {
        runSql(`INSERT INTO soap_summaries (visit_id, ai_soap, doctor_soap) VALUES (?, ?, ?)`, [visitId, '{}', doctorSoapStr]);
    }

    return { doctorSoap };
}

// ─── SOAP Builders ───────────────────────────────────────────────────────────

function buildSubjective(data) {
    const parts = [];

    if (data.PatientName && data.PatientName !== 'Not Clearly Mentioned') {
        parts.push(`Patient: ${data.PatientName}`);
    }

    if (data.Symptoms && data.Symptoms.length > 0) {
        const symptomsText = data.Symptoms
            .filter(s => s !== 'No symptoms clearly identified')
            .join('; ');
        if (symptomsText) parts.push(`Chief Complaints: ${symptomsText}`);
    }

    if (data.Duration && data.Duration.length > 0) {
        const durText = data.Duration
            .filter(d => d !== 'Duration not clearly mentioned')
            .join('; ');
        if (durText) parts.push(`Duration: ${durText}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'No subjective findings recorded.';
}

function buildObjective(data, labResults) {
    const parts = [];

    // Vitals
    if (data.VitalsRecorded && Object.keys(data.VitalsRecorded).length > 0) {
        const vitals = Object.entries(data.VitalsRecorded)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
        parts.push(`Vitals: ${vitals}`);
    }

    // Lab results
    if (labResults && labResults.length > 0) {
        parts.push('Lab Results:');
        for (const lr of labResults) {
            const flag = lr.flag && lr.flag !== 'normal' && lr.flag !== 'unknown'
                ? ` [${lr.flag.toUpperCase()}]` : '';
            parts.push(`  • ${lr.testName}: ${lr.value} ${lr.unit || ''}${flag} (Ref: ${lr.referenceRange || 'N/A'})`);
        }
    }

    return parts.length > 0 ? parts.join('\n') : 'No objective findings recorded.';
}

function buildAssessment(data) {
    const parts = [];

    if (data.Diagnosis && data.Diagnosis.length > 0) {
        const dx = data.Diagnosis.filter(d => d !== 'Diagnosis not clearly stated');
        if (dx.length > 0) {
            parts.push(`Diagnosis: ${dx.join('; ')}`);
        }
    }

    if (data.ConfidenceScore) {
        parts.push(`AI Confidence: ${data.ConfidenceScore}`);
    }

    if (data.RedFlags && data.RedFlags.length > 0) {
        parts.push(`Red Flags: ${data.RedFlags.join('; ')}`);
    }

    if (data.UnclearItems && data.UnclearItems.length > 0) {
        parts.push(`Unclear Items: ${data.UnclearItems.join('; ')}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'Assessment pending.';
}

function buildPlan(data) {
    const parts = [];

    // Medications
    if (data.Prescriptions && data.Prescriptions.length > 0) {
        parts.push('Medications:');
        data.Prescriptions.forEach((p, i) => {
            parts.push(`  ${i + 1}. ${p.Medicine} ${p.Dosage} — ${p.Frequency} for ${p.Duration}`);
        });
    }

    // Tests
    if (data.TestsAdvised && data.TestsAdvised.length > 0) {
        parts.push(`Tests Ordered: ${data.TestsAdvised.join(', ')}`);
    }

    // Lifestyle
    if (data.LifestyleAdvice && data.LifestyleAdvice.length > 0) {
        parts.push(`Lifestyle: ${data.LifestyleAdvice.join('; ')}`);
    }

    // Follow-up
    if (data.FollowUp && data.FollowUp !== 'Follow-up not clearly mentioned') {
        parts.push(`Follow-up: ${data.FollowUp}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'Plan pending.';
}

module.exports = { generateSOAP, updateDoctorSOAP };
