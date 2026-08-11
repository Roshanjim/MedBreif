/**
 * Transcription Service — Hybrid Pipeline
 *
 * Supports three ASR modes (set via ASR_ENGINE env var):
 *   1. "whisper"  — Faster-whisper translate (all languages → English) + Gemini medical correction
 *   2. "medasr"   — Google MedASR (English only, medical-optimized)
 *   3. "hybrid"   — Auto-detect language: English → MedASR, other → Whisper + Gemini correction
 *
 * Default: "whisper" (safest, supports all languages out of the box)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const WHISPER_SCRIPT = path.join(__dirname, '..', '..', 'ai', 'transcriber.py');
const MEDASR_SCRIPT = path.join(__dirname, '..', '..', 'ai', 'medasr_transcriber.py');
const CORRECTION_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'medicalCorrection.txt');
const ASR_ENGINE = (process.env.ASR_ENGINE || 'whisper').toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Transcribe an audio file using the configured ASR engine.
 *
 * @param {string} audioFilenameOrPath - filename in uploads/ or absolute path
 * @returns {Promise<{transcript: object, decisionLog: object}>}
 */
async function transcribeAudio(audioFilenameOrPath) {
    const startTime = Date.now();

    // Resolve the audio path
    let audioPath = audioFilenameOrPath;
    if (!path.isAbsolute(audioPath)) {
        audioPath = path.join(__dirname, '..', 'uploads', audioFilenameOrPath);
    }

    // Validate file exists
    if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
    }

    let result;
    let engine = ASR_ENGINE;
    let correctionApplied = false;

    try {
        if (engine === 'medasr') {
            // Pure MedASR mode — English dictation only
            result = await runMedASR(audioPath);
        } else if (engine === 'hybrid') {
            // Auto-detect language, route accordingly
            result = await runHybridPipeline(audioPath);
            correctionApplied = result._corrected || false;
            engine = result._engine || 'hybrid';
        } else {
            // Default: Whisper translate + Gemini correction
            result = await runWhisperTranslate(audioPath);
            // Apply Gemini medical correction
            if (result.full_text && GEMINI_API_KEY) {
                try {
                    const corrected = await correctMedicalTerms(result.full_text);
                    if (corrected && corrected.length > 10) {
                        result._originalText = result.full_text;
                        result.full_text = corrected;
                        correctionApplied = true;
                    }
                } catch (err) {
                    console.warn('[Transcription] Gemini correction failed, using raw text:', err.message);
                }
            }
        }

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        const transcript = {
            text: result.full_text,
            language: result.language || 'unknown',
            duration: result.duration ? `${Math.floor(result.duration / 60)}m ${Math.round(result.duration % 60)}s` : 'unknown',
            confidence: result.language_probability || 0.0,
        };

        const decisionLog = {
            service: 'transcription',
            engine: engine,
            model: result.model || (engine === 'medasr' ? 'google/medasr' : 'faster-whisper-small'),
            processingTime: `${processingTime}s`,
            pythonProcessingTime: `${result.processing_time}s`,
            languageDetected: result.language || 'unknown',
            languageProbability: result.language_probability || 0,
            medicalCorrectionApplied: correctionApplied,
            note: buildNote(engine, correctionApplied, result.language),
        };

        return { transcript, decisionLog };
    } catch (err) {
        console.error('[Transcription] Failed:', err.message);
        throw new Error(`Transcription failed: ${err.message}`);
    }
}

// ─── Hybrid Pipeline ─────────────────────────────────────────────────────────

async function runHybridPipeline(audioPath) {
    console.log('[Transcription] Hybrid mode — detecting language...');

    // Step 1: Quick language detection via Whisper
    let detectedLang = 'unknown';
    try {
        const langResult = await runPythonScript(WHISPER_SCRIPT, ['--detect-language', audioPath], 120000);
        detectedLang = langResult.language || 'unknown';
        console.log(`[Transcription] Detected language: ${detectedLang} (${(langResult.language_probability * 100).toFixed(1)}% confidence)`);
    } catch (err) {
        console.warn('[Transcription] Language detection failed, falling back to Whisper:', err.message);
        detectedLang = 'unknown';
    }

    // Step 2: Route based on language
    if (detectedLang === 'en') {
        // English → try MedASR for medical accuracy
        console.log('[Transcription] English detected → using MedASR');
        try {
            const result = await runMedASR(audioPath);
            result._engine = 'medasr (auto-routed)';
            return result;
        } catch (err) {
            console.warn('[Transcription] MedASR failed, falling back to Whisper:', err.message);
        }
    }

    // Non-English or MedASR failed → Whisper translate + Gemini correction
    console.log(`[Transcription] ${detectedLang !== 'en' ? detectedLang + ' detected → ' : ''}using Whisper translate + Gemini correction`);
    const result = await runWhisperTranslate(audioPath);

    // Apply Gemini medical correction
    if (result.full_text && GEMINI_API_KEY) {
        try {
            const corrected = await correctMedicalTerms(result.full_text);
            if (corrected && corrected.length > 10) {
                result._originalText = result.full_text;
                result.full_text = corrected;
                result._corrected = true;
            }
        } catch (err) {
            console.warn('[Transcription] Gemini correction failed:', err.message);
        }
    }

    result._engine = `whisper+gemini (auto-routed from ${detectedLang})`;
    return result;
}

// ─── ASR Engines ─────────────────────────────────────────────────────────────

async function runWhisperTranslate(audioPath) {
    if (!fs.existsSync(WHISPER_SCRIPT)) {
        throw new Error(`Whisper transcriber not found at: ${WHISPER_SCRIPT}. Run setup first.`);
    }
    return runPythonScript(WHISPER_SCRIPT, [audioPath], 600000);
}

async function runMedASR(audioPath) {
    if (!fs.existsSync(MEDASR_SCRIPT)) {
        throw new Error(`MedASR transcriber not found at: ${MEDASR_SCRIPT}.`);
    }
    return runPythonScript(MEDASR_SCRIPT, [audioPath], 600000);
}

// ─── Gemini Medical Term Correction ──────────────────────────────────────────

async function correctMedicalTerms(rawText) {
    if (!GEMINI_API_KEY || !rawText || rawText.length < 10) return rawText;

    let promptTemplate = '';
    try {
        promptTemplate = fs.readFileSync(CORRECTION_PROMPT_PATH, 'utf-8');
    } catch {
        promptTemplate = 'You are a medical transcription corrector. Fix ONLY medical terminology errors in the following text. Return only the corrected text with no explanations.';
    }

    const prompt = `${promptTemplate}\n\nTRANSCRIPT TO CORRECT:\n${rawText}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.05,
            maxOutputTokens: 4096,
        }
    });

    console.log('[Transcription] Calling Gemini for medical term correction...');
    const result = await httpsRequest(url, body, 30000);

    if (result.statusCode !== 200) {
        throw new Error(`Gemini responded with status ${result.statusCode}`);
    }

    const data = JSON.parse(result.body);
    const correctedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[Transcription] Gemini correction complete (${correctedText.length} chars)`);

    return correctedText.trim();
}

// ─── Python Process Runner ───────────────────────────────────────────────────

function runPythonScript(scriptPath, args, timeoutMs = 600000) {
    return new Promise((resolve, reject) => {
        const aiDir = path.join(__dirname, '..', '..', 'ai');
        const venvPython = process.platform === 'win32'
            ? path.join(aiDir, 'venv', 'Scripts', 'python.exe')
            : path.join(aiDir, 'venv', 'bin', 'python3');
        const systemPython = process.platform === 'win32' ? 'python' : 'python3';
        const pythonCmd = fs.existsSync(venvPython) ? venvPython : systemPython;

        // Pass HF_TOKEN to child process for gated model access
        const env = { ...process.env };
        if (process.env.HF_TOKEN) {
            env.HF_TOKEN = process.env.HF_TOKEN;
        }

        const proc = spawn(pythonCmd, [scriptPath, ...args], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: timeoutMs,
            env,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error(
                    'Python is not installed or not in PATH. ' +
                    'Install Python 3.8+ and required packages.'
                ));
            } else {
                reject(new Error(`Failed to start Python process: ${err.message}`));
            }
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                const errorMsg = stderr.trim() || stdout.trim() || `Python process exited with code ${code}`;
                reject(new Error(errorMsg));
                return;
            }

            try {
                const lines = stdout.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                const result = JSON.parse(jsonLine);

                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result);
                }
            } catch (parseErr) {
                reject(new Error(`Failed to parse output: ${stdout.substring(0, 500)}`));
            }
        });
    });
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildNote(engine, correctionApplied, language) {
    if (engine.includes('medasr')) {
        return 'Medical transcription via Google MedASR (English, medical-optimized).';
    }
    if (correctionApplied) {
        return `Transcription via faster-whisper (translated from ${language || 'detected language'} → English), then corrected by Gemini for medical terminology accuracy.`;
    }
    return `Transcription via faster-whisper (translated from ${language || 'detected language'} → English).`;
}

module.exports = { transcribeAudio };
