#!/usr/bin/env python3
"""
Dependency checker for MediaFlow audio processing features
Checks if all required dependencies are installed and accessible
"""

import subprocess
import sys
import importlib.util
from pathlib import Path


def check_command(command: str) -> tuple[bool, str]:
    """Check if a command-line tool is available"""
    try:
        result = subprocess.run(
            [command, "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version = result.stdout.strip().split('\n')[0]
            return True, version
        return False, "Command found but version check failed"
    except FileNotFoundError:
        return False, "Not found in PATH"
    except subprocess.TimeoutExpired:
        return False, "Timeout"
    except Exception as e:
        return False, str(e)


def check_python_package(package: str) -> tuple[bool, str]:
    """Check if a Python package is installed"""
    try:
        spec = importlib.util.find_spec(package)
        if spec is not None:
            module = importlib.import_module(package)
            version = getattr(module, '__version__', 'unknown version')
            return True, version
        return False, "Not installed"
    except Exception as e:
        return False, str(e)


def main():
    print("=" * 60)
    print("MediaFlow Dependency Check")
    print("=" * 60)
    print()
    
    all_ok = True
    
    # Check command-line tools
    print("Command-line Tools:")
    print("-" * 60)
    
    tools = {
        'python': 'Python',
        'yt-dlp': 'YouTube Downloader',
        'ffmpeg': 'FFmpeg (Audio Processing)',
        'demucs': 'Demucs (Stem Separation)'
    }
    
    for cmd, name in tools.items():
        status, info = check_command(cmd)
        icon = "✅" if status else "❌"
        print(f"{icon} {name:30} {info}")
        if not status and cmd in ['ffmpeg', 'demucs']:
            all_ok = False
    
    print()
    
    # Check Python packages
    print("Python Packages:")
    print("-" * 60)
    
    packages = {
        'librosa': 'Librosa (Audio Analysis)',
        'soundfile': 'SoundFile (Audio I/O)',
        'pydub': 'PyDub (Audio Manipulation)',
        'numpy': 'NumPy (Numerical Computing)',
        'scipy': 'SciPy (Scientific Computing)',
        'demucs': 'Demucs (Stem Separation)'
    }
    
    for pkg, name in packages.items():
        status, info = check_python_package(pkg)
        icon = "✅" if status else "❌"
        print(f"{icon} {name:30} {info}")
        if not status and pkg in ['librosa', 'soundfile', 'demucs']:
            all_ok = False
    
    print()
    print("=" * 60)
    
    if all_ok:
        print("✅ All required dependencies are installed!")
        print("=" * 60)
        return 0
    else:
        print("❌ Missing dependencies detected!")
        print()
        print("To install missing dependencies:")
        print()
        print("1. Install FFmpeg:")
        print("   winget install ffmpeg")
        print()
        print("2. Install Python packages:")
        print("   pip install librosa soundfile pydub numpy scipy demucs")
        print()
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
