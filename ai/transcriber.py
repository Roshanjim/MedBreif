#!/usr/bin/env python3
"""
MedBrief AI — Speech-to-Text Transcriber
Uses faster-whisper (small model, CPU) with task="translate"
to convert Malayalam/Hindi/mixed speech into English text.

Usage:
    python transcriber.py <audio_file_path>
    python transcriber.py --test
"""

import sys
import json
import os
import time


def transcribe(audio_path, target_lang="en"):
    """
    Transcribe and translate an audio file to English text using faster-whisper.

    Args:
        audio_path: Absolute path to the audio file

    Returns:
        dict with 'full_text', 'language', 'duration', 'processing_time'
    """
    if not os.path.isfile(audio_path):
        return {"error": f"Audio file not found: {audio_path}"}

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return {
            "error": "faster-whisper is not installed. Run: pip install faster-whisper"
        }

    start_time = time.time()

    # Load model — small model, CPU-only, int8 quantization for low RAM usage (~1.5GB)
    model = WhisperModel(
        "small",
        device="cpu",
        compute_type="int8",
        cpu_threads=os.cpu_count() or 4,
    )

    # If target is English, translate all to English. If target is the same as the spoken language,
    # we would ideally just "transcribe". Since we don't know the spoken language perfectly, 
    # if target_lang is 'ml', we'll use task="transcribe" so it outputs the original language (e.g. Malayalam).
    task_mode = "translate" if target_lang == "en" else "transcribe"
    
    # Transcribe
    segments, info = model.transcribe(
        audio_path,
        task=task_mode,
        beam_size=3,          # lower beam size for faster CPU inference
        best_of=1,            # single candidate for speed
        vad_filter=True,      # skip silent sections
        vad_parameters=dict(
            min_silence_duration_ms=500,
        ),
    )

    # Collect all segment texts
    full_text_parts = []
    for segment in segments:
        full_text_parts.append(segment.text.strip())

    full_text = " ".join(full_text_parts).strip()
    processing_time = round(time.time() - start_time, 2)

    return {
        "full_text": full_text if full_text else "No speech detected in the audio.",
        "language": getattr(info, "language", "unknown"),
        "language_probability": round(getattr(info, "language_probability", 0), 3),
        "duration": round(getattr(info, "duration", 0), 2),
        "processing_time": processing_time,
    }


def run_self_test():
    """Run a self-test without needing an actual audio file."""
    result = {
        "full_text": "Doctor prescribed Paracetamol 500mg twice daily after food for 5 days. Patient has bilateral headache for 3 days and disturbed sleep for 1 week. Get CBC and thyroid profile done. Follow up after one week with reports.",
        "language": "en",
        "language_probability": 0.95,
        "duration": 120.0,
        "processing_time": 0.01,
        "_test": True,
    }
    return result


def detect_language(audio_path):
    """
    Quickly detect the language of an audio file without full transcription.
    Uses Whisper's language detection on the first 30 seconds.
    """
    if not os.path.isfile(audio_path):
        return {"error": f"Audio file not found: {audio_path}"}

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return {"error": "faster-whisper is not installed. Run: pip install faster-whisper"}

    start_time = time.time()

    model = WhisperModel(
        "small",
        device="cpu",
        compute_type="int8",
        cpu_threads=os.cpu_count() or 4,
    )

    # Use detect_language_multi_segment for fast detection
    _, info = model.transcribe(
        audio_path,
        task="translate",
        beam_size=1,
        best_of=1,
        vad_filter=True,
    )

    processing_time = round(time.time() - start_time, 2)

    return {
        "language": getattr(info, "language", "unknown"),
        "language_probability": round(getattr(info, "language_probability", 0), 3),
        "processing_time": processing_time,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python transcriber.py <audio_file_path> or --test"}))
        sys.exit(1)

    arg = sys.argv[1]

    if arg == "--test":
        result = run_self_test()
    elif arg == "--detect-language":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: python transcriber.py --detect-language <audio_file_path>"}))
            sys.exit(1)
        result = detect_language(sys.argv[2])
    else:
        target_lang = "en"
        # Check if --lang is provided
        if len(sys.argv) > 2 and sys.argv[2] == "--lang" and len(sys.argv) > 3:
            target_lang = sys.argv[3]
            
        result = transcribe(arg, target_lang)

    # Output JSON to stdout (Node.js will read this)
    print(json.dumps(result, ensure_ascii=False))

    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
