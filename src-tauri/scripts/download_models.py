#!/usr/bin/env python3
"""
Download AI models for stem separation
Run this once to pre-download all models
"""

import sys
import json

def download_models():
    """Download all required models"""
    try:
        from audio_separator.separator import Separator
        
        # Models to download (best quality ones)
        models = [
            "UVR-MDX-NET-Inst_HQ_3.onnx",  # Best vocal/instrumental
        ]
        
        print(json.dumps({"status": "starting", "total": len(models)}))
        sys.stdout.flush()
        
        separator = Separator()
        
        for i, model in enumerate(models):
            print(json.dumps({"status": "downloading", "model": model, "progress": i + 1, "total": len(models)}))
            sys.stdout.flush()
            
            try:
                separator.load_model(model)
                print(json.dumps({"status": "downloaded", "model": model}))
            except Exception as e:
                print(json.dumps({"status": "error", "model": model, "error": str(e)}))
            sys.stdout.flush()
        
        print(json.dumps({"status": "complete", "success": True}))
        return True
        
    except ImportError:
        print(json.dumps({"status": "error", "error": "audio-separator not installed"}))
        return False
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))
        return False


if __name__ == "__main__":
    success = download_models()
    sys.exit(0 if success else 1)
