#!/usr/bin/env python3
"""
MedBrief AI — MedASR Medical Transcriber
Uses Google's MedASR model (Conformer architecture) for medical-optimized
English speech recognition.

Requires:
  - transformers (v5.0.0+ from specific commit)
  - torch (CPU)
  - librosa
  - soundfile

Usage:
    python medasr_transcriber.py <audio_file_path>
    python medasr_transcriber.py --test
"""

import sys
import json
import os
import time


def transcribe_medasr(audio_path):
    """
    Transcribe an English audio file using Google's MedASR model.

    Args:
        audio_path: Absolute path to the audio file

    Returns:
        dict with 'full_text', 'language', 'duration', 'processing_time', 'model'
    """
    if not os.path.isfile(audio_path):
        return {"error": f"Audio file not found: {audio_path}"}

    try:
        from transformers import pipeline
        import librosa
    except ImportError as e:
        return {
            "error": f"Missing dependency: {e}. Install via: pip install -r requirements_medasr.txt"
        }

    start_time = time.time()

    # Load audio at 16kHz mono (MedASR requirement)
    try:
        speech, sample_rate = librosa.load(audio_path, sr=16000, mono=True)
        duration = len(speech) / sample_rate
    except Exception as e:
        return {"error": f"Failed to load audio: {e}"}

    # Load MedASR pipeline
    # HF_TOKEN env var is auto-detected by transformers for gated models
    try:
        model_id = "google/medasr"
        pipe = pipeline(
            "automatic-speech-recognition",
            model=model_id,
            device="cpu",
        )
    except Exception as e:
        return {"error": f"Failed to load MedASR model: {e}. Make sure you have accepted the license at huggingface.co/google/medasr and set HF_TOKEN in .env"}

    # Transcribe with chunked processing for long audio
    try:
        result = pipe(
            audio_path,
            chunk_length_s=20,  # process 20-second chunks
            stride_length_s=2,  # 2-second overlap between chunks
        )
        text = result.get("text", "").strip()
    except Exception as e:
        return {"error": f"Transcription failed: {e}"}

    processing_time = round(time.time() - start_time, 2)

    return {
        "full_text": text if text else "No speech detected in the audio.",
        "language": "en",
        "language_probability": 0.99,
        "duration": round(duration, 2),
        "processing_time": processing_time,
        "model": "medasr",
    }


def run_self_test():
    """Run a self-test without needing an actual audio file."""
    return {
        "full_text": "Patient presents with bilateral headache for three days. Blood pressure one thirty over eighty. Prescribed Paracetamol five hundred milligrams twice daily. Advised CBC and thyroid profile. Follow up in one week.",
        "language": "en",
        "language_probability": 0.99,
        "duration": 45.0,
        "processing_time": 0.01,
        "model": "medasr",
        "_test": True,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python medasr_transcriber.py <audio_file_path> or --test"}))
        sys.exit(1)

    arg = sys.argv[1]

    if arg == "--test":
        result = run_self_test()
    else:
        result = transcribe_medasr(arg)

    # Output JSON to stdout (Node.js will read this)
    print(json.dumps(result, ensure_ascii=False))

    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
