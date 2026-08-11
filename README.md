# MedBrief AI 🏥

**AI-Powered Medical Consultation Recorder & Summarizer**

MedBrief AI records doctor–patient conversations (multilingual: Malayalam, English, Hindi), transcribes them using AI, and generates structured medical visit summaries with SOAP notes, AI diagnosis, and downloadable PDFs.

> ⚕️ **Disclaimer**: AI-generated summaries require doctor verification before clinical use.

---

## Quick Start (Backend Only)

The entire app runs from the **backend** — no separate frontend build needed.

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Set up Python transcription (one-time)
cd ../ai
python -m venv venv
# Windows:
venv\Scripts\pip install faster-whisper
# Linux/Mac:
# venv/bin/pip install faster-whisper

# 3. (Optional) Install MedASR for English medical dictation
venv\Scripts\pip install -r requirements_medasr.txt

# 4. Configure environment
cd ../backend
# Edit .env with your API keys (see Environment Variables below)

# 5. Start the server
node server.js
```

**Open http://localhost:5000** in your browser — that's it! 🚀

---

## Environment Variables

Edit `backend/.env`:

```bash
# ─── Required ────────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key     # Google Gemini API key
GEMINI_MODEL=gemini-2.5-flash          # or gemini-2.0-flash

# ─── Server ──────────────────────────────────────────────────
PORT=5000

# ─── ASR Engine ──────────────────────────────────────────────
# whisper  = Faster-whisper (all languages) + Gemini medical correction
# medasr   = Google MedASR (English dictation only)
# hybrid   = Auto-detect language → route to best engine
ASR_ENGINE=whisper

# ─── Optional ────────────────────────────────────────────────
HF_TOKEN=                              # HuggingFace token (for MedASR only)
USE_OLLAMA=false                       # Enable local Ollama fallback
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2:0.5b
```

---

## Features

### Core Pipeline
- 🎙️ **Audio recording** with live waveform visualization
- 📝 **Multilingual transcription** (English, Malayalam, Hindi, code-mixed)
- 🧠 **AI medical data extraction** with confidence scoring
- 💊 **Prescription tables**, red flags, lifestyle advice, follow-up
- ✏️ **Editable review** with digital signature
- 📄 **Downloadable PDF** summaries (doctor & patient versions)
- 🔐 **JWT authentication** with bcrypt password hashing

### New Features
- 🩺 **Doctor Summary in SOAP format** (Subjective / Objective / Assessment / Plan)
- 🩻 **AI Differential Diagnosis** — generates possible conditions, suggested tests, treatments, and risk flags
- 📎 **Medical Report Upload** — upload blood work, radiology, lab reports (PDF/images)
- 🔬 **Lab Results Viewer** — parsed test values with abnormal value highlighting
- 👍 **Doctor Feedback** — rate AI recommendations (Good / Okay / Bad)
- 💊 **Gemini Medical Term Correction** — auto-fixes medicine name misspellings after transcription
- 🧬 **MedASR Support** — Google's medical-specialized speech recognition (English only)

---

## Architecture

```
Medical_App/
├── backend/                    # Node.js + Express server
│   ├── server.js               # Main entry point
│   ├── public/                 # Frontend (served by Express)
│   │   ├── index.html          # Single page app shell
│   │   ├── app.jsx             # All React components (CDN-based)
│   │   └── styles.css          # Full design system
│   ├── routes/                 # API routes
│   │   ├── auth.js             # Login / Register
│   │   ├── visits.js           # CRUD for consultations
│   │   ├── audio.js            # Audio upload
│   │   ├── ai.js               # Transcribe, Extract, Summarize, Diagnose, SOAP
│   │   ├── reports.js          # Medical report upload & parsing
│   │   ├── feedback.js         # Doctor feedback on AI
│   │   └── pdf.js              # PDF generation
│   ├── services/               # Business logic
│   │   ├── transcription.js    # Hybrid ASR pipeline (Whisper / MedASR)
│   │   ├── extraction.js       # Gemini / Ollama / regex extraction
│   │   ├── summaryFormatter.js # Doctor & patient summaries
│   │   ├── aiDiagnosis.js      # AI differential diagnosis
│   │   ├── soapGenerator.js    # SOAP note generation
│   │   ├── labReportParser.js  # PDF/image → structured lab data
│   │   └── pdfGenerator.js     # PDF export
│   ├── prompts/                # AI prompt templates
│   │   ├── extractMedicalData.txt
│   │   ├── doctorSummary.txt   # SOAP-formatted prompt
│   │   ├── patientSummary.txt
│   │   ├── aiDiagnosis.txt
│   │   └── medicalCorrection.txt
│   ├── config/db.js            # SQLite database
│   ├── middleware/              # Auth & error handling
│   └── .env                    # Environment variables
│
├── ai/                         # Python transcription scripts
│   ├── transcriber.py          # Faster-whisper (multilingual)
│   ├── medasr_transcriber.py   # Google MedASR (English medical)
│   ├── requirements.txt        # Whisper dependencies
│   ├── requirements_medasr.txt # MedASR dependencies
│   └── venv/                   # Python virtual environment
│
└── frontend/                   # (Legacy Vite app — not used in production)
```

---

## AI Pipeline

```
🎙️ Audio Recording
     ↓
📝 Transcription (Whisper / MedASR)
     ↓
💊 Gemini Medical Term Correction
     ↓
🧠 AI Data Extraction (Gemini → Ollama → Regex fallback)
     ↓
┌─────────────────────────────────────────────┐
│  📋 Structured Data (symptoms, meds, etc.)  │
│  🩺 Doctor Summary (SOAP format)            │
│  🧑 Patient-Friendly Summary                │
│  🩻 AI Differential Diagnosis               │
│  🔬 Lab Results (from uploaded reports)      │
│  📄 Downloadable PDF                        │
└─────────────────────────────────────────────┘
```

---

## ASR Engine Options

| Engine | Languages | Best For | Requirements |
|--------|-----------|----------|-------------|
| `whisper` (default) | EN, HI, ML, mixed | General consultations | Python + faster-whisper |
| `medasr` | English only | English dictation, radiology reports | Python + transformers + HF_TOKEN |
| `hybrid` | All | Auto-routes: EN→MedASR, other→Whisper | Both of the above |

Set in `.env` → `ASR_ENGINE=whisper`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (CDN, Babel in-browser) |
| Styling | Vanilla CSS (dark medical theme) |
| Backend | Node.js + Express |
| Database | SQLite (sql.js, file-based) |
| Auth | JWT + bcryptjs |
| AI - Extraction | Google Gemini Flash 2.5 |
| AI - Transcription | Faster-Whisper (CPU, int8) |
| AI - Medical ASR | Google MedASR (optional) |
| Report Parsing | pdf-parse + Tesseract.js OCR |
| PDF Export | PDFKit |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new doctor |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/visits` | List all visits |
| POST | `/api/visits` | Create new visit |
| GET | `/api/visits/:id` | Get visit details |
| POST | `/api/audio/upload` | Upload audio file |
| POST | `/api/ai/transcribe/:visitId` | Transcribe audio |
| POST | `/api/ai/extract/:visitId` | Extract medical data |
| POST | `/api/ai/summarize/:visitId` | Generate summaries (SOAP) |
| POST | `/api/ai/diagnose/:visitId` | AI differential diagnosis |
| POST | `/api/ai/soap/:visitId` | Generate SOAP notes |
| POST | `/api/reports/upload/:visitId` | Upload medical report |
| GET | `/api/reports/visit/:visitId` | Get reports for a visit |
| DELETE | `/api/reports/:reportId` | Delete a report |
| POST | `/api/ai-feedback` | Submit doctor feedback |
| GET | `/api/ai-feedback/:visitId` | Get feedback for a visit |
| GET | `/api/pdf/doctor/:visitId` | Download doctor PDF |
| GET | `/api/pdf/patient/:visitId` | Download patient PDF |
| GET | `/api/health` | Health check |

---

## Usage Guide

### 1. Register & Login
Open `http://localhost:5000`, create an account on the login page.

### 2. New Consultation
- Fill in patient name and visit date
- Record audio or upload an audio file
- Optionally upload medical reports (blood work, X-rays, etc.)
- Click **"Start AI Analysis"** to run the full pipeline

### 3. AI Summary (5 Tabs)
| Tab | What It Shows |
|-----|--------------|
| 📋 Structured Data | Extracted symptoms, prescriptions, tests, red flags |
| 🩺 Doctor Summary (SOAP) | SOAP-formatted clinical summary |
| 🧑 Patient Summary | Simple, patient-friendly summary |
| 🔬 Lab Results | Parsed lab values from uploaded reports |
| 🩻 AI Diagnosis | Differential diagnosis, suggested tests, treatments |

### 4. Review & Export
- Edit the extracted data
- Add digital signature
- Download PDF (doctor version or patient version)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `EADDRINUSE: port 5000` | Kill the old process: `Get-NetTCPConnection -LocalPort 5000 \| % { Stop-Process -Id $_.OwningProcess -Force }` |
| PDF upload fails | Ensure `pdf-parse` is installed: `npm install` in backend |
| Transcription fails | Check Python venv: `ai/venv/Scripts/python transcriber.py --test` |
| MedASR not loading | Accept license at huggingface.co/google/medasr and set `HF_TOKEN` in `.env` |
| Old UI showing | Hard refresh: `Ctrl+F5` in browser |

---

## License

This project is for educational and research purposes. AI-generated medical content must always be verified by a licensed medical professional.
