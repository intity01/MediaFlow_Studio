export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution?: string;
  fps?: number;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
}

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  formats?: VideoFormat[];
}

export interface AudioProcessingResult {
  success: boolean;
  output?: string;
  tempo?: number;
  beats?: number;
  key?: string;
  confidence?: number;
  error?: string;
}

export interface StemSeparationResult {
  success: boolean;
  stems: string[];
  count: number;
  error?: string;
}

export enum DownloadType {
  Audio = 'audio',
  Video = 'video'
}

export enum ProcessingTab {
  Downloader = 'downloader',
  AudioProcessor = 'audio-processor',
  StemSeparator = 'stem-separator',
  Settings = 'settings'
}

export type Language = 'en' | 'th' | 'jp';

export interface DownloadCategory {
  id: string;
  name: string;
  path: string;  // subfolder name or full path
  icon?: string; // emoji or icon name
}

export interface AppSettings {
  downloadPath: string;
  defaultAudioFormat: string;
  defaultVideoContainer: string;
  notifications: boolean;
  theme: 'dark' | 'light';
  downloadCategories: DownloadCategory[];
  defaultCategory?: string;
  // Base output folder - subfolders created automatically
  outputBasePath?: string;
  // AI Engine settings
  useGpu?: boolean;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id?: string;
  type: ToastType;
  title: string;
  message?: string;
}

// Extend the standard File interface to include the 'path' property
// which is available in Tauri/Electron webviews
declare global {
  interface File {
    path?: string;
  }
}