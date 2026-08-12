# MedBrief AI — Local AI Setup Guide

Complete guide to set up speech-to-text transcription and medical data extraction running fully locally on CPU.

---

## Systems Requirements

| Component | Requirement |
|-----------|------------|
| RAM | 8 GB (minimum) |
| GPU | Not required |
| Python | 3.8+ |
| Node.js | 18+ |
| OS | Windows / Linux / macOS |

## Memory Budget

| Service | RAM Usage |
|---------|----------|
| Node.js backend | ~100 MB |
| faster-whisper (small, int8) | ~1.5 GB during transcription |
| Regex extraction | ~0 MB extra |
| Ollama (optional) | ~3–4 GB if enabled |

---

## Step 1: Install Python Dependencies

```bash
# Navigate to the ai/ directory
cd ai

# Create a virtual environment (recommended)
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install faster-whisper
pip install -r requirements.txt
```

### Verify faster-whisper installation

```bash
python transcriber.py --test
```

Expected output:
```json
{"full_text": "Doctor prescribed Paracetamol 500mg...", "_test": true}
```

> **Note:** The first real transcription will download the Whisper `small` model (~460 MB). This is a one-time download.

---

## Step 2: Install Node.js Dependencies

```bash
cd backend
npm install
```

---

## Step 3: Start the Backend

```bash
cd backend
node server.js
```

You should see:
```
MedBrief AI Backend running on http://localhost:5000
```

---

## Step 4: Test the API

### Test transcription (upload audio):

```bash
curl -X POST http://localhost:5000/api/ai/transcribe-audio \
  -F "audio=@path/to/your/audio.mp3"
```

### Test summarization (send transcript text):

```bash
curl -X POST http://localhost:5000/api/ai/summarize-text \
  -H "Content-Type: application/json" \
  -d "{\"transcript\": \"Doctor prescribed Paracetamol 500mg twice daily after food for 5 days. Patient has headache for 3 days. Get a CBC test done. Follow up after one week.\"}"
```

Expected response:
```json
{
  "Symptoms": ["Patient has headache for 3 days"],
  "Diagnosis": [],
  "Prescriptions": [{
    "Medicine": "Paracetamol",
    "Dosage": "500mg",
    "Frequency": "twice daily after food",
    "Duration": "5 days"
  }],
  "TestsAdvised": ["CBC"],
  "FollowUp": "Follow up after one week",
  ...
}
```

---

## Optional: Enable Ollama (LLM-based Extraction)

If you want more intelligent extraction using a local LLM:

### Install Ollama

- **Windows**: Download from https://ollama.ai and run the installer
- **Linux**: `curl -fsSL https://ollama.ai/install.sh | sh`
- **macOS**: `brew install ollama`

### Pull a lightweight model

```bash
# Smallest option (~2 GB RAM)
ollama pull mistral:instruct

# Or even lighter
ollama pull phi3:mini
```

### Start Ollama

```bash
ollama serve
```

### Enable in MedBrief

Create `backend/.env` from the example:

```bash
cp backend/.env.example backend/.env
```

Edit `.env`:
```
USE_OLLAMA=true
OLLAMA_MODEL=mistral:instruct
```

Restart the Node.js server. The extraction service will now use Ollama when available, with automatic fallback to the regex parser if Ollama is unreachable.

---

## Architecture Overview

```
Audio File → POST /api/ai/transcribe-audio
                 ↓
         Python (faster-whisper)
         small model, CPU, int8
         task="translate" (→ English)
                 ↓
         English Transcript
                 ↓
         POST /api/ai/summarize-text
                 ↓
         Regex Parser (or Ollama)
                 ↓
         Structured JSON
         (Symptoms, Diagnosis,
          Prescriptions, Tests, etc.)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Python is not installed` | Install Python 3.8+ and ensure it's in PATH |
| `faster-whisper not found` | Run `pip install faster-whisper` in the ai/ venv |
| First transcription is slow | The Whisper model is downloading (~460 MB one-time) |
| Out of memory | Close other applications; ensure <4 GB is used by other processes |
| Ollama not connecting | Ensure `ollama serve` is running on port 11434 |
