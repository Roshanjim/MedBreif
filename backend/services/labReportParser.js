/**
 * Lab Report Parser Service
 *
 * Extracts text from uploaded medical reports (PDF or image) and
 * parses structured lab values using regex patterns.
 *
 * No AI is called — purely local text extraction + pattern matching.
 */

const fs = require('fs');
const path = require('path');

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Parse a medical report file and return structured lab data.
 * @param {string} filePath  — absolute path to the uploaded file
 * @param {string} mimeType  — MIME type of the file
 * @returns {Promise<{rawText: string, parsed: object}>}
 */
async function parseReport(filePath, mimeType) {
    let rawText = '';

    if (mimeType === 'application/pdf') {
        rawText = await extractTextFromPDF(filePath);
        // If PDF extraction yields very little text, it may be a scanned PDF — try OCR
        if (rawText.trim().length < 50) {
            console.log('[LabParser] PDF text too short, attempting OCR...');
            rawText = await extractTextFromImage(filePath);
        }
    } else if (mimeType.startsWith('image/')) {
        rawText = await extractTextFromImage(filePath);
    } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    const parsed = parseLabValues(rawText);
    return { rawText, parsed };
}

// ─── Text Extraction ─────────────────────────────────────────────────────────

async function extractTextFromPDF(filePath) {
    try {
        const { PDFParse } = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const data = await PDFParse(buffer);
        return data.text || '';
    } catch (err) {
        console.error('[LabParser] PDF parse failed:', err.message);
        return '';
    }
}

async function extractTextFromImage(filePath) {
    try {
        // Tesseract can only handle image files, not PDFs
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            console.log('[LabParser] Skipping OCR — Tesseract cannot process PDF files directly');
            return '';
        }
        const Tesseract = require('tesseract.js');
        const { data } = await Tesseract.recognize(filePath, 'eng', {
            logger: () => { },   // silence progress logs
        });
        return data.text || '';
    } catch (err) {
        console.error('[LabParser] OCR failed:', err.message);
        return '';
    }
}

// ─── Lab Value Parsing (Regex) ───────────────────────────────────────────────

function parseLabValues(rawText) {
    const text = rawText || '';
    const lines = text.split(/\n/);

    const result = {
        reportType: detectReportType(text),
        date: extractReportDate(text),
        patientName: extractReportPatientName(text),
        testResults: [],
    };

    // ── Known test patterns ──
    // Format: { name, aliases (regex), unit, referenceRange }
    const knownTests = [
        { name: 'Hemoglobin', pattern: /hemoglobin|hgb|hb\b/i, unit: 'g/dL', ref: '12.0-17.5' },
        { name: 'WBC', pattern: /wbc|white\s*blood\s*cell|total\s*leucocyte/i, unit: 'cells/mcL', ref: '4000-11000' },
        { name: 'RBC', pattern: /rbc|red\s*blood\s*cell|total\s*erythrocyte/i, unit: 'million/mcL', ref: '4.5-5.5' },
        { name: 'Platelet Count', pattern: /platelet|plt\b/i, unit: 'lakhs/mcL', ref: '1.5-4.0' },
        { name: 'Hematocrit', pattern: /hematocrit|hct|pcv/i, unit: '%', ref: '36-54' },
        { name: 'MCV', pattern: /\bmcv\b|mean\s*corpuscular\s*volume/i, unit: 'fL', ref: '80-100' },
        { name: 'MCH', pattern: /\bmch\b(?!c)|mean\s*corpuscular\s*hemo(?!.*conc)/i, unit: 'pg', ref: '27-33' },
        { name: 'MCHC', pattern: /\bmchc\b|mean\s*corpuscular\s*hemo.*conc/i, unit: 'g/dL', ref: '32-36' },
        { name: 'ESR', pattern: /\besr\b|erythrocyte\s*sedimentation/i, unit: 'mm/hr', ref: '0-20' },
        { name: 'CRP', pattern: /\bcrp\b|c[- ]reactive\s*protein/i, unit: 'mg/L', ref: '0-5' },
        // Blood Sugar
        { name: 'Fasting Blood Sugar', pattern: /fasting\s*(blood\s*)?(sugar|glucose)|fbs\b/i, unit: 'mg/dL', ref: '70-100' },
        { name: 'Post Prandial Blood Sugar', pattern: /post\s*prandial|ppbs|pp\s*sugar|pp\s*glucose/i, unit: 'mg/dL', ref: '70-140' },
        { name: 'Random Blood Sugar', pattern: /random\s*(blood\s*)?(sugar|glucose)|rbs\b/i, unit: 'mg/dL', ref: '70-140' },
        { name: 'HbA1c', pattern: /hba1c|glycated\s*hemo|glycosylated/i, unit: '%', ref: '4.0-5.6' },
        // Lipid Profile
        { name: 'Total Cholesterol', pattern: /total\s*cholesterol/i, unit: 'mg/dL', ref: '<200' },
        { name: 'HDL Cholesterol', pattern: /hdl/i, unit: 'mg/dL', ref: '>40' },
        { name: 'LDL Cholesterol', pattern: /ldl/i, unit: 'mg/dL', ref: '<100' },
        { name: 'Triglycerides', pattern: /triglyceride/i, unit: 'mg/dL', ref: '<150' },
        { name: 'VLDL', pattern: /\bvldl\b/i, unit: 'mg/dL', ref: '5-40' },
        // Liver Function
        { name: 'SGOT (AST)', pattern: /sgot|ast\b|aspartate\s*amino/i, unit: 'U/L', ref: '5-40' },
        { name: 'SGPT (ALT)', pattern: /sgpt|alt\b|alanine\s*amino/i, unit: 'U/L', ref: '7-56' },
        { name: 'Alkaline Phosphatase', pattern: /alkaline\s*phosphatase|alp\b/i, unit: 'U/L', ref: '44-147' },
        { name: 'Total Bilirubin', pattern: /total\s*bilirubin/i, unit: 'mg/dL', ref: '0.1-1.2' },
        { name: 'Direct Bilirubin', pattern: /direct\s*bilirubin/i, unit: 'mg/dL', ref: '0.0-0.3' },
        { name: 'Total Protein', pattern: /total\s*protein/i, unit: 'g/dL', ref: '6.0-8.3' },
        { name: 'Albumin', pattern: /\balbumin\b/i, unit: 'g/dL', ref: '3.5-5.5' },
        { name: 'Globulin', pattern: /\bglobulin\b/i, unit: 'g/dL', ref: '2.0-3.5' },
        // Kidney Function
        { name: 'Creatinine', pattern: /creatinine/i, unit: 'mg/dL', ref: '0.7-1.3' },
        { name: 'Blood Urea', pattern: /blood\s*urea(?!\s*nitrogen)|bun\b|urea\b/i, unit: 'mg/dL', ref: '7-20' },
        { name: 'Uric Acid', pattern: /uric\s*acid/i, unit: 'mg/dL', ref: '3.5-7.2' },
        { name: 'Sodium', pattern: /\bsodium\b|\bna\+/i, unit: 'mEq/L', ref: '136-145' },
        { name: 'Potassium', pattern: /\bpotassium\b|\bk\+/i, unit: 'mEq/L', ref: '3.5-5.0' },
        { name: 'Chloride', pattern: /\bchloride\b|\bcl\b/i, unit: 'mEq/L', ref: '98-106' },
        // Thyroid
        { name: 'TSH', pattern: /\btsh\b|thyroid\s*stimulating/i, unit: 'mIU/L', ref: '0.4-4.0' },
        { name: 'T3', pattern: /\bt3\b|triiodothyronine/i, unit: 'ng/dL', ref: '80-200' },
        { name: 'T4', pattern: /\bt4\b(?!\s*gpu)|thyroxine/i, unit: 'mcg/dL', ref: '5.0-12.0' },
        { name: 'Free T3', pattern: /free\s*t3/i, unit: 'pg/mL', ref: '2.0-4.4' },
        { name: 'Free T4', pattern: /free\s*t4/i, unit: 'ng/dL', ref: '0.8-1.8' },
        // Iron Studies
        { name: 'Serum Iron', pattern: /serum\s*iron/i, unit: 'mcg/dL', ref: '60-170' },
        { name: 'Ferritin', pattern: /ferritin/i, unit: 'ng/mL', ref: '12-300' },
        { name: 'TIBC', pattern: /\btibc\b|total\s*iron\s*binding/i, unit: 'mcg/dL', ref: '250-370' },
        // Vitamins
        { name: 'Vitamin D', pattern: /vitamin\s*d|25.*hydroxy/i, unit: 'ng/mL', ref: '30-100' },
        { name: 'Vitamin B12', pattern: /vitamin\s*b12|cobalamin/i, unit: 'pg/mL', ref: '200-900' },
        // Urine
        { name: 'Urine pH', pattern: /urine.*ph|ph.*urine/i, unit: '', ref: '4.5-8.0' },
        { name: 'Urine Specific Gravity', pattern: /specific\s*gravity/i, unit: '', ref: '1.005-1.030' },
    ];

    // For each line, try to match a known test and extract the numeric value
    for (const line of lines) {
        for (const test of knownTests) {
            if (test.pattern.test(line)) {
                // Try to extract a numeric value near the test name
                const valueMatch = line.match(/(\d+\.?\d*)\s*/);
                if (valueMatch) {
                    const value = valueMatch[1];
                    // Try to extract unit from line if present, else use default
                    const extractedUnit = extractUnit(line, value) || test.unit;
                    // Try to extract reference range from line if present
                    const extractedRef = extractReferenceRange(line) || test.ref;

                    // Avoid duplicates
                    if (!result.testResults.some(t => t.testName === test.name)) {
                        result.testResults.push({
                            testName: test.name,
                            value: value,
                            unit: extractedUnit,
                            referenceRange: extractedRef,
                            flag: calculateFlag(value, extractedRef),
                        });
                    }
                }
                break; // move to next line after first match
            }
        }
    }

    // If no structured results found, try generic pattern matching
    if (result.testResults.length === 0) {
        result.testResults = genericExtraction(text);
    }

    return result;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function detectReportType(text) {
    const lower = text.toLowerCase();
    if (/complete\s*blood\s*count|cbc|hemogram/i.test(lower)) return 'Complete Blood Count (CBC)';
    if (/lipid\s*profile/i.test(lower)) return 'Lipid Profile';
    if (/liver\s*function|lft\b/i.test(lower)) return 'Liver Function Test (LFT)';
    if (/kidney\s*function|kft\b|renal\s*function|rft\b/i.test(lower)) return 'Kidney Function Test (KFT)';
    if (/thyroid\s*profile|thyroid\s*function/i.test(lower)) return 'Thyroid Profile';
    if (/urine\s*routine|urine\s*analysis/i.test(lower)) return 'Urine Routine';
    if (/blood\s*sugar|glucose|hba1c|diabetic/i.test(lower)) return 'Blood Sugar';
    if (/iron\s*stud|ferritin|tibc/i.test(lower)) return 'Iron Studies';
    if (/vitamin/i.test(lower)) return 'Vitamin Panel';
    if (/x[\s-]?ray|radiograph/i.test(lower)) return 'X-Ray Report';
    if (/ct\s*scan|computed\s*tomography/i.test(lower)) return 'CT Scan Report';
    if (/mri|magnetic\s*resonance/i.test(lower)) return 'MRI Report';
    if (/ultrasound|usg|sonography/i.test(lower)) return 'Ultrasound Report';
    return 'Lab Report';
}

function extractReportDate(text) {
    // Try common date formats
    const patterns = [
        /(?:date|collected|reported|sample)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
        /(\d{4}-\d{2}-\d{2})/,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1];
    }
    return new Date().toISOString().split('T')[0];
}

function extractReportPatientName(text) {
    const patterns = [
        /(?:patient\s*name|name\s*of\s*patient|patient)[\s:]+([A-Za-z\s\.]+?)(?:\n|,|age|sex|gender|ref|id|\d)/i,
        /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Za-z\s]+?)(?:\n|,|age)/i,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].trim();
    }
    return '';
}

function extractUnit(line, value) {
    // Look for common units after the value
    const afterValue = line.substring(line.indexOf(value) + value.length);
    const unitMatch = afterValue.match(/^\s*(g\/dL|mg\/dL|mg\/L|mIU\/L|mcg\/dL|ng\/mL|ng\/dL|pg\/mL|U\/L|IU\/L|%|mm\/hr|cells\/mcL|million\/mcL|lakhs\/mcL|mEq\/L|fL|pg)\b/i);
    return unitMatch ? unitMatch[1] : null;
}

function extractReferenceRange(line) {
    // Look for reference range patterns like "13-17", "< 200", "> 40", "(70 - 100)"
    const refPatterns = [
        /(?:ref|reference|normal|range)[\s:]*([<>]?\s*\d+\.?\d*\s*[-–]\s*\d+\.?\d*)/i,
        /\(\s*([<>]?\s*\d+\.?\d*\s*[-–]\s*\d+\.?\d*)\s*\)/,
        /(?:ref|reference|normal|range)[\s:]*([<>]\s*\d+\.?\d*)/i,
    ];
    for (const p of refPatterns) {
        const m = line.match(p);
        if (m) return m[1].trim();
    }
    return null;
}

function calculateFlag(value, referenceRange) {
    if (!referenceRange || !value) return 'unknown';

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'unknown';

    // Handle "< 200" or "> 40"
    if (referenceRange.startsWith('<')) {
        const limit = parseFloat(referenceRange.replace(/[<\s]/g, ''));
        return numValue < limit ? 'normal' : 'high';
    }
    if (referenceRange.startsWith('>')) {
        const limit = parseFloat(referenceRange.replace(/[>\s]/g, ''));
        return numValue > limit ? 'normal' : 'low';
    }

    // Handle "13-17" or "13 - 17"
    const rangeMatch = referenceRange.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
    if (rangeMatch) {
        const low = parseFloat(rangeMatch[1]);
        const high = parseFloat(rangeMatch[2]);
        if (numValue < low) return 'low';
        if (numValue > high) return 'high';
        return 'normal';
    }

    return 'unknown';
}

function genericExtraction(text) {
    // Try to find lines that look like: "Test Name ... value unit (reference)"
    const results = [];
    const lines = text.split(/\n/);
    const genericPattern = /^([A-Za-z][A-Za-z\s\(\)\/]{2,40}?)\s{2,}(\d+\.?\d*)\s*([\w\/\%]+)?\s*(?:[\(\[]?([\d.<>\-–\s]+)[\)\]]?)?/;

    for (const line of lines) {
        const m = line.match(genericPattern);
        if (m) {
            const testName = m[1].trim();
            // Skip headers or noise
            if (/test|name|parameter|investigation|result|unit|refer|normal|range|date|patient|doctor|lab|hospital|report/i.test(testName)) continue;
            if (testName.length < 2 || testName.length > 50) continue;

            results.push({
                testName,
                value: m[2],
                unit: m[3] || '',
                referenceRange: m[4] ? m[4].trim() : '',
                flag: m[4] ? calculateFlag(m[2], m[4].trim()) : 'unknown',
            });
        }
    }
    return results;
}

module.exports = { parseReport };
