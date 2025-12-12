import { VideoInfo, AudioProcessingResult, StemSeparationResult, DownloadType } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/tauriHelper';

interface DownloadOptions {
  quality?: string;
  resolution?: string;
  fps?: string;
  includeAudio?: boolean;
  audioFormat?: string;
  container?: string;
  downloadPath?: string;
}

// Check if Tauri is available
export const isTauriAvailable = (): boolean => {
  return isTauri();
};

// Fallback simulation for Web Preview (so the UI doesn't crash in browser)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockService = {
  getVideoInfo: async (url: string): Promise<VideoInfo> => {
    if (isTauri()) {
      try {
        // REAL TAURI CALL
        const res = await invoke('get_video_info', { url });
        if (typeof res === 'string') {
          return JSON.parse(res);
        }
        return res as VideoInfo;
      } catch (error: any) {
        throw new Error(error?.message || "Failed to get video info");
      }
    } else {
      // Web mode - provide demo data
      await delay(1000);
      // Extract video ID from URL for demo
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : 'demo';

      return {
        title: "Demo Mode - Tauri backend required for real downloads",
        duration: 180,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        uploader: "Demo Mode",
      };
    }
  },

  // Get playlist info - returns list of video URLs
  getPlaylistInfo: async (url: string): Promise<{ title: string; count: number; items: { url: string; title: string; duration: number }[] }> => {
    if (isTauri()) {
      try {
        const res = await invoke('get_playlist_info', { url });
        if (typeof res === 'string') {
          return JSON.parse(res);
        }
        return res as any;
      } catch (error: any) {
        throw new Error(error?.message || "Failed to get playlist info");
      }
    } else {
      // Web mode - demo data
      await delay(1000);
      return {
        title: "Demo Playlist",
        count: 3,
        items: [
          { url: "https://youtube.com/watch?v=demo1", title: "Demo Video 1", duration: 180 },
          { url: "https://youtube.com/watch?v=demo2", title: "Demo Video 2", duration: 240 },
          { url: "https://youtube.com/watch?v=demo3", title: "Demo Video 3", duration: 300 },
        ]
      };
    }
  },

  downloadMedia: async (
    url: string,
    type: DownloadType,
    options: DownloadOptions,
    onProgress?: (progress: number) => void
  ): Promise<string> => {
    if (!isTauri()) {
      throw new Error("Tauri backend not available. Please run the application using 'npm run tauri:dev' for full functionality.");
    }

    if (onProgress) onProgress(10); // Start

    try {
      let res;
      if (type === DownloadType.Audio) {
        res = await invoke('download_audio', {
          url,
          quality: options.quality || '320',
          format: options.audioFormat || 'mp3',
          download_path: options.downloadPath
        });
      } else {
        res = await invoke('download_video', {
          url,
          resolution: options.resolution || '1080',
          include_audio: options.includeAudio ?? true,
          fps: parseInt(options.fps || '30'),
          container: options.container || 'mp4',
          download_path: options.downloadPath
        });
      }

      if (onProgress) {
        // Simulate progress updates
        for (let i = 20; i <= 90; i += 10) {
          await delay(200);
          onProgress(i);
        }
      }

      // Parse response - Rust returns JSON string with {filename, path}
      let data;
      if (typeof res === 'string') {
        try {
          data = JSON.parse(res);
        } catch {
          // If parsing fails, treat as filename string
          if (onProgress) onProgress(100);
          return res;
        }
      } else {
        data = res;
      }

      if (onProgress) onProgress(100);

      // Extract filename from response (Rust returns {filename, path})
      const filename = data.filename || data.path || data.toString();
      if (!filename || filename === '[object Object]') {
        throw new Error("Invalid response from backend");
      }

      return filename;
    } catch (error: any) {
      if (onProgress) onProgress(0);
      const errorMessage = error?.message || "Download failed";

      // Provide specific troubleshooting guidance based on error type
      if (errorMessage.includes("yt-dlp") || errorMessage.includes("PATH")) {
        throw new Error(
          "yt-dlp is not installed or not found in PATH.\n\n" +
          "📦 Installation:\n" +
          "• Windows: pip install yt-dlp\n" +
          "• macOS: brew install yt-dlp\n" +
          "• Linux: pip install yt-dlp\n\n" +
          "After installation, restart the application."
        );
      }

      if (errorMessage.includes("FFmpeg") || errorMessage.includes("ffmpeg")) {
        throw new Error(
          "FFmpeg is required for video processing.\n\n" +
          "📦 Installation:\n" +
          "• Windows: Download from ffmpeg.org\n" +
          "• macOS: brew install ffmpeg\n" +
          "• Linux: sudo apt install ffmpeg\n\n" +
          "Make sure FFmpeg is added to your system PATH."
        );
      }

      if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
        throw new Error(
          "Network error occurred.\n\n" +
          "🔧 Troubleshooting:\n" +
          "• Check your internet connection\n" +
          "• Try the URL in your browser to verify it's accessible\n" +
          "• Some URLs may be geo-restricted"
        );
      }

      if (errorMessage.includes("format") || errorMessage.includes("quality")) {
        throw new Error(
          "The requested format/quality is not available.\n\n" +
          "💡 Try:\n" +
          "• Select a different quality option\n" +
          "• Try a different format (mp3, wav, mp4)\n" +
          "• Check if the video is still available online"
        );
      }

      // Default error with general guidance
      throw new Error(errorMessage + "\n\n💡 Tip: Check the dependency checker for missing system requirements.");
    }
  },

  detectTempo: async (filePath: string): Promise<AudioProcessingResult> => {
    console.log('[detectTempo] Starting with path:', filePath);
    if (isTauri()) {
      try {
        console.log('[detectTempo] Calling Tauri invoke...');
        const res = await invoke('detect_tempo', { audio_path: filePath });
        console.log('[detectTempo] Raw response:', res);
        const parsed = JSON.parse(res as string);
        console.log('[detectTempo] Parsed result:', parsed);
        return parsed;
      } catch (error: any) {
        console.error('[detectTempo] Error:', error);
        return { success: false, error: error?.message || 'Tempo detection failed' };
      }
    } else {
      await delay(1500);
      return { success: true, tempo: 120, beats: 480 };
    }
  },

  detectKey: async (filePath: string): Promise<AudioProcessingResult> => {
    console.log('[detectKey] Starting with path:', filePath);
    if (isTauri()) {
      try {
        console.log('[detectKey] Calling Tauri invoke...');
        const res = await invoke('detect_key', { audio_path: filePath });
        console.log('[detectKey] Raw response:', res);
        const parsed = JSON.parse(res as string);
        console.log('[detectKey] Parsed result:', parsed);
        return parsed;
      } catch (error: any) {
        console.error('[detectKey] Error:', error);
        return { success: false, error: error?.message || 'Key detection failed' };
      }
    } else {
      await delay(1500);
      return { success: true, key: "C Major", confidence: 0.9 };
    }
  },

  pitchShift: async (inputPath: string, semitones: number): Promise<AudioProcessingResult> => {
    console.log('[pitchShift] Starting with path:', inputPath, 'semitones:', semitones);

    if (isTauri()) {
      try {
        console.log('[pitchShift] Calling Tauri invoke...');
        // Don't send output_path - let Rust generate filename with pitch value
        const res = await invoke('pitch_shift', {
          input_path: inputPath,
          semitones: parseFloat(semitones.toString())
        });
        console.log('[pitchShift] Raw response:', res);
        let data;
        if (typeof res === 'string') {
          data = JSON.parse(res);
        } else {
          data = res;
        }
        console.log('[pitchShift] Parsed result:', data);
        return data;
      } catch (error: any) {
        console.error('[pitchShift] Error:', error);
        const msg = error?.message || "Pitch shift failed";
        if (msg.includes("FFmpeg") || msg.includes("ffmpeg")) {
          throw new Error(
            "FFmpeg is required for pitch shifting.\n\n" +
            "📦 Install FFmpeg and restart the app.\n" +
            "Visit: ffmpeg.org/download"
          );
        }
        if (msg.includes("not found") || msg.includes("No such file")) {
          throw new Error("Audio file not found. Please upload the file again.");
        }
        throw new Error(msg + "\n\n💡 Check the dependency checker for system requirements.");
      }
    } else {
      await delay(2000);
      return { success: true, output: outputPath };
    }
  },

  separateStems: async (inputPath: string, stemCount: 2 | 4, format: string, outputFolder?: string, onProgress?: (p: number) => void, modelName?: string, useGpu?: boolean): Promise<StemSeparationResult> => {
    // Use provided output folder or default to input path with _stems suffix
    const outputDir = outputFolder || inputPath.replace(/(\.[\w\d]+)$/, '_stems');

    if (onProgress) onProgress(20);

    if (isTauri()) {
      try {
        const res = await invoke('separate_stems', {
          input_path: inputPath,
          output_dir: outputDir,
          stems: stemCount,
          format,
          model_name: modelName || 'UVR-MDX-NET-Inst_HQ_3',
          use_gpu: useGpu ?? true
        });
        if (onProgress) onProgress(90);
        let data;
        if (typeof res === 'string') {
          data = JSON.parse(res);
        } else {
          data = res;
        }
        if (onProgress) onProgress(100);
        return data;
      } catch (error: any) {
        if (onProgress) onProgress(0);
        const msg = error?.message || "Stem separation failed";

        if (msg.includes("Python") || msg.includes("python")) {
          throw new Error(
            "Python is required for stem separation.\n\n" +
            "📦 Installation:\n" +
            "• Download from python.org\n" +
            "• Install Python 3.8 or higher\n" +
            "• Restart the application"
          );
        }



        if (msg.includes("not found") || msg.includes("No such file")) {
          throw new Error("Audio file not found. Please upload the file again.");
        }

        throw new Error(msg + "\n\n💡 Tip: Check the dependency checker and Settings for configuration.");
      }
    } else {
      await delay(3000);
      if (onProgress) onProgress(100);
      return {
        success: true,
        stems: [`${outputDir}/vocals.wav`, `${outputDir}/drums.wav`, `${outputDir}/bass.wav`, `${outputDir}/other.wav`],
        count: stemCount
      };
    }
  },

  selectFolder: async (): Promise<string | null> => {
    if (isTauri()) {
      try {
        const res = await invoke('select_folder');
        return res as string | null;
      } catch (e) {
        return null;
      }
    } else {
      await delay(500);
      return "C:\\Users\\User\\Downloads";
    }
  },

  getDefaultDir: async (): Promise<string> => {
    if (isTauri()) {
      try {
        const res = await invoke('get_default_download_dir');
        return res as string;
      } catch (e) {
        console.error("Failed to get default dir", e);
        return "Downloads";
      }
    } else {
      return "Downloads";
    }
  },

  uploadFile: async (file: File): Promise<string> => {
    console.log('[uploadFile] Starting upload for:', file.name);
    if (!isTauri()) {
      throw new Error("Tauri backend not available. Please run with 'npm run tauri:dev'");
    }

    try {
      // Check if file has a path (Tauri/Electron provides this)
      if ((file as any).path) {
        console.log('[uploadFile] Using file path directly:', (file as any).path);
        return (file as any).path;
      }

      // For large files (>50MB), we need to use a different approach
      const MAX_DIRECT_SIZE = 50 * 1024 * 1024; // 50MB
      
      if (file.size > MAX_DIRECT_SIZE) {
        console.log('[uploadFile] File too large for direct upload:', file.size, 'bytes');
        // Save to temp using Tauri fs plugin or ask user to use smaller file
        throw new Error(`File too large (${Math.round(file.size / 1024 / 1024)}MB). Please use a file smaller than 50MB, or drag the file directly from your file explorer.`);
      }

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log('[uploadFile] File size:', uint8Array.length, 'bytes');

      // Convert to regular array in chunks to avoid memory issues
      const chunkSize = 1024 * 1024; // 1MB chunks
      const chunks: number[] = [];
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        chunks.push(...chunk);
      }

      // Upload to backend
      const filePath = await invoke('upload_file', {
        file_name: file.name,
        file_data: chunks
      });

      console.log('[uploadFile] Uploaded to:', filePath);
      return filePath as string;
    } catch (error: any) {
      console.error('[uploadFile] Error:', error);
      throw new Error(error?.message || "Failed to upload file");
    }
  }
};