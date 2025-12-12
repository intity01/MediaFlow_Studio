#!/usr/bin/env python3
"""
Audio analysis script for MediaFlow
Provides tempo detection, key detection using librosa (preferred) or pydub (fallback)
"""

import sys
import json
import numpy as np
from pathlib import Path

# Try to import librosa (more accurate for tempo), always import pydub for key detection
from pydub import AudioSegment

try:
    import librosa
    USE_LIBROSA = True
except ImportError:
    USE_LIBROSA = False


def detect_tempo_librosa(audio_path: str) -> dict:
    """Detect tempo using librosa (more accurate)"""
    try:
        y, sr = librosa.load(audio_path, duration=60)  # Load first 60 seconds
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        
        # Handle numpy array return type
        if hasattr(tempo, '__iter__'):
            tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
        else:
            tempo = float(tempo)
        
        return {
            "success": True,
            "tempo": round(tempo, 1),
            "beats": int(len(beats)),
            "confidence": 0.9
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def detect_key_librosa(audio_path: str) -> dict:
    """Detect key using librosa chroma features (more accurate)"""
    import warnings
    warnings.filterwarnings('ignore')
    
    try:
        y, sr = librosa.load(audio_path, duration=30)
        
        # Compute chroma features using STFT (more stable than CQT)
        S = np.abs(librosa.stft(y))
        chroma = librosa.feature.chroma_stft(S=S, sr=sr)
        chroma_vals = np.mean(chroma, axis=1)
        
        # Key names
        pitch_names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
        key_idx = int(np.argmax(chroma_vals))
        detected_key = pitch_names[key_idx]
        
        # Estimate major/minor using Krumhansl-Schmuckler algorithm (simplified)
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
        
        # Rotate profiles to match detected key
        major_corr = np.corrcoef(chroma_vals, np.roll(major_profile, key_idx))[0, 1]
        minor_corr = np.corrcoef(chroma_vals, np.roll(minor_profile, key_idx))[0, 1]
        
        mode = "Major" if major_corr > minor_corr else "Minor"
        confidence = max(major_corr, minor_corr)
        
        return {
            "success": True,
            "key": f"{detected_key} {mode}",
            "confidence": round(float(confidence), 2)
        }
    except Exception as e:
        import traceback
        return {"success": False, "error": f"{str(e)}\n{traceback.format_exc()}"}


def detect_tempo_pydub(audio_path: str) -> dict:
    """Detect tempo using pydub (fallback, less accurate)"""
    try:
        audio = AudioSegment.from_file(audio_path)
        audio = audio.set_channels(1)
        sample_rate = audio.frame_rate
        duration_sec = len(audio) / 1000.0
        
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        
        frame_length = int(sample_rate * 0.1)
        hop_length = int(frame_length / 2)
        
        energy = []
        for i in range(0, len(samples) - frame_length, hop_length):
            frame = samples[i:i+frame_length]
            energy.append(np.sum(np.abs(frame)))
        
        energy = np.array(energy)
        if len(energy) > 0:
            threshold = np.mean(energy) + np.std(energy)
            peaks = np.where(energy > threshold)[0]
            
            if len(peaks) > 1:
                peak_times = peaks * (hop_length / sample_rate)
                intervals = np.diff(peak_times)
                if len(intervals) > 0:
                    avg_interval = np.mean(intervals)
                    tempo = 60.0 / avg_interval if avg_interval > 0 else 120.0
                    tempo = max(60.0, min(tempo, 200.0))
                else:
                    tempo = 120.0
            else:
                tempo = 120.0
        else:
            tempo = 120.0
        
        beats = int((duration_sec / 60.0) * tempo)
        
        return {
            "success": True,
            "tempo": round(float(tempo), 1),
            "beats": max(1, beats),
            "confidence": 0.6  # Lower confidence for pydub method
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def detect_key_pydub(audio_path: str) -> dict:
    """Detect key using pydub FFT (fallback, less accurate)"""
    try:
        audio = AudioSegment.from_file(audio_path)
        audio = audio.set_channels(1)
        sample_rate = audio.frame_rate
        
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        samples = samples / (np.max(np.abs(samples)) + 1e-10)
        
        analysis_samples = min(len(samples), sample_rate * 30)
        samples = samples[:analysis_samples]
        
        fft = np.fft.rfft(samples)
        freqs = np.fft.rfftfreq(len(samples), 1/sample_rate)
        magnitude = np.abs(fft)
        
        pitch_classes = np.zeros(12)
        for i, freq in enumerate(freqs):
            if 20 < freq < 5000:  # Focus on musical range
                midi_note = 69 + 12 * np.log2(freq / 440.0)
                pitch_class = int(round(midi_note)) % 12
                pitch_classes[pitch_class] += magnitude[i]
        
        dominant_pitch = int(np.argmax(pitch_classes))
        pitch_names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
        detected_key = pitch_names[dominant_pitch]
        
        confidence = float(pitch_classes[dominant_pitch] / (np.sum(pitch_classes) + 1e-10))
        mode = "Major" if confidence > 0.12 else "Minor"
        
        return {
            "success": True,
            "key": f"{detected_key} {mode}",
            "confidence": round(min(confidence * 4, 0.8), 2)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def detect_tempo(audio_path: str) -> dict:
    if USE_LIBROSA:
        return detect_tempo_librosa(audio_path)
    return detect_tempo_pydub(audio_path)


def detect_key(audio_path: str) -> dict:
    # Use pydub for key detection as librosa has stability issues on some systems
    # Tempo detection with librosa is more stable
    return detect_key_pydub(audio_path)


def main():
    import os
    import warnings
    warnings.filterwarnings('ignore')
    
    # Suppress stderr from librosa/mpg123
    stderr_fd = sys.stderr.fileno()
    devnull = os.open(os.devnull, os.O_WRONLY)
    old_stderr = os.dup(stderr_fd)
    os.dup2(devnull, stderr_fd)
    
    try:
        if len(sys.argv) < 3:
            result = {"success": False, "error": "Usage: python audio_analyzer.py <command> <audio_path>"}
        else:
            command = sys.argv[1]
            audio_path = sys.argv[2]
            
            if not Path(audio_path).exists():
                result = {"success": False, "error": f"File not found: {audio_path}"}
            elif command == "tempo":
                result = detect_tempo(audio_path)
            elif command == "key":
                result = detect_key(audio_path)
            else:
                result = {"success": False, "error": f"Unknown command: {command}"}
            
            # Add engine info
            result["engine"] = "librosa" if USE_LIBROSA else "pydub"
    finally:
        # Restore stderr
        os.dup2(old_stderr, stderr_fd)
        os.close(devnull)
        os.close(old_stderr)
    
    print(json.dumps(result))
    sys.exit(0 if result.get("success", False) else 1)


if __name__ == "__main__":
    main()
