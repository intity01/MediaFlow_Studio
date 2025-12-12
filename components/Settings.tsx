import React, { useState, useEffect } from 'react';
import { BaseFolderSelector } from '../components/FolderSetup';
import { useLanguage } from '../App';
import { useToast } from '../context/ToastContext';
import { Bell, Moon, Sun, Trash2, Globe, Zap, Cpu, HardDrive, ExternalLink, Loader2 } from 'lucide-react';
import { isTauri } from '../utils/tauriHelper';
import { invoke } from '@tauri-apps/api/core';

export const Settings: React.FC = () => {
  const { t, settings, updateSettings, language, setLanguage } = useLanguage();
  const { addToast } = useToast();
  const [cacheSize, setCacheSize] = useState<string | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  const gpuEnabled = settings.useGpu ?? true;

  // Calculate cache size on mount
  useEffect(() => {
    const getCacheSize = async () => {
      if (isTauri()) {
        try {
          const size = await invoke<string>('get_cache_size');
          setCacheSize(size);
        } catch (e) {
          setCacheSize('N/A');
        }
      } else {
        // Web mode - estimate from localStorage
        const localStorageSize = new Blob(Object.values(localStorage)).size;
        setCacheSize(formatBytes(localStorageSize));
      }
    };
    getCacheSize();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      if (isTauri()) {
        await invoke('clear_cache');
      }
      // Clear localStorage too
      const keysToKeep = ['mf_settings', 'mf_output_base'];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      setCacheSize('0 B');
      addToast({ type: 'success', title: 'Cache Cleared', message: 'Temporary files removed' });
    } catch (e) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to clear cache' });
    } finally {
      setClearingCache(false);
    }
  };

  const openExternalLink = async (url: string) => {
    if (isTauri()) {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
      } catch (e) {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(url);
        addToast({ type: 'info', title: 'Link Copied', message: 'Open in your browser' });
      }
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* Output Folders */}
      <BaseFolderSelector />

      {/* AI Engine */}
      <div className="bg-[#0c0c0e] border border-white/5 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Engine</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-[#121214] rounded-lg border border-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${gpuEnabled ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
              <Zap className={`w-4 h-4 ${gpuEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-200">{gpuEnabled ? 'GPU (CUDA)' : 'CPU'}</span>
              <p className="text-[10px] text-slate-500">{gpuEnabled ? 'Fast processing' : 'Slower but compatible'}</p>
            </div>
          </div>
          <button
            onClick={() => updateSettings({ useGpu: !gpuEnabled })}
            className={`w-11 h-6 rounded-full relative transition-colors ${gpuEnabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${gpuEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Settings */}
      <div className="grid grid-cols-2 gap-3">
        {/* Language */}
        <div className="bg-[#0c0c0e] border border-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Language</span>
          </div>
          <div className="flex bg-[#121214] p-0.5 rounded-lg border border-white/10">
            {[
              { code: 'en', label: 'EN' },
              { code: 'th', label: 'TH' },
              { code: 'jp', label: 'JP' }
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code as any)}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  language === lang.code ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="bg-[#0c0c0e] border border-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            {settings.theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-yellow-400" />}
            <span className="text-[10px] font-bold text-slate-500 uppercase">Theme</span>
          </div>
          <button
            onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            className="w-full py-2 rounded-lg bg-[#121214] border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/5 transition-colors"
          >
            {settings.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        {/* Notifications */}
        <div className="bg-[#0c0c0e] border border-white/5 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className={`w-3.5 h-3.5 ${settings.notifications ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-slate-300">Notify</span>
            </div>
            <button
              onClick={() => updateSettings({ notifications: !settings.notifications })}
              className={`w-9 h-5 rounded-full relative transition-colors ${settings.notifications ? 'bg-emerald-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${settings.notifications ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        </div>

        {/* Cache */}
        <div className="bg-[#0c0c0e] border border-white/5 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-300">
                {cacheSize === null ? '...' : cacheSize}
              </span>
            </div>
            <button
              onClick={handleClearCache}
              disabled={clearingCache || cacheSize === '0 B'}
              className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-bold disabled:opacity-50 flex items-center gap-1"
            >
              {clearingCache ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-[#0c0c0e] border border-white/5 rounded-xl p-4 text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-white">MediaFlow</div>
            <div className="text-[10px] text-indigo-400">v0.9.0-beta</div>
          </div>
        </div>
        
        <p className="text-[10px] text-slate-500 max-w-[250px] mx-auto">
          Free & open source media toolkit. Download, process audio, and separate stems with AI.
        </p>

        <div className="flex items-center justify-center gap-4 text-[10px]">
          <button 
            onClick={() => openExternalLink('https://github.com/intity01/MediaFlow')} 
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            GitHub <ExternalLink className="w-2.5 h-2.5" />
          </button>
          <span className="text-slate-700">•</span>
          <span className="text-slate-500">MIT License</span>
          <span className="text-slate-700">•</span>
          <span className="text-slate-500">Privacy First</span>
        </div>

        <div className="text-[10px] text-slate-600 pt-2 border-t border-white/5">
          Made with ❤️ by <span className="text-slate-400">MAMIPOKO</span> 🇹🇭
        </div>
      </div>

      {/* Credits & Technologies */}
      <div className="bg-[#0c0c0e] border border-white/5 rounded-xl p-4 space-y-3">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Powered By</div>
        <div className="grid grid-cols-2 gap-2 text-[9px]">
          <div className="bg-[#121214] rounded-lg p-2 border border-white/5">
            <div className="text-slate-300 font-bold">Tauri 2</div>
            <div className="text-slate-600">Desktop Framework</div>
          </div>
          <div className="bg-[#121214] rounded-lg p-2 border border-white/5">
            <div className="text-slate-300 font-bold">React 19</div>
            <div className="text-slate-600">UI Framework</div>
          </div>
          <div className="bg-[#121214] rounded-lg p-2 border border-white/5">
            <div className="text-slate-300 font-bold">yt-dlp</div>
            <div className="text-slate-600">Media Download</div>
          </div>
          <div className="bg-[#121214] rounded-lg p-2 border border-white/5">
            <div className="text-slate-300 font-bold">FFmpeg</div>
            <div className="text-slate-600">Audio/Video Processing</div>
          </div>
          <div className="bg-[#121214] rounded-lg p-2 border border-white/5">
            <div className="text-slate-300 font-bold">audio-separator</div>
            <div className="text-slate-600">AI Stem Separation</div>
          </div>
          <div className="bg-[#121214] rounded-lg p-2 border border-white/5">
            <div className="text-slate-300 font-bold">PyTorch</div>
            <div className="text-slate-600">GPU Acceleration</div>
          </div>
          <div className="bg-[#121214] rounded-lg p-2 border border-white/5">
            <div className="text-slate-300 font-bold">Demucs / MDX</div>
            <div className="text-slate-600">AI Models</div>
          </div>
          <div className="bg-[#121214] rounded-lg p-2 border border-white/5">
            <div className="text-slate-300 font-bold">Tailwind CSS</div>
            <div className="text-slate-600">Styling</div>
          </div>
        </div>
        <div className="text-[9px] text-slate-600 text-center pt-2">
          Special thanks to all open source contributors 💜
        </div>
      </div>
    </div>
  );
};
