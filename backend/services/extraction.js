/**
 * Medical Data Extraction Service
 *
 * Three-tier extraction (priority order):
 *   1. Google Gemini Flash 2.0 (fast, accurate, cloud API)
 *   2. Ollama LLM (optional, local) — set USE_OLLAMA=true
 *   3. Regex/keyword parser (fallback) — zero dependencies
 *
 * Failsafe: if higher-tier fails, auto-falls back to the next tier.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── Configuration ──────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const USE_OLLAMA = (process.env.USE_OLLAMA || '').toLowerCase() === 'true';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2:0.5b';
const PROMPT_TEMPLATE_PATH = path.join(__dirname, '..', 'prompts', 'extractMedicalData.txt');

// ─── Main Entry Point ───────────────────────────────────────────────────────────

async function extractMedicalData(transcript) {
    const startTime = Date.now();
    let extractedData;
    let method = 'regex-parser';

    // Tier 1: Try Gemini Flash (fastest, most accurate)
    if (GEMINI_API_KEY) {
        try {
            console.log('[Extraction] Using Gemini Flash API...');
            extractedData = await extractWithGemini(transcript);
            method = `gemini (${GEMINI_MODEL})`;
        } catch (err) {
            console.warn('[Extraction] Gemini failed:', err.message, '— trying next method.');
            extractedData = null;
        }
    }

    // Tier 2: Try Ollama (local LLM)
    if (!extractedData && USE_OLLAMA) {
        try {
            const ollamaAvailable = await checkOllamaHealth();
            if (ollamaAvailable) {
                extractedData = await extractWithOllama(transcript);
                method = `ollama (${OLLAMA_MODEL})`;
            } else {
                console.warn('[Extraction] Ollama is not reachable.');
            }
        } catch (err) {
            console.warn('[Extraction] Ollama failed:', err.message);
        }
    }

    // Tier 3: Fallback to regex
    if (!extractedData) {
        console.log('[Extraction] Using regex parser fallback.');
        extractedData = extractWithRegex(transcript);
        if (method === 'regex-parser') method = 'regex-parser';
        else method += ' → regex-fallback';
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    const decisionLog = {
        service: 'extraction',
        model: method,
        processingTime: `${processingTime}s`,
        extractionMethod: method,
        sectionsExtracted: Object.keys(extractedData).length,
        note: method.includes('gemini')
            ? 'Extracted using Google Gemini Flash API.'
            : method.includes('ollama')
                ? 'Extracted using local Ollama LLM.'
                : 'Extracted using regex/keyword parser.'
    };

    return { extractedData, decisionLog };
}

// ─── Regex/Keyword Parser ───────────────────────────────────────────────────────

function extractWithRegex(transcript) {
    const text = (transcript || '').toString();
    const lower = text.toLowerCase();

    return {
        PatientName: extractPatientName(text),
        Date: new Date().toISOString().split('T')[0],
        Symptoms: extractSymptoms(text),
        Duration: extractDurations(text),
        Diagnosis: extractDiagnosis(text),
        Prescriptions: extractPrescriptions(text),
        TestsAdvised: extractTests(text),
        LifestyleAdvice: extractLifestyleAdvice(text),
        FollowUp: extractFollowUp(text),
        RedFlags: extractRedFlags(text),
        UnclearItems: extractUnclearItems(text),
        ConfidenceScore: calculateConfidence(text),
        VitalsRecorded: extractVitals(text)
    };
}

// ── Patient Name ──

function extractPatientName(text) {
    const patterns = [
        /(?:patient(?:\s+name)?|name)\s*(?:is|:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].trim();
    }
    return 'Not Clearly Mentioned';
}

// ── Symptoms ──

function extractSymptoms(text) {
    const symptomKeywords = [
        'headache', 'fever', 'cough', 'cold', 'pain', 'nausea', 'vomiting',
        'diarrhea', 'dizziness', 'fatigue', 'weakness', 'sore throat',
        'shortness of breath', 'chest pain', 'abdominal pain', 'back pain',
        'joint pain', 'swelling', 'rash', 'itching', 'burning sensation',
        'blurred vision', 'blurring', 'numbness', 'tingling', 'insomnia',
        'disturbed sleep', 'loss of appetite', 'weight loss', 'weight gain',
        'palpitations', 'anxiety', 'depression', 'constipation', 'bloating',
        'acidity', 'heartburn', 'sneezing', 'runny nose', 'body ache',
        'muscle pain', 'cramps', 'bleeding', 'discharge'
    ];

    const found = [];
    const sentences = text.split(/[.!?\n]+/);

    for (const sentence of sentences) {
        const lower = sentence.toLowerCase();
        for (const keyword of symptomKeywords) {
            if (lower.includes(keyword)) {
                // Get surrounding context
                const contextMatch = extractContext(sentence, keyword);
                if (contextMatch && !found.some(f => f.toLowerCase().includes(keyword))) {
                    found.push(contextMatch);
                }
            }
        }
    }
    return found.length > 0 ? found : ['No symptoms clearly identified'];
}

function extractContext(sentence, keyword) {
    const trimmed = sentence.trim();
    if (trimmed.length < 100) return trimmed;

    const idx = trimmed.toLowerCase().indexOf(keyword);
    const start = Math.max(0, idx - 40);
    const end = Math.min(trimmed.length, idx + keyword.length + 40);
    return trimmed.substring(start, end).trim();
}

// ── Duration ──

function extractDurations(text) {
    // Only match duration patterns in symptom/complaint context, not prescriptions
    const sentences = text.split(/[.!?\n]+/);
    const found = [];

    // Medicine-related words to exclude duration context from prescriptions
    const prescriptionWords = ['mg', 'ml', 'tablet', 'capsule', 'prescrib', 'medicine', 'dose', 'dosage', 'food', 'meals'];

    for (const sentence of sentences) {
        const lower = sentence.toLowerCase().trim();
        // Skip sentences that are clearly about prescriptions
        if (prescriptionWords.some(w => lower.includes(w))) continue;

        const durationMatch = lower.match(/(?:for|since|from|past|last)\s+(\d+\s*(?:day|week|month|year|hour)s?)/i);
        if (durationMatch) {
            const entry = sentence.trim();
            if (entry.length > 5 && entry.length < 120 && !found.some(f => f.toLowerCase() === entry.toLowerCase())) {
                found.push(entry);
            }
        }
    }
    return found.length > 0 ? found : ['Duration not clearly mentioned'];
}

// ── Diagnosis ──

function extractDiagnosis(text) {
    const diagnosisPatterns = [
        /(?:diagnos(?:is|ed|e)|looks?\s+like|appears?\s+to\s+be|this\s+(?:is|looks\s+like)|impression|assessment|likely|probably|consistent\s+with)\s*:?\s*(.+?)(?:\.|$)/gim,
        /(?:you\s+(?:have|may\s+have|might\s+have|seem\s+to\s+have))\s+(.+?)(?:\.|$)/gim,
    ];

    const found = [];
    for (const pattern of diagnosisPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const diagnosis = match[1].trim();
            if (diagnosis.length > 3 && diagnosis.length < 100 && !found.includes(diagnosis)) {
                found.push(diagnosis);
            }
        }
    }
    return found.length > 0 ? found : ['Diagnosis not clearly stated'];
}

// ── Prescriptions ──

function extractPrescriptions(text) {
    const prescriptions = [];

    // Pattern: Medicine Name + Dosage + Frequency + Duration
    const rxPatterns = [
        /(?:prescrib(?:ing|ed?)|take|giving|start(?:ing)?)\s+(?:you\s+)?(\w+(?:\s+\w+)?)\s+(\d+\s*mg|\d+\s*ml|\d+\s*g)\s*,?\s*(?:take\s+)?(.+?)\s+(?:for\s+)(\d+\s*(?:day|week|month)s?)/gi,
        /(\w+)\s+(\d+\s*mg|\d+\s*ml)\s*,?\s*(.+?)\s+for\s+(\d+\s*(?:day|week|month)s?)/gi,
    ];

    for (const pattern of rxPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const medicine = match[1].trim();
            // Skip common non-medicine words
            if (['take', 'get', 'also', 'and', 'the', 'your', 'one', 'two'].includes(medicine.toLowerCase())) continue;
            // Skip duplicates (same medicine name)
            if (prescriptions.some(p => p.Medicine.toLowerCase() === medicine.toLowerCase())) continue;

            prescriptions.push({
                Medicine: capitalize(medicine),
                Dosage: match[2].trim(),
                Frequency: match[3].trim(),
                Duration: match[4].trim()
            });
        }
    }

    // Fallback: look for medicine-like patterns with dosage
    if (prescriptions.length === 0) {
        const simpleRx = /([A-Z][a-z]+(?:ol|in|ide|ine|ate|one|lol|fen|pam|tin|cin|lin|xin|mab|nib)?)\s+(\d+\s*(?:mg|ml|g|mcg))/gi;
        let match;
        while ((match = simpleRx.exec(text)) !== null) {
            const medicine = match[1].trim();
            if (medicine.length >= 3 && !prescriptions.some(p => p.Medicine.toLowerCase() === medicine.toLowerCase())) {
                prescriptions.push({
                    Medicine: capitalize(medicine),
                    Dosage: match[2].trim(),
                    Frequency: extractFrequencyNearby(text, match.index),
                    Duration: extractDurationNearby(text, match.index)
                });
            }
        }
    }

    return prescriptions;
}

function extractFrequencyNearby(text, position) {
    const nearby = text.substring(position, Math.min(text.length, position + 200));
    const freqPatterns = [
        /(?:once|twice|thrice|one|two|three)\s*(?:a\s+)?(?:daily|times?\s+(?:a\s+)?day)/i,
        /(?:every|per)\s+\d+\s+hours?/i,
        /(?:morning|evening|night|before\s+(?:food|meals?)|after\s+(?:food|meals?))/i,
        /(?:bd|tds|ods|qid|bid|tid|prn|sos)/i,
    ];
    for (const p of freqPatterns) {
        const m = nearby.match(p);
        if (m) return m[0].trim();
    }
    return 'As directed';
}

function extractDurationNearby(text, position) {
    const nearby = text.substring(position, Math.min(text.length, position + 200));
    const m = nearby.match(/(?:for\s+)?(\d+\s*(?:day|week|month|year)s?)/i);
    return m ? m[1].trim() : 'As directed';
}

// ── Tests ──

function extractTests(text) {
    // Sort by length descending so multi-word tests match before single-word substrings
    const testKeywords = [
        'complete blood count', 'thyroid profile', 'lipid profile', 'blood sugar',
        'fasting sugar', 'urine test', 'urine routine', 'CT scan', 'X-ray', 'x ray',
        'blood pressure', 'liver function', 'kidney function', 'iron studies',
        'vitamin D', 'vitamin B12', 'uric acid', 'bone density', 'pulmonary function',
        'allergy test', 'stool test', 'blood work', 'blood test',
        'CBC', 'TSH', 'HbA1c', 'MRI', 'ultrasound', 'echocardiogram', 'echo',
        'ECG', 'EKG', 'LFT', 'KFT', 'RFT', 'creatinine', 'ferritin', 'ESR', 'CRP',
        'hemoglobin', 'platelet', 'PSA', 'culture', 'biopsy', 'endoscopy',
        'colonoscopy', 'mammogram', 'spirometry'
    ];

    const found = [];
    const lower = text.toLowerCase();

    for (const test of testKeywords) {
        if (lower.includes(test.toLowerCase())) {
            const formatted = capitalize(test);
            // Skip if this test is a substring of an already-found multi-word test
            if (found.some(f => f.toLowerCase().includes(test.toLowerCase()) && f.toLowerCase() !== test.toLowerCase())) {
                continue;
            }
            if (!found.some(f => f.toLowerCase() === formatted.toLowerCase())) {
                found.push(formatted);
            }
        }
    }
    return found;
}

// ── Lifestyle Advice ──

function extractLifestyleAdvice(text) {
    const advicePatterns = [
        /(?:reduce|avoid|limit|cut\s+down|stop|quit)\s+(.+?)(?:\.|,|$)/gim,
        /(?:try\s+to|should|must|need\s+to|make\s+sure\s+to)\s+(.+?)(?:\.|,|$)/gim,
        /(?:exercise|walk|yoga|meditation|sleep|rest|diet|water|hydrat)/gim,
        /(?:practice|do|start)\s+(?:some\s+)?(.+?exercises?.+?)(?:\.|,|$)/gim,
    ];

    const found = [];
    const sentences = text.split(/[.\n]+/);

    for (const sentence of sentences) {
        const lower = sentence.toLowerCase().trim();
        const isAdvice =
            /(?:reduce|avoid|limit|cut\s+down|stop|try\s+to|should|must|exercise|walk|sleep|practice|diet|drink|eat|don'?t)/i.test(lower) &&
            !lower.includes('prescrib') &&
            !lower.includes('mg') &&
            lower.length > 10 &&
            lower.length < 150;

        if (isAdvice) {
            const clean = sentence.trim();
            if (!found.some(f => f.toLowerCase() === clean.toLowerCase())) {
                found.push(clean);
            }
        }
    }
    return found;
}

// ── Follow-Up ──

function extractFollowUp(text) {
    const followUpPatterns = [
        /(?:follow[\s-]?up|come\s+back|return|revisit|next\s+visit|review)\s+(?:after|in|within)?\s*(.+?)(?:\.|$)/im,
        /(?:after|in|within)\s+(\d+\s*(?:day|week|month)s?)\s+(?:come|visit|follow|with|review)/im,
        /(?:see\s+(?:me|you|doctor|us))\s+(?:after|in)\s+(.+?)(?:\.|$)/im,
    ];

    for (const p of followUpPatterns) {
        const m = text.match(p);
        if (m) return m[0].trim();
    }
    return 'Follow-up not clearly mentioned';
}

// ── Red Flags ──

function extractRedFlags(text) {
    const found = [];
    const sentences = text.split(/[.!?\n]+/);

    for (const sentence of sentences) {
        const lower = sentence.toLowerCase().trim();
        // Only match sentences that explicitly mention emergency/warning concepts
        const isRedFlag =
            (/(?:emergency|immediately|urgent|hospital|danger|warning|red\s*flag|critical)/i.test(lower) ||
                /if\s+.*(?:severe|worse|weakness|numbness|high\s+fever|bleeding|unconscious|faint)/i.test(lower)) &&
            lower.length > 15 &&
            lower.length < 250;

        if (isRedFlag) {
            const clean = sentence.trim();
            if (!found.some(f => f.toLowerCase() === clean.toLowerCase())) {
                found.push(clean);
            }
        }
    }
    return found;
}

// ── Unclear Items ──

function extractUnclearItems(text) {
    const items = [];
    const lower = text.toLowerCase();

    if (!extractPatientName(text) || extractPatientName(text) === 'Not Clearly Mentioned') {
        items.push('Patient name not mentioned during consultation');
    }
    if (!/\b\d{1,3}\s*(?:year|yr)s?\s*(?:old|age)?\b/i.test(lower) && !/\bage\s*:?\s*\d/i.test(lower)) {
        items.push('Patient age not discussed');
    }
    if (!/(?:history|previous|earlier|before|past\s+medical|pmh|known\s+case)/i.test(lower)) {
        items.push('No previous medical history discussed');
    }
    if (!/(?:allerg)/i.test(lower)) {
        items.push('Allergies not discussed');
    }

    return items;
}

// ── Vitals ──

function extractVitals(text) {
    const vitals = {};

    const bpMatch = text.match(/(?:BP|blood\s*pressure)\s*(?:is|:|-|=)?\s*(\d{2,3}\s*\/\s*\d{2,3})\s*(mmHg)?/i);
    if (bpMatch) vitals.BP = `${bpMatch[1].trim()} mmHg`;

    const tempMatch = text.match(/(?:temperature|temp|fever)\s*(?:is|:|-|=)?\s*(\d{2,3}(?:\.\d)?)\s*(?:°?[FC]|degree)/i);
    if (tempMatch) vitals.Temperature = tempMatch[1].trim();

    const hrMatch = text.match(/(?:heart\s*rate|pulse|HR)\s*(?:is|:|-|=)?\s*(\d{2,3})\s*(?:bpm|per\s*min)?/i);
    if (hrMatch) vitals.HeartRate = `${hrMatch[1].trim()} bpm`;

    const spo2Match = text.match(/(?:SpO2|oxygen|saturation|O2\s*sat)\s*(?:is|:|-|=)?\s*(\d{2,3})\s*%?/i);
    if (spo2Match) vitals.SpO2 = `${spo2Match[1].trim()}%`;

    const weightMatch = text.match(/(?:weight)\s*(?:is|:|-|=)?\s*(\d{2,3}(?:\.\d)?)\s*(?:kg|lbs?)?/i);
    if (weightMatch) vitals.Weight = `${weightMatch[1].trim()} kg`;

    return Object.keys(vitals).length > 0 ? vitals : null;
}

// ── Confidence Score ──

function calculateConfidence(text) {
    let score = 50; // baseline

    const symptoms = extractSymptoms(text);
    const prescriptions = extractPrescriptions(text);
    const tests = extractTests(text);
    const diagnosis = extractDiagnosis(text);

    if (symptoms.length > 0 && symptoms[0] !== 'No symptoms clearly identified') score += 10;
    if (prescriptions.length > 0) score += 15;
    if (tests.length > 0) score += 5;
    if (diagnosis.length > 0 && diagnosis[0] !== 'Diagnosis not clearly stated') score += 10;
    if (text.length > 200) score += 5;
    if (text.length > 500) score += 5;

    return `${Math.min(score, 98)}%`;
}

// ─── Gemini Flash Integration ───────────────────────────────────────────────────

const GEMINI_JSON_SCHEMA = {
    type: "object",
    properties: {
        PatientName: { type: "string", description: "Patient's name if mentioned, otherwise 'Not Clearly Mentioned'" },
        Date: { type: "string", description: "Date of consultation in YYYY-MM-DD format" },
        Symptoms: { type: "array", items: { type: "string" }, description: "List of symptoms mentioned by the patient" },
        Duration: { type: "array", items: { type: "string" }, description: "Duration of each symptom" },
        Diagnosis: { type: "array", items: { type: "string" }, description: "Doctor's diagnosis" },
        Prescriptions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    Medicine: { type: "string", description: "Correct medicine name (fix any spelling errors from speech-to-text)" },
                    Dosage: { type: "string", description: "Dosage amount" },
                    Frequency: { type: "string", description: "How often to take" },
                    Duration: { type: "string", description: "For how long" }
                },
                required: ["Medicine", "Dosage", "Frequency", "Duration"]
            },
            description: "Prescribed medications with correct spellings"
        },
        TestsAdvised: { type: "array", items: { type: "string" }, description: "Medical tests recommended" },
        LifestyleAdvice: { type: "array", items: { type: "string" }, description: "Lifestyle recommendations" },
        FollowUp: { type: "string", description: "Follow-up instructions" },
        RedFlags: { type: "array", items: { type: "string" }, description: "Emergency warning signs mentioned" },
        UnclearItems: { type: "array", items: { type: "string" }, description: "Items that were unclear or not discussed" },
        ConfidenceScore: { type: "string", description: "Confidence percentage as string like '95%'" },
        VitalsRecorded: {
            type: "object",
            properties: {
                BP: { type: "string" },
                HR: { type: "string" },
                Temperature: { type: "string" },
                SpO2: { type: "string" },
                Weight: { type: "string" }
            },
            description: "Vital signs recorded during consultation"
        }
    },
    required: ["PatientName", "Symptoms", "Diagnosis", "Prescriptions", "TestsAdvised", "FollowUp", "ConfidenceScore"]
};

async function extractWithGemini(transcript) {
    const prompt = `You are a medical data extraction assistant. You are given a TRANSCRIPT of a doctor-patient conversation.

IMPORTANT INSTRUCTIONS:
1. Extract ONLY information explicitly mentioned in the transcript. Do NOT hallucinate or add information not discussed.
2. This transcript comes from speech-to-text (Whisper), so medicine names may be MISSPELLED. Fix common errors:
   - "paracemel", "paracitamol", "parasitamol" → "Paracetamol"
   - "amoxilin", "amoxicilin" → "Amoxicillin"
   - "omeprazol", "omeprazole" → "Omeprazole"
   - "domperidon", "domparidon" → "Domperidone"
   - "cetirizin", "cetrizine" → "Cetirizine"
   - "azithromycin", "azithromicin" → "Azithromycin"
   - "metformin", "metformon" → "Metformin"
   - Fix all similar medicine name misspellings using your medical knowledge.
3. Use today's date (${new Date().toISOString().split('T')[0]}) if no date is mentioned.
4. If patient name is not mentioned, set to "Not Clearly Mentioned".
5. For UnclearItems, note any important missing info (allergies, age, medical history if not discussed).
6. Only include medicines, tests, symptoms etc. that are ACTUALLY mentioned in the transcript.
7. Do NOT add extra medicines, diagnoses, or tests that were not discussed.

TRANSCRIPT:
${transcript}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_JSON_SCHEMA,
            temperature: 0.1
        }
    });

    console.log(`[Extraction] Calling Gemini ${GEMINI_MODEL}...`);
    const result = await httpsRequest(url, body, 60000); // 60 second timeout

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

    if (!responseText) {
        throw new Error('Empty response from Gemini');
    }

    console.log(`[Extraction] Gemini response length: ${responseText.length} chars`);

    const parsed = JSON.parse(responseText);
    return normalizeExtractedData(parsed);
}

/**
 * Make an HTTPS request (for Gemini API).
 */
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
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: data });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(body);
        req.end();
    });
}

// ─── Ollama Integration (Optional) ─────────────────────────────────────────────

async function checkOllamaHealth() {
    try {
        const result = await httpRequest(`${OLLAMA_URL}/api/tags`, 'GET', null, 10000);
        return result.statusCode === 200;
    } catch {
        return false;
    }
}

async function extractWithOllama(transcript) {
    // Load the prompt template
    let promptTemplate = '';
    try {
        promptTemplate = fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf-8');
    } catch {
        promptTemplate = getDefaultPrompt();
    }

    const fullPrompt = `${promptTemplate}\n\nTranscript:\n${transcript}`;

    const body = JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: false,
        options: {
            temperature: 0.1,
            num_predict: 2048,
            top_p: 0.9,
        }
    });

    console.log(`[Extraction] Calling Ollama (${OLLAMA_MODEL})... this may take a minute on CPU.`);
    const result = await httpRequest(`${OLLAMA_URL}/api/generate`, 'POST', body, 300000); // 5 min timeout

    if (result.statusCode !== 200) {
        throw new Error(`Ollama responded with status ${result.statusCode}`);
    }

    let data;
    try {
        data = JSON.parse(result.body);
    } catch {
        throw new Error('Failed to parse Ollama response as JSON');
    }

    const responseText = data.response || '';
    console.log(`[Extraction] Ollama response length: ${responseText.length} chars`);

    // Try to parse JSON from the response
    // LLMs often wrap JSON in markdown code fences like ```json ... ```
    try {
        let cleanText = responseText;
        // Strip markdown code fences
        cleanText = cleanText.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '');
        // Find the outermost JSON object
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            // Fix common LLM JSON issues:
            // 1. Trailing commas before closing brackets/braces
            jsonStr = jsonStr.replace(/,\s*([\]\}])/g, '$1');
            // 2. Remove control characters
            jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\r' || c === '\t' ? c : '');
            // 3. Replace single quotes with double quotes (if no double quotes around values)
            jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');

            const parsed = JSON.parse(jsonStr);
            console.log('[Extraction] Successfully parsed Ollama JSON response.');
            return normalizeExtractedData(parsed);
        }
    } catch (parseErr) {
        console.warn('[Extraction] Failed to parse Ollama JSON response, falling back to regex.', parseErr.message);
    }

    // If parsing fails, fall back to regex
    return extractWithRegex(transcript);
}

function normalizeExtractedData(data) {
    return {
        PatientName: data.PatientName || 'Not Clearly Mentioned',
        Date: data.Date || new Date().toISOString().split('T')[0],
        Symptoms: Array.isArray(data.Symptoms) ? data.Symptoms : [],
        Duration: Array.isArray(data.Duration) ? data.Duration : [],
        Diagnosis: Array.isArray(data.Diagnosis) ? data.Diagnosis : [],
        Prescriptions: Array.isArray(data.Prescriptions) ? data.Prescriptions.map(p => ({
            Medicine: p.Medicine || '',
            Dosage: p.Dosage || '',
            Frequency: p.Frequency || '',
            Duration: p.Duration || ''
        })) : [],
        TestsAdvised: Array.isArray(data.TestsAdvised) ? data.TestsAdvised : [],
        LifestyleAdvice: Array.isArray(data.LifestyleAdvice) ? data.LifestyleAdvice : [],
        FollowUp: data.FollowUp || '',
        RedFlags: Array.isArray(data.RedFlags) ? data.RedFlags : [],
        UnclearItems: Array.isArray(data.UnclearItems) ? data.UnclearItems : [],
        ConfidenceScore: data.ConfidenceScore || 'N/A',
        VitalsRecorded: data.VitalsRecorded || null
    };
}

function getDefaultPrompt() {
    return `You are a medical data organizer.
Extract only explicitly mentioned information.
Do not guess.
If unclear, put under "UnclearItems".
Return JSON only.

Required JSON fields:
PatientName, Date, Symptoms[], Duration[], Diagnosis[], Prescriptions[{Medicine, Dosage, Frequency, Duration}], TestsAdvised[], LifestyleAdvice[], FollowUp, RedFlags[], UnclearItems[], ConfidenceScore`;
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getSurroundingText(text, keyword, chars) {
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) return null;
    const start = Math.max(0, idx - chars);
    const end = Math.min(text.length, idx + keyword.length + chars);
    return text.substring(start, end).trim();
}

/**
 * Make an HTTP request using Node's built-in http/https module.
 * More reliable than fetch() for local services like Ollama.
 */
function httpRequest(url, method = 'GET', body = null, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const httpModule = parsedUrl.protocol === 'https:' ? require('https') : require('http');

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            timeout: timeoutMs,
            headers: {}
        };

        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = httpModule.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: data });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request to ${url} timed out after ${timeoutMs}ms`));
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (body) req.write(body);
        req.end();
    });
}

module.exports = { extractMedicalData };

