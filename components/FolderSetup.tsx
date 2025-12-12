// components/FolderSetup.tsx
// Modal บังคับเลือก folder ตอนเปิดโปรแกรมครั้งแรก

import React, { useState } from 'react';
import { FolderOpen, Loader2, Check, AlertCircle } from 'lucide-react';
import { isTauri } from '../utils/tauriHelper';
import { invoke } from '@tauri-apps/api/core';
import { useLanguage } from '../App';

// Subfolder structure ที่จะสร้างอัตโนมัติ
const SUBFOLDERS = [
  'Downloads/Audio',
  'Downloads/Video',
  'AudioLab',
  'Stems',
];

// Helper to open folder dialog
const selectFolder = async (): Promise<string | null> => {
  try {
    if (isTauri()) {
      return await invoke<string | null>('select_folder');
    }
    return prompt('Enter folder path:');
  } catch (error) {
    console.error('Failed to open folder dialog:', error);
    return null;
  }
};

// Create subfolders via Tauri command
const createSubfolders = async (basePath: string): Promise<boolean> => {
  try {
    if (isTauri()) {
      // Use snake_case for Tauri command parameter
      await invoke('create_output_folders', { base_path: basePath });
      return true;
    }
    return true; // Web mode - assume success
  } catch (error) {
    console.error('Failed to create folders:', error);
    return false;
  }
};

// Hook to get output paths
export const useOutputPaths = () => {
  const { settings } = useLanguage();
  const basePath = settings.outputBasePath || '';

  const getPath = (subfolder: string): string => {
    if (!basePath) return '';
    const separator = basePath.includes('\\') ? '\\' : '/';
    return `${basePath}${separator}${subfolder.replace(/\//g, separator)}`;
  };

  return {
    basePath,
    isConfigured: !!basePath,
    downloaderAudio: getPath('Downloads/Audio'),
    downloaderVideo: getPath('Downloads/Video'),
    audioLab: getPath('AudioLab'),
    stemSplitter: getPath('Stems'),
  };
};

// Modal ที่แสดงตอนยังไม่ได้เลือก folder
export const FolderSetupModal: React.FC = () => {
  const { settings, updateSettings } = useLanguage();
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // ถ้ามี outputBasePath แล้ว ไม่ต้องแสดง modal
  if (settings.outputBasePath) {
    return null;
  }

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    setError(null);
    try {
      const path = await selectFolder();
      if (path) {
        setSelectedPath(path);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to select folder');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPath) return;
    
    setIsCreating(true);
    setError(null);
    try {
      // สร้าง subfolders
      const success = await createSubfolders(selectedPath);
      if (success) {
        // บันทึก path
        updateSettings({ outputBasePath: selectedPath });
      } else {
        setError('Failed to create folders. Please try again.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create folders');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121214] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600/20 rounded-lg">
              <FolderOpen className="w-6 h-6 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Setup Output Folder</h2>
          </div>
          <p className="text-sm text-slate-400">
            เลือก folder สำหรับเก็บไฟล์ที่ดาวน์โหลดและประมวลผล
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Folder selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Output Location</label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 bg-[#0c0c0e] border border-white/10 rounded-lg text-sm text-slate-300 truncate">
                {selectedPath || 'No folder selected'}
              </div>
              <button
                onClick={handleSelectFolder}
                disabled={isSelecting || isCreating}
                className="px-4 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSelecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                Browse
              </button>
            </div>
          </div>

          {/* Preview subfolders */}
          {selectedPath && (
            <div className="p-3 bg-[#0c0c0e] rounded-lg border border-white/5">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                Folders to be created:
              </div>
              <div className="space-y-1.5">
                {SUBFOLDERS.map((folder) => (
                  <div key={folder} className="flex items-center gap-2 text-xs text-slate-400">
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="font-mono">{folder}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-[#0c0c0e]">
          <button
            onClick={handleConfirm}
            disabled={!selectedPath || isCreating || isSelecting}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating folders...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirm & Create Folders
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Full folder selector for Settings page
export const BaseFolderSelector: React.FC = () => {
  const { settings, updateSettings } = useLanguage();
  const [isSelecting, setIsSelecting] = useState(false);
  const paths = useOutputPaths();

  const handleSelect = async () => {
    setIsSelecting(true);
    try {
      const selected = await selectFolder();
      if (selected) {
        await createSubfolders(selected);
        updateSettings({ outputBasePath: selected });
      }
    } finally {
      setIsSelecting(false);
    }
  };

  const displayPath = settings.outputBasePath
    ? settings.outputBasePath.length > 35
      ? '...' + settings.outputBasePath.slice(-32)
      : settings.outputBasePath
    : 'Not set - Click to select';

  return (
    <div className="space-y-3">
      <div className="text-sm font-bold text-slate-200 mb-1">Output Folder</div>
      <p className="text-xs text-slate-500 mb-3">All downloaded and processed files will be saved here.</p>
      
      <div className="flex items-center gap-3 p-3 bg-[#0c0c0e] rounded-xl border border-white/5">
        <div className="p-2 bg-indigo-600/20 rounded-lg">
          <FolderOpen className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate" title={settings.outputBasePath}>
            {displayPath}
          </div>
        </div>
        <button
          onClick={handleSelect}
          disabled={isSelecting}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {isSelecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FolderOpen className="w-4 h-4" />
          )}
          {settings.outputBasePath ? 'Change' : 'Select'}
        </button>
      </div>

      {settings.outputBasePath && (
        <div className="p-3 bg-[#0c0c0e] rounded-lg border border-white/5">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Subfolders:</div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="flex items-center gap-2 text-slate-400">
              <Check className="w-3 h-3 text-emerald-500" />
              <span>Downloads/Audio</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Check className="w-3 h-3 text-emerald-500" />
              <span>Downloads/Video</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Check className="w-3 h-3 text-emerald-500" />
              <span>AudioLab</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Check className="w-3 h-3 text-emerald-500" />
              <span>Stems</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact display for showing current output folder
export const OutputFolderDisplay: React.FC = () => {
  const { settings, updateSettings } = useLanguage();
  const [isSelecting, setIsSelecting] = useState(false);

  const handleChange = async () => {
    setIsSelecting(true);
    try {
      const path = await selectFolder();
      if (path) {
        await createSubfolders(path);
        updateSettings({ outputBasePath: path });
      }
    } finally {
      setIsSelecting(false);
    }
  };

  if (!settings.outputBasePath) return null;

  const displayPath = settings.outputBasePath.length > 30
    ? '...' + settings.outputBasePath.slice(-27)
    : settings.outputBasePath;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#18181b] rounded-lg border border-white/5">
      <FolderOpen className="w-4 h-4 text-indigo-400" />
      <span className="text-xs text-slate-400 truncate flex-1" title={settings.outputBasePath}>
        {displayPath}
      </span>
      <button
        onClick={handleChange}
        disabled={isSelecting}
        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
      >
        {isSelecting ? 'Selecting...' : 'Change'}
      </button>
    </div>
  );
};
