/**
 * Transcription Service — Real Implementation
 * Calls the Python faster-whisper transcriber as a child process.
 * Falls back to a helpful error if Python/faster-whisper is not available.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TRANSCRIBER_SCRIPT = path.join(__dirname, '..', '..', 'ai', 'transcriber.py');

/**
 * Transcribe an audio file using faster-whisper via Python subprocess.
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

    // Validate Python script exists
    if (!fs.existsSync(TRANSCRIBER_SCRIPT)) {
        throw new Error(`Python transcriber not found at: ${TRANSCRIBER_SCRIPT}. Run setup first.`);
    }

    try {
        const result = await runPythonTranscriber(audioPath);
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        const transcript = {
            text: result.full_text,
            language: result.language || 'unknown',
            duration: result.duration ? `${Math.floor(result.duration / 60)}m ${Math.round(result.duration % 60)}s` : 'unknown',
            confidence: result.language_probability || 0.0
        };

        const decisionLog = {
            service: 'transcription',
            model: 'faster-whisper-small (CPU, int8)',
            processingTime: `${processingTime}s`,
            pythonProcessingTime: `${result.processing_time}s`,
            languageDetected: result.language || 'unknown',
            languageProbability: result.language_probability || 0,
            task: 'translate (all languages → English)',
            note: 'Real transcription via faster-whisper. Audio translated to English.'
        };

        return { transcript, decisionLog };
    } catch (err) {
        console.error('[Transcription] Python transcriber failed:', err.message);
        throw new Error(`Transcription failed: ${err.message}`);
    }
}

/**
 * Spawn Python process and parse JSON output.
 */
function runPythonTranscriber(audioPath) {
    return new Promise((resolve, reject) => {
        // Prefer the venv Python (where faster-whisper is installed)
        const aiDir = path.join(__dirname, '..', '..', 'ai');
        const venvPython = process.platform === 'win32'
            ? path.join(aiDir, 'venv', 'Scripts', 'python.exe')
            : path.join(aiDir, 'venv', 'bin', 'python3');
        const systemPython = process.platform === 'win32' ? 'python' : 'python3';
        const pythonCmd = require('fs').existsSync(venvPython) ? venvPython : systemPython;
        const proc = spawn(pythonCmd, [TRANSCRIBER_SCRIPT, audioPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 600000, // 10 minute timeout for long audio files
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error(
                    'Python is not installed or not in PATH. ' +
                    'Install Python 3.8+ and faster-whisper: pip install faster-whisper'
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
                // Parse the last line as JSON (in case there are warnings above)
                const lines = stdout.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                const result = JSON.parse(jsonLine);

                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result);
                }
            } catch (parseErr) {
                reject(new Error(`Failed to parse transcriber output: ${stdout.substring(0, 500)}`));
            }
        });
    });
}

module.exports = { transcribeAudio };
