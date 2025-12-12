#!/usr/bin/env python3
"""
Stem separation script for MediaFlow
Uses audio-separator with UVR5/MDX-Net models
Features: GPU acceleration, Ensemble mode, De-Reverb
"""

import sys
import json
import os
from pathlib import Path


# Model mapping - organized by use case
MODEL_MAP = {
    # === VOCALS (แยกเสียงร้อง) ===
    "Kim_Vocal_2": "Kim_Vocal_2.onnx",
    
    # === INSTRUMENTAL (แยกดนตรี) ===
    "BS-Roformer-Viperx": "model_bs_roformer_ep_368_sdr_12.9628.ckpt",
    "BS-Roformer": "model_bs_roformer_ep_317_sdr_12.9755.ckpt",
    
    # === BALANCED (สมดุล) ===
    "MDX23C": "MDX23C-8KFFT-InstVoc_HQ.ckpt",
    
    # === FAST (เร็ว) ===
    "UVR-MDX-NET-Inst_HQ_4": "UVR-MDX-NET-Inst_HQ_4.onnx",
    "UVR-MDX-NET-Inst_HQ_3": "UVR-MDX-NET-Inst_HQ_3.onnx",
    
    # === DE-REVERB (ลบเสียงก้อง) ===
    "UVR-DeEcho-DeReverb": "UVR-DeEcho-DeReverb.pth",
    
    # === 4/6 STEMS ===
    "htdemucs_ft": "htdemucs_ft.yaml",
    "htdemucs": "htdemucs.yaml",
    "htdemucs_6s": "htdemucs_6s.yaml",
}


def get_vram_gb():
    """Get available VRAM in GB"""
    try:
        import torch
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            return props.total_memory / (1024**3)
    except:
        pass
    return 0


def get_optimal_batch_size():
    """Get optimal batch size based on VRAM"""
    vram = get_vram_gb()
    if vram >= 8:
        return 4
    elif vram >= 6:
        return 2
    elif vram >= 4:
        return 1
    return 1  # CPU or low VRAM


def separate_single(separator, input_path: str, model_name: str) -> list:
    """Run single model separation"""
    separator.load_model(model_name)
    return separator.separate(input_path)


def separate_with_audio_separator(input_path: str, output_dir: str, stems: int, model: str = "MDX23C") -> dict:
    """Separate using audio-separator"""
    try:
        from audio_separator.separator import Separator
        
        input_file = Path(input_path)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        model_name = MODEL_MAP.get(model, "MDX23C-8KFFT-InstVoc_HQ.ckpt")
        batch_size = get_optimal_batch_size()
        vram = get_vram_gb()
        
        print(f"[stem_separator] Model: {model_name}", file=sys.stderr)
        print(f"[stem_separator] VRAM: {vram:.1f}GB, Batch: {batch_size}", file=sys.stderr)
        
        # Configure based on model type
        mdxc_params = {"batch_size": batch_size, "segment_size": 256}
        mdx_params = {"batch_size": batch_size}
        
        separator = Separator(
            output_dir=str(output_path),
            output_format="wav",
            mdxc_params=mdxc_params,
            mdx_params=mdx_params,
        )
        
        # Load and separate
        separator.load_model(model_name)
        output_files = separator.separate(str(input_file))
        
        if not output_files:
            return {"success": False, "error": "No stems generated"}
        
        # Collect output files
        stem_files = []
        for f in output_files:
            p = Path(f)
            if p.exists():
                stem_files.append(str(p.absolute()))
            else:
                p2 = output_path / p.name
                if p2.exists():
                    stem_files.append(str(p2.absolute()))
        
        if not stem_files:
            return {"success": False, "error": "Output files not found"}
        
        return {
            "success": True,
            "count": len(stem_files),
            "stems": sorted(stem_files),
            "engine": "audio-separator",
            "model": model,
            "vram_gb": round(vram, 1),
            "batch_size": batch_size
        }
        
    except Exception as e:
        error_msg = str(e)
        # Handle common errors
        if "out of memory" in error_msg.lower():
            return {"success": False, "error": "GPU out of memory. Try a smaller model like UVR-MDX-NET-Inst_HQ_4"}
        if "not installed" in error_msg.lower():
            return {"success": False, "error": "audio-separator not installed. Run: py -3.11 -m pip install audio-separator"}
        return {"success": False, "error": error_msg}


def separate_with_ffmpeg(input_path: str, output_dir: str, stems: int) -> dict:
    """Fallback: Basic FFmpeg separation"""
    import subprocess
    
    try:
        input_file = Path(input_path)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        stem_files = []
        base_name = input_file.stem
        
        if stems == 2:
            vocals = output_path / f"{base_name}_vocals.wav"
            inst = output_path / f"{base_name}_instrumental.wav"
            
            subprocess.run(["ffmpeg", "-y", "-i", str(input_file), "-af", "pan=mono|c0=0.5*c0+0.5*c1", str(vocals)], capture_output=True, timeout=120)
            subprocess.run(["ffmpeg", "-y", "-i", str(input_file), "-af", "pan=stereo|c0=c0-c1|c1=c1-c0", str(inst)], capture_output=True, timeout=120)
            
            for p in [vocals, inst]:
                if p.exists():
                    stem_files.append(str(p))
        else:
            filters = {"bass": "lowpass=f=250", "drums": "highpass=f=250,lowpass=f=2000", "vocals": "highpass=f=300,lowpass=f=4000", "other": "highpass=f=4000"}
            for name, flt in filters.items():
                path = output_path / f"{base_name}_{name}.wav"
                subprocess.run(["ffmpeg", "-y", "-i", str(input_file), "-af", flt, str(path)], capture_output=True, timeout=120)
                if path.exists():
                    stem_files.append(str(path))
        
        return {"success": bool(stem_files), "count": len(stem_files), "stems": sorted(stem_files), "engine": "ffmpeg"} if stem_files else {"success": False, "error": "FFmpeg failed"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: stem_separator.py <input> <output_dir> [stems] [model]"}))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    stems = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    model = sys.argv[4] if len(sys.argv) > 4 else "MDX23C"
    
    if not Path(input_path).exists():
        print(json.dumps({"success": False, "error": f"File not found: {input_path}"}))
        sys.exit(1)
    
    print(f"[stem_separator] Starting: {model}", file=sys.stderr)
    
    result = separate_with_audio_separator(input_path, output_dir, stems, model)
    
    if not result.get("success"):
        print(f"[stem_separator] Fallback to FFmpeg", file=sys.stderr)
        result = separate_with_ffmpeg(input_path, output_dir, stems)
    
    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
