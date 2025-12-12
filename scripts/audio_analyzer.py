#!/usr/bin/env python3
"""
Audio analysis script for MediaFlow
Provides tempo detection, key detection using pydub and basic audio analysis
Note: Using pydub/FFmpeg-based analysis as librosa has installation issues on Python 3.14
"""

import sys
import json
import numpy as np
from pathlib import Path
from pydub import AudioSegment
from pydub.utils import mediainfo


def detect_tempo(audio_path: str) -> dict:
    """
    Detect tempo (BPM) from audio file using basic analysis
    
    Args:
        audio_path: Path to audio file
        
    Returns:
        Dictionary with tempo and beats count
    """
    try:
        # Load audio file
        audio = AudioSegment.from_file(audio_path)
        
        # Convert to mono and get sample rate
        audio = audio.set_channels(1)
        sample_rate = audio.frame_rate
        duration_sec = len(audio) / 1000.0  # pydub uses milliseconds
        
        # Get raw audio data as numpy array
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        
        # Simple tempo estimation using zero-crossing rate
        # This is a simplified approach, real BPM detection is more complex
        frame_length = int(sample_rate * 0.1)  # 100ms frames
        hop_length = int(frame_length / 2)
        
        energy = []
        for i in range(0, len(samples) - frame_length, hop_length):
            frame = samples[i:i+frame_length]
            energy.append(np.sum(np.abs(frame)))
        
        # Find peaks in energy
        energy = np.array(energy)
        if len(energy) > 0:
            threshold = np.mean(energy) + np.std(energy)
            peaks = np.where(energy > threshold)[0]
            
            if len(peaks) > 1:
                # Calculate average time between peaks
                peak_times = peaks * (hop_length / sample_rate)
                intervals = np.diff(peak_times)
                if len(intervals) > 0:
                    avg_interval = np.mean(intervals)
                    tempo = 60.0 / avg_interval if avg_interval > 0 else 120.0
                    # Clamp to reasonable range
                    tempo = max(60.0, min(tempo, 200.0))
                else:
                    tempo = 120.0
            else:
                tempo = 120.0
        else:
            tempo = 120.0
        
        # Estimate beats
        beats = int((duration_sec / 60.0) * tempo)
        
        result = {
            "success": True,
            "tempo": float(tempo),
            "beats": max(1, beats),
            "confidence": 0.75  # Fixed confidence value
        }
        
        return result
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def detect_key(audio_path: str) -> dict:
    """
    Detect musical key from audio file using simple FFT analysis
    
    Args:
        audio_path: Path to audio file
        
    Returns:
        Dictionary with key and confidence
    """
    try:
        # Load audio file
        audio = AudioSegment.from_file(audio_path)
        
        # Convert to mono
        audio = audio.set_channels(1)
        sample_rate = audio.frame_rate
        
        # Get raw audio data
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        
        # Normalize
        samples = samples / (np.max(np.abs(samples)) + 1e-10)
        
        # Take first 30 seconds for analysis
        analysis_samples = min(len(samples), sample_rate * 30)
        samples = samples[:analysis_samples]
        
        # Compute FFT to get frequency distribution
        fft = np.fft.rfft(samples)
        freqs = np.fft.rfftfreq(len(samples), 1/sample_rate)
        magnitude = np.abs(fft)
        
        # Map frequencies to pitch classes (simplified chromagram)
        pitch_classes = np.zeros(12)
        for i, freq in enumerate(freqs):
            if freq > 0:
                # Convert frequency to MIDI note number
                midi_note = 69 + 12 * np.log2(freq / 440.0)
                pitch_class = int(round(midi_note)) % 12
                pitch_classes[pitch_class] += magnitude[i]
        
        # Find dominant pitch class
        dominant_pitch = np.argmax(pitch_classes)
        
        # Map to key names
        pitch_names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
        detected_key = pitch_names[dominant_pitch]
        
        # Simple major/minor heuristic based on pitch class distribution
        confidence = float(pitch_classes[dominant_pitch] / (np.sum(pitch_classes) + 1e-10))
        mode = "Major" if confidence > 0.15 else "Minor"
        
        result = {
            "success": True,
            "key": f"{detected_key} {mode}",
            "confidence": min(confidence * 5, 0.95)  # Scale confidence
        }
        
        return result
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def main():
    """
    Command-line interface for audio analysis
    Usage: python audio_analyzer.py <command> <audio_path>
    Commands: tempo, key
    """
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python audio_analyzer.py <command> <audio_path>"
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    audio_path = sys.argv[2]
    
    # Validate file exists
    if not Path(audio_path).exists():
        print(json.dumps({
            "success": False,
            "error": f"File not found: {audio_path}"
        }))
        sys.exit(1)
    
    # Execute command
    if command == "tempo":
        result = detect_tempo(audio_path)
    elif command == "key":
        result = detect_key(audio_path)
    else:
        result = {
            "success": False,
            "error": f"Unknown command: {command}. Use 'tempo' or 'key'"
        }
    
    # Output JSON result
    print(json.dumps(result, indent=2))
    
    # Exit with appropriate code
    sys.exit(0 if result.get("success", False) else 1)


if __name__ == "__main__":
    main()
