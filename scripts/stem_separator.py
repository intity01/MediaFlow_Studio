#!/usr/bin/env python3
"""
Stem separation script for MediaFlow using Demucs
Separates audio into individual stems (vocals, drums, bass, other)
"""

import sys
import json
import os
from pathlib import Path
import shutil


def separate_stems_demucs(
    input_path: str,
    output_dir: str,
    stems: int = 4,
    model: str = "htdemucs"
) -> dict:
    """
    Separate audio into stems using Demucs
    
    Args:
        input_path: Path to input audio file
        output_dir: Directory to save separated stems
        stems: Number of stems (2 or 4)
        model: Demucs model to use
        
    Returns:
        Dictionary with success status and stem file paths
    """
    try:
        import subprocess
        
        # Validate input file
        input_file = Path(input_path)
        if not input_file.exists():
            return {
                "success": False,
                "error": f"Input file not found: {input_path}"
            }
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Determine model based on stems
        if stems == 2:
            model_name = "htdemucs"
            two_stems_arg = ["--two-stems", "vocals"]
        else:
            model_name = "htdemucs"
            two_stems_arg = []
        
        # Build demucs command
        cmd = ["demucs", "-n", model_name]
        cmd.extend(two_stems_arg)
        cmd.extend([
            "-o", str(output_path),
            str(input_file)
        ])
        
        # Run demucs
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode != 0:
            return {
                "success": False,
                "error": f"Demucs failed: {result.stderr}"
            }
        
        # Find generated stems
        # Demucs creates: output_dir/model_name/filename_without_ext/stem.wav
        stem_dir = output_path / model_name / input_file.stem
        
        if not stem_dir.exists():
            return {
                "success": False,
                "error": f"Stem directory not found: {stem_dir}"
            }
        
        # Collect stem files
        stem_files = []
        for stem_file in stem_dir.glob("*.wav"):
            stem_files.append(str(stem_file.absolute()))
        
        if len(stem_files) == 0:
            return {
                "success": False,
                "error": "No stems were generated"
            }
        
        return {
            "success": True,
            "count": len(stem_files),
            "stems": sorted(stem_files)
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Stem separation timed out (>5 minutes)"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def main():
    """
    Command-line interface for stem separation
    Usage: python stem_separator.py <input_path> <output_dir> [stems]
    """
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python stem_separator.py <input_path> <output_dir> [stems]"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    stems = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    
    # Validate stems
    if stems not in [2, 4]:
        print(json.dumps({
            "success": False,
            "error": "Stems must be 2 or 4"
        }))
        sys.exit(1)
    
    # Perform separation
    result = separate_stems_demucs(input_path, output_dir, stems)
    
    # Output JSON result
    print(json.dumps(result, indent=2))
    
    # Exit with appropriate code
    sys.exit(0 if result.get("success", False) else 1)


if __name__ == "__main__":
    main()
