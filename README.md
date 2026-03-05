# MedBrief AI 🏥

**AI-Powered Medical Consultation Recorder & Summarizer**

MedBrief AI records doctor–patient conversations (multilingual: Malayalam, English, Hindi), transcribes them using AI, and generates structured medical visit summaries.

## Quick Start

### 1. Start Backend
```bash
cd backend
npm install
node server.js
```
Server runs at `http://localhost:5000`

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
App runs at `http://localhost:5173`

### 3. Use the App
1. Register a new account
2. Create a new consultation
3. Record or upload audio
4. Click "Start AI Analysis" to run the pipeline
5. Review transcript → View AI summary → Edit & finalize → Download PDF

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Styling | Vanilla CSS (dark medical theme) |
| Backend | Node.js + Express |
| Database | SQLite (sql.js) |
| Auth | JWT + bcrypt |
| PDF | PDFKit |
| AI | Stubbed (free, no API keys needed) |

## AI Pipeline

```
Audio → Transcription (Whisper stub) → Speaker Diarization → LLM Extraction → Structured JSON → Summary → PDF
```

> ⚕️ **Disclaimer**: AI-generated summaries require doctor verification before clinical use.

## Features

- 🎙️ Audio recording with live waveform visualization
- 📝 Multilingual transcription (EN/ML/HI code-mixed)
- 🧠 Structured medical data extraction with confidence scoring
- 💊 Prescription table, red flags, lifestyle advice
- ✏️ Editable review with digital signature
- 📄 Downloadable PDF summaries
- 🔐 JWT authentication with role-based access
- 🌙 Premium dark medical theme
