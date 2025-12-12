import React, { useState, useEffect } from 'react';
import { Music2, Activity, CheckCircle2, Loader2, FileMusic, Zap, RefreshCw, FolderOpen, Check, Sparkles } from 'lucide-react';
import { mockService } from '../services/mockService';
import { AudioProcessingResult } from '../types';
import { useLanguage, useStatus } from '../App';
import { useToast } from '../context/ToastContext';
import { isTauri } from '../utils/tauriHelper';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { useOutputPaths, OutputFolderDisplay } from './FolderSetup';

export const AudioProcessor: React.FC = () => {
  const { t } = useLanguage();
  const { setStatus } = useStatus();
  const { addToast } = useToast();
  const paths = useOutputPaths();
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [tempoResult, setTempoResult] = useState<AudioProcessingResult | null>(null);
  const [keyResult, setKeyResult] = useState<AudioProcessingResult | null>(null);
  const [pitchResult, setPitchResult] = useState<AudioProcessingResult | null>(null);

  const [loadingTempo, setLoadingTempo] = useState(false);
  const [loadingKey, setLoadingKey] = useState(false);

  // Listen for Tauri drag-drop events
  useEffect(() => {
    if (!isTauri()) return;

    const unlisten = listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      console.log('[AudioProcessor] Tauri drag-drop event:', event.payload);
      const paths = event.payload.paths;
      if (paths && paths.length > 0) {
        const path = paths[0];
        // Check if it's an audio file
        const ext = path.split('.').pop()?.toLowerCase();
        const audioExts = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma'];
        if (ext && audioExts.includes(ext)) {
          const name = path.split(/[/\\]/).pop() || 'audio';
          setFileName(name);
          setFilePath(path);
          setTempoResult(null);
          setKeyResult(null);
          setPitchResult(null);
          setStatus(`Ready · ${name}`);
        }
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [setStatus]);

  // Use Tauri file picker to select audio file
  const handleSelectFile = async () => {
    if (!isTauri()) {
      setStatus('File picker requires Tauri backend');
      return;
    }

    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Audio',
          extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma']
        }]
      });

      if (selected && typeof selected === 'string') {
        const name = selected.split(/[/\\]/).pop() || 'audio';
        setFileName(name);
        setFilePath(selected);
        setTempoResult(null);
        setKeyResult(null);
        setPitchResult(null);
        setStatus(`Ready · ${name}`);
        console.log('[AudioProcessor] Selected file:', selected);
      }
    } catch (error: any) {
      console.error('[AudioProcessor] File picker error:', error);
      setStatus(`Error: ${error?.message || 'Failed to open file picker'}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Tauri will handle the drop via the event listener
    console.log('[AudioProcessor] HTML drop event - Tauri will handle via event listener');
  };

  const handleProcessPitch = async () => {
    if (!filePath) return;
    setProcessing(true);
    try {
      setStatus(`Processing pitch shift: ${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} semitones...`);
      console.log('[AudioProcessor] Pitch shift:', filePath, pitchSemitones);
      const result = await mockService.pitchShift(filePath, pitchSemitones);
      console.log('[AudioProcessor] Pitch shift result:', result);
      setPitchResult(result);
      if (result.success && result.output) {
        setStatus(`Complete · Pitch shifted: ${result.output.split(/[/\\]/).pop()}`);
      } else {
        setStatus(`Pitch shift failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('[AudioProcessor] Pitch shift error:', error);
      setStatus(`Error: ${error?.message || 'Pitch shift failed'}`);
      setPitchResult({ success: false, error: error?.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleDetectTempo = async () => {
    if (!filePath) return;
    setLoadingTempo(true);
    try {
      setStatus('Analyzing tempo...');
      console.log('[AudioProcessor] Detecting tempo for:', filePath);
      const result = await mockService.detectTempo(filePath);
      console.log('[AudioProcessor] Tempo result:', result);
      setTempoResult(result);
      if (result.success && result.tempo) {
        setStatus(`Complete · Tempo: ${Math.round(result.tempo)} BPM`);
      } else {
        setStatus(`Tempo detection failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('[AudioProcessor] Tempo error:', error);
      setTempoResult({ success: false, error: error?.message || 'Failed' });
      setStatus('Tempo detection error');
    } finally {
      setLoadingTempo(false);
    }
  };

  const handleDetectKey = async () => {
    if (!filePath) return;
    setLoadingKey(true);
    try {
      setStatus('Detecting key...');
      console.log('[AudioProcessor] Detecting key for:', filePath);
      const result = await mockService.detectKey(filePath);
      console.log('[AudioProcessor] Key result:', result);
      setKeyResult(result);
      if (result.success && result.key) {
        setStatus(`Complete · Key: ${result.key}`);
      } else {
        setStatus(`Key detection failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('[AudioProcessor] Key error:', error);
      setKeyResult({ success: false, error: error?.message || 'Failed' });
      setStatus('Key detection error');
    } finally {
      setLoadingKey(false);
    }
  };

  return (
    <div className="pb-10 space-y-6">
      {/* Output Folder Display */}
      <div className="bg-[#121214] rounded-xl border border-white/5 p-3">
        <OutputFolderDisplay />
      </div>

      {/* Upload Zone - Consistent with StemSeparator */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 group overflow-hidden cursor-pointer
          ${isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : (filePath ? 'border-indigo-500/20 bg-[#121214]' : 'border-slate-800 bg-[#121214] hover:border-slate-600')
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleSelectFile}
      >
        <div className="flex flex-col items-center justify-center gap-3 relative z-10">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${filePath ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300'}`}>
            {filePath ? <Check className="w-6 h-6" /> : <FolderOpen className="w-6 h-6" />}
          </div>
          <div>
            {filePath ? (
              <>
                <h3 className="text-sm font-bold text-white">{fileName}</h3>
                <p className="text-[10px] text-indigo-400 font-mono mt-1">Ready for processing</p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-300">Click to select audio file</h3>
                <p className="text-[10px] text-slate-500">or drag & drop from file explorer</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pitch Shifter */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.apPitch}</span>
          </div>

          <div className="flex flex-col">
            <div className="relative mb-6 px-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-3 uppercase">
                <span>Flat (-12)</span>
                <span className="text-indigo-500">0</span>
                <span>Sharp (+12)</span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                value={pitchSemitones}
                onChange={(e) => setPitchSemitones(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="mt-4 text-center">
                <span className="text-3xl font-bold text-white">{pitchSemitones > 0 ? '+' : ''}{pitchSemitones}</span>
                <span className="text-xs text-slate-500 ml-2">semitones</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex gap-2 mb-4">
              {[-5, -2, 0, 2, 5].map(val => (
                <button
                  key={val}
                  onClick={() => setPitchSemitones(val)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    pitchSemitones === val 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-[#18181b] text-slate-500 hover:text-slate-300 border border-white/5'
                  }`}
                >
                  {val > 0 ? '+' : ''}{val}
                </button>
              ))}
            </div>

            <button
              onClick={handleProcessPitch}
              disabled={!filePath || processing}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 className="animate-spin w-4 h-4" /> : <Music2 className="w-4 h-4" />}
              {processing ? 'Processing...' : t.apApplyPitch}
            </button>

            {pitchResult && pitchResult.output && (
              <div className="mt-3 p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{pitchResult.output.split(/[/\\]/).pop()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Smart Analysis */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.apAnalysis}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Tempo', value: tempoResult ? Math.round(tempoResult.tempo || 0) : null, unit: 'BPM', loading: loadingTempo, error: tempoResult?.error, action: handleDetectTempo, icon: Zap, color: 'text-emerald-400', borderColor: 'border-emerald-500/30', bgColor: 'bg-emerald-500/10' },
              { label: 'Key', value: keyResult?.key, unit: 'Key', loading: loadingKey, error: keyResult?.error, action: handleDetectKey, icon: Music2, color: 'text-purple-400', borderColor: 'border-purple-500/30', bgColor: 'bg-purple-500/10' }
            ].map((item, i) => (
              <div key={i} className={`bg-[#18181b] border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-white/10 transition-colors min-h-[120px] ${item.value ? item.bgColor : ''}`}>
                {item.loading ? (
                  <Loader2 className={`w-6 h-6 ${item.color} animate-spin`} />
                ) : item.error ? (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs text-red-400 font-bold">Error</span>
                    <button onClick={item.action} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : item.value ? (
                  <>
                    <div className="text-3xl font-bold text-white">{item.value}</div>
                    <div className={`text-[10px] font-bold uppercase ${item.color} mt-1`}>{item.unit}</div>
                  </>
                ) : (
                  <button 
                    onClick={item.action} 
                    disabled={!filePath} 
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity"
                  >
                    <div className={`w-10 h-10 rounded-xl ${item.bgColor} flex items-center justify-center`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="text-xs font-bold text-slate-300">Detect {item.label}</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Auto Analyze Button */}
          <button
            onClick={() => { handleDetectTempo(); handleDetectKey(); }}
            disabled={!filePath || loadingTempo || loadingKey}
            className="w-full mt-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            {(loadingTempo || loadingKey) ? <Loader2 className="animate-spin w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {(loadingTempo || loadingKey) ? 'Analyzing...' : 'Auto Analyze'}
          </button>

          <div className="mt-4 text-[10px] text-slate-600 text-center font-mono">
            Engine: Librosa • Python 3.11
          </div>
        </div>
      </div>
    </div>
  );
};