import React, { useState, createContext, useContext, useEffect, useRef } from 'react';
import { ToastProvider, useToast } from './context/ToastContext';
import { Downloader } from './components/Downloader';
import { AudioProcessor } from './components/AudioProcessor';
import { StemSeparator } from './components/StemSeparator';
import { Settings } from './components/Settings';
import { DependencyChecker } from './components/DependencyChecker';
import { FolderSetupModal } from './components/FolderSetup';
import { ProcessingTab, Language, AppSettings, ToastMessage } from './types';
import { Download, Settings2, Layers, Globe, CheckCircle2, AlertCircle, AlertTriangle, Minus, X, Info } from 'lucide-react';
import { getCurrentWindow, Window } from '@tauri-apps/api/window';
import { mockService } from './services/mockService';

// --- Translations & Context ---

export const translations = {
  en: {
    title: "MediaFlow",
    tabDownloader: "Downloader",
    tabDownloaderDesc: "Extract",
    tabAudio: "Audio Lab",
    tabAudioDesc: "Process",
    tabStems: "Stem Splitter",
    tabStemsDesc: "Separate",
    tabSettings: "Settings",
    footer: "Ready",

    // Downloader
    dlTitle: "Media Downloader",
    dlPlaceholder: "Paste URL (YouTube, TikTok, Spotify...)",
    dlGetInfo: "Analyze",
    dlAudio: "Audio",
    dlVideo: "Video",
    dlQuality: "Quality",
    dlResolution: "Res",
    dlFps: "FPS",
    dlFormat: "Format",
    dlContainer: "Container",
    dlCodec: "Codec",
    dlIncludeAudio: "Audio",
    dlDownloadBtn: "Download",
    dlDownloading: "Downloading...",
    dlSuccess: "Complete",
    dlBatchMode: "Batch",
    dlSingleMode: "Single",
    dlBatchPlaceholder: "Paste multiple URLs...",
    dlBatchStart: "Process All",
    dlBatchProgress: "Progress",
    dlStatusPending: "Pending",
    dlStatusProcessing: "Active",
    dlStatusDone: "Done",
    dlStatusError: "Error",
    dlPresets: "Presets",
    dlRetryFailed: "Retry",
    dlServerStatus: "Mode: Web Demo",

    // Audio Processor
    apTitle: "Audio Lab",
    apUpload: "Drop audio file here",
    apSupports: "MP3, WAV, FLAC",
    apPitch: "Pitch",
    apApplyPitch: "Apply",
    apAnalysis: "Analysis",
    apDetectTempo: "BPM",
    apDetectKey: "Key",
    apSaved: "Saved",
    apRetry: "Retry",
    apError: "Error",

    // Stem Separator (UVR5 & BandMates Inspired)
    ssTitle: "Stem Separation",
    ssUpload: "Drop audio to separate",
    ssModel: "Model",
    ssArch: "Architecture",
    ss2Stems: "2 Stems",
    ss2StemsDesc: "Vocals / Backing",
    ss4Stems: "4 Stems",
    ss4StemsDesc: "Vocals / Drums / Bass / Other",
    ssBtn: "Separate",
    ssBtnProcessing: "Processing...",
    ssSuccess: "Complete",
    ssDownload: "Save",
    ssShare: "Share",
    ssCopied: "Copied!",
    ssProcessing: "Analyzing...",
    ssError: "Error",
    ssAdvanced: "Advanced Params",
    ssShift: "Shifts",
    ssOverlap: "Overlap",
    ssExportFormat: "Format",
    ssWindowSize: "Window Size",
    ssAggression: "Aggression",
    ssTTA: "TTA (Time Augmentation)",
    ssSegmentSize: "Segment Size",
    ssGPU: "GPU Acceleration",
    ssBatch: "Batch Mode",
    ssMixer: "Stem Mixer",
    ssMute: "M",
    ssSolo: "S",
    ssMaster: "Master Playback",
  },
  th: {
    title: "MediaFlow",
    tabDownloader: "ดาวน์โหลด",
    tabDownloaderDesc: "ดึงไฟล์",
    tabAudio: "แต่งเสียง",
    tabAudioDesc: "โปรเซส",
    tabStems: "แยกเสียง",
    tabStemsDesc: "สเต็ม",
    tabSettings: "ตั้งค่า",
    footer: "พร้อมใช้งาน",

    // Downloader
    dlTitle: "ดาวน์โหลด",
    dlPlaceholder: "วางลิงก์ (YouTube, TikTok...)",
    dlGetInfo: "วิเคราะห์",
    dlAudio: "เสียง",
    dlVideo: "วิดีโอ",
    dlQuality: "คุณภาพ",
    dlResolution: "ความชัด",
    dlFps: "FPS",
    dlFormat: "ไฟล์",
    dlContainer: "คอนเทนเนอร์",
    dlCodec: "Codec",
    dlIncludeAudio: "รวมเสียง",
    dlDownloadBtn: "ดาวน์โหลด",
    dlDownloading: "กำลังโหลด...",
    dlSuccess: "เสร็จสิ้น",
    dlBatchMode: "กลุ่ม",
    dlSingleMode: "เดี่ยว",
    dlBatchPlaceholder: "วางหลายลิงก์...",
    dlBatchStart: "เริ่มทั้งหมด",
    dlBatchProgress: "ความคืบหน้า",
    dlStatusPending: "รอ",
    dlStatusProcessing: "ทำงาน",
    dlStatusDone: "เสร็จ",
    dlStatusError: "พลาด",
    dlPresets: "พรีเซ็ต",
    dlRetryFailed: "ลองใหม่",
    dlServerStatus: "โหมด: เว็บเดโม่",

    // Audio Processor
    apTitle: "แล็บเสียง",
    apUpload: "ลากไฟล์เสียงมาวาง",
    apSupports: "MP3, WAV, FLAC",
    apPitch: "พิตช์",
    apApplyPitch: "เริ่ม",
    apAnalysis: "วิเคราะห์",
    apDetectTempo: "BPM",
    apDetectKey: "คีย์",
    apSaved: "บันทึกแล้ว",
    apRetry: "ลองใหม่",
    apError: "พลาด",

    // Stem Separator
    ssTitle: "แยกสเต็ม",
    ssUpload: "ลากไฟล์มาวาง",
    ssModel: "โมเดล",
    ssArch: "สถาปัตยกรรม",
    ss2Stems: "2 แทร็ก",
    ss2StemsDesc: "ร้อง / ดนตรี",
    ss4Stems: "4 แทร็ก",
    ss4StemsDesc: "เต็มวง",
    ssBtn: "เริ่มแยก",
    ssBtnProcessing: "กำลังทำ...",
    ssSuccess: "เสร็จสิ้น",
    ssDownload: "เซฟ",
    ssShare: "แชร์",
    ssCopied: "คัดลอก!",
    ssProcessing: "วิเคราะห์...",
    ssError: "ผิดพลาด",
    ssAdvanced: "พารามิเตอร์ขั้นสูง",
    ssShift: "Shifts",
    ssOverlap: "Overlap",
    ssExportFormat: "ฟอร์แมต",
    ssWindowSize: "Window Size",
    ssAggression: "Aggression",
    ssTTA: "TTA (ละเอียด)",
    ssSegmentSize: "Segment Size",
    ssGPU: "เร่งความเร็ว GPU",
    ssBatch: "โหมดกลุ่ม",
    ssMixer: "มิกเซอร์",
    ssMute: "M",
    ssSolo: "S",
    ssMaster: "เล่นทั้งหมด",
  },
  jp: {
    title: "MediaFlow",
    tabDownloader: "ダウンロード",
    tabDownloaderDesc: "抽出",
    tabAudio: "音声編集",
    tabAudioDesc: "加工",
    tabStems: "分離",
    tabStemsDesc: "ステム",
    tabSettings: "設定",
    footer: "準備完了",

    // Downloader
    dlTitle: "ダウンローダー",
    dlPlaceholder: "URLを貼り付け (YouTube...)",
    dlGetInfo: "解析",
    dlAudio: "音声",
    dlVideo: "動画",
    dlQuality: "音質",
    dlResolution: "解像度",
    dlFps: "FPS",
    dlFormat: "形式",
    dlContainer: "コンテナ",
    dlCodec: "コーデック",
    dlIncludeAudio: "音声込",
    dlDownloadBtn: "開始",
    dlDownloading: "処理中...",
    dlSuccess: "完了",
    dlBatchMode: "一括",
    dlSingleMode: "単一",
    dlBatchPlaceholder: "複数リンク...",
    dlBatchStart: "一括開始",
    dlBatchProgress: "進捗",
    dlStatusPending: "待機",
    dlStatusProcessing: "処理中",
    dlStatusDone: "完了",
    dlStatusError: "エラー",
    dlPresets: "設定",
    dlRetryFailed: "再試行",
    dlServerStatus: "Webデモ",

    // Audio Processor
    apTitle: "音声ラボ",
    apUpload: "ファイルをドロップ",
    apSupports: "MP3, WAV, FLAC",
    apPitch: "ピッチ",
    apApplyPitch: "適用",
    apAnalysis: "分析",
    apDetectTempo: "BPM",
    apDetectKey: "キー",
    apSaved: "保存済",
    apRetry: "再試行",
    apError: "エラー",

    // Stem Separator
    ssTitle: "ステム分離",
    ssUpload: "ファイルをドロップ",
    ssModel: "モデル",
    ssArch: "アーキテクチャ",
    ss2Stems: "2ch",
    ss2StemsDesc: "ボーカル/伴奏",
    ss4Stems: "4ch",
    ss4StemsDesc: "バンド",
    ssBtn: "分離",
    ssBtnProcessing: "処理中...",
    ssSuccess: "完了",
    ssDownload: "保存",
    ssShare: "共有",
    ssCopied: "コピー!",
    ssProcessing: "分析中...",
    ssError: "エラー",
    ssAdvanced: "詳細設定",
    ssShift: "シフト",
    ssOverlap: "重複",
    ssExportFormat: "形式",
    ssWindowSize: "ウィンドウサイズ",
    ssAggression: "強度",
    ssTTA: "TTA (高精度)",
    ssSegmentSize: "セグメント",
    ssGPU: "GPU加速",
    ssBatch: "一括モード",
    ssMixer: "ミキサー",
    ssMute: "M",
    ssSolo: "S",
    ssMaster: "マスター再生",
  }
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['en'];
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
};

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => { },
  t: translations.en,
  settings: {
    downloadPath: 'Downloads',
    defaultAudioFormat: 'mp3',
    defaultVideoContainer: 'mp4',
    notifications: true,
    theme: 'dark'
  },
  updateSettings: () => { }
});

export const useLanguage = () => useContext(LanguageContext);


// --- Toast System ---

// ToastContext has been moved to src/context/ToastContext.tsx

type StatusContextValue = {
  status: string;
  setStatus: (value: string) => void;
};

export const StatusContext = createContext<StatusContextValue | undefined>(undefined);

export const useStatus = () => {
  const ctx = useContext(StatusContext);
  if (!ctx) {
    throw new Error('useStatus must be used within StatusContext');
  }
  return ctx;
};

// --- Main App ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ProcessingTab>(ProcessingTab.Downloader);
  const [language, setLanguage] = useState<Language>('en');
  const [showSettings, setShowSettings] = useState(false);
  // const [toasts, setToasts] = useState<ToastMessage[]>([]); // Toasts now managed by provider
  const [status, setStatus] = useState('Ready');
  const [showDependencyCheck, setShowDependencyCheck] = useState(true);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    downloadPath: '',
    defaultAudioFormat: 'mp3',
    defaultVideoContainer: 'mp4',
    notifications: true,
    theme: 'dark',
    downloadCategories: [
      { id: 'music', name: 'Music', path: 'Music', icon: '🎵' },
      { id: 'videos', name: 'Videos', path: 'Videos', icon: '🎬' },
      { id: 'podcasts', name: 'Podcasts', path: 'Podcasts', icon: '🎙️' },
      { id: 'other', name: 'Other', path: 'Other', icon: '📁' },
    ],
    defaultCategory: 'music'
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const saved = localStorage.getItem('mf_settings');
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load settings");
        }
      } else {
        // Load default download path if no settings saved
        const defaultPath = await mockService.getDefaultDir();
        setSettings(prev => ({ ...prev, downloadPath: defaultPath }));
      }
    };
    loadSettings();
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings };
      localStorage.setItem('mf_settings', JSON.stringify(next));
      return next;
    });
  };

  const t = translations[language];

  // Toast logic moved to ToastProvider

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, settings, updateSettings }}>
      <StatusContext.Provider value={{ status, setStatus }}>
        <ToastProvider>
          {/* Folder Setup Modal - shows if no output folder configured */}
          <FolderSetupModal />
          
          <div className="flex flex-col h-screen bg-[#09090b] text-slate-200 font-inter select-none overflow-hidden">

            {/* Compact Title Bar */}
            <TitleBar status={status} />

            {/* Horizontal Tab Bar */}
            <div className="h-10 bg-[#0c0c0e] border-b border-white/5 flex items-center justify-between px-4">
              <div className="flex items-center gap-1">
                {[
                  { id: ProcessingTab.Downloader, icon: Download, label: t.tabDownloader },
                  { id: ProcessingTab.AudioProcessor, icon: Settings2, label: t.tabAudio },
                  { id: ProcessingTab.StemSeparator, icon: Layers, label: t.tabStems }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {/* Language Selector */}
                <div className="flex bg-[#18181b] rounded-md border border-white/10 p-0.5">
                  {(['en', 'th', 'jp'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${language === lang ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                {/* Settings Button */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <div className="max-w-6xl mx-auto">
                {activeTab === ProcessingTab.Downloader && <Downloader />}
                {activeTab === ProcessingTab.AudioProcessor && <AudioProcessor />}
                {activeTab === ProcessingTab.StemSeparator && <StemSeparator />}
              </div>
            </main>

            {/* Settings Modal */}
            {showSettings && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                <div className="bg-[#18181b] border border-white/10 rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
                  <div className="sticky top-0 bg-[#18181b] border-b border-white/10 p-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Settings</h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4">
                    <Settings />
                  </div>
                </div>
              </div>
            )}

            {/* Global Toast Container is now inside ToastProvider */}

            {/* Dependency Checker */}
            {showDependencyCheck && (
              <DependencyChecker onClose={() => setShowDependencyCheck(false)} />
            )}

          </div>
        </ToastProvider>
      </StatusContext.Provider>
    </LanguageContext.Provider>
  );
};

type TitleBarProps = {
  status: string;
};

const TitleBar: React.FC<TitleBarProps> = ({ status }) => {
  const windowHandleRef = useRef<Window | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      windowHandleRef.current = getCurrentWindow();
    }
  }, []);

  const handleMinimize = async () => {
    try {
      await windowHandleRef.current?.minimize();
    } catch (error) {
      console.error('Failed to minimize:', error);
    }
  };

  const handleClose = async () => {
    try {
      await windowHandleRef.current?.close();
    } catch (error) {
      console.error('Failed to close:', error);
    }
  };

  return (
    <div className="h-8 px-3 bg-[#020203] border-b border-white/5 flex items-center justify-between" data-tauri-drag-region>
      <div className="flex items-center gap-2 flex-1 min-w-0" data-tauri-drag-region>
        <div className="w-5 h-5 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/30">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1" data-tauri-drag-region>
          <span className="text-[11px] font-bold text-white">MediaFlow</span>
          <span className="w-px h-3 bg-white/10"></span>
          <span className="text-[10px] text-emerald-400 truncate">{status}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={handleMinimize}
          className="w-6 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          data-tauri-drag-region="false"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-6 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-red-300 hover:text-red-200 transition-colors"
          data-tauri-drag-region="false"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default App;