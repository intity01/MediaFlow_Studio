import React, { useState, useEffect } from 'react';
import { Layers, Upload, Loader2, Check, Sparkles, Mic2, Music4, Disc, Activity, Sliders, Settings, Zap, Cpu, Server, Play, Pause, Volume2, VolumeX, Share2, FolderOpen } from 'lucide-react';
import { mockService } from '../services/mockService';
import { StemSeparationResult } from '../types';
import { useLanguage, useStatus } from '../App';
import { useToast } from '../context/ToastContext';
import { MiniPlayer } from './MiniPlayer';
import { useOutputPaths, OutputFolderDisplay } from './FolderSetup';

import { isTauri } from '../utils/tauriHelper';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';

type Architecture = 'vr' | 'mdx' | 'demucs';

interface StemState {
    volume: number;
    muted: boolean;
    soloed: boolean;
    playing: boolean;
}

export const StemSeparator: React.FC = () => {
    const { t, settings } = useLanguage();
    const { addToast } = useToast();
    const { setStatus } = useStatus();
    const paths = useOutputPaths();

    const [fileName, setFileName] = useState<string | null>(null);
    const [filePath, setFilePath] = useState<string | null>(null);
    const [stemCount, setStemCount] = useState<2 | 4 | 6>(4);
    const [outputMode, setOutputMode] = useState<'all' | 'vocals' | 'instrumental' | 'drums' | 'bass' | 'other'>('all');
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<StemSeparationResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Mixer State (BandMates Inspired)
    const [masterPlaying, setMasterPlaying] = useState(false);
    const [stemStates, setStemStates] = useState<Record<string, StemState>>({});
    const [masterTime, setMasterTime] = useState<number | undefined>(undefined);

    // UVR5 Inspired Settings
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [architecture, setArchitecture] = useState<Architecture>('demucs');
    const [modelName, setModelName] = useState('htdemucs');
    const [windowSize, setWindowSize] = useState('512');
    const [aggression, setAggression] = useState(5);
    const [tta, setTta] = useState(false);
    const [exportFormat, setExportFormat] = useState<'wav' | 'mp3' | 'flac'>('wav');
    
    // GPU setting from app settings
    const gpuAcceleration = settings.useGpu ?? true;

    // Listen for Tauri drag-drop events
    useEffect(() => {
        if (!isTauri()) return;

        const unlisten = listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
            console.log('[StemSeparator] Tauri drag-drop event:', event.payload);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
                const path = paths[0];
                const ext = path.split('.').pop()?.toLowerCase();
                const audioExts = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma'];
                if (ext && audioExts.includes(ext)) {
                    const name = path.split(/[/\\]/).pop() || 'audio';
                    setFileName(name);
                    setFilePath(path);
                    setResult(null);
                    setProgress(0);
                    setMasterPlaying(false);
                    setStemStates({});
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
                setResult(null);
                setProgress(0);
                setMasterPlaying(false);
                setStemStates({});
                setStatus(`Ready · ${name}`);
                console.log('[StemSeparator] Selected file:', selected);
            }
        } catch (error: any) {
            console.error('[StemSeparator] File picker error:', error);
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
        console.log('[StemSeparator] HTML drop event - Tauri will handle via event listener');
    };

    const handleSeparation = async () => {
        if (!filePath) return;
        setProcessing(true);
        setProgress(0);
        setStemStates({}); // Reset mixer
        try {
            const modeLabel = outputMode === 'all' ? `${stemCount} tracks` : outputMode;
            setStatus(`Separating stems (${modeLabel}, ${exportFormat.toUpperCase()})...`);
            console.log('[StemSeparator] Starting separation for:', filePath, 'mode:', outputMode);
            
            // Use stem splitter folder
            const outputFolder = paths.stemSplitter || undefined;
            
            // Auto-select model based on stem count
            let effectiveModel = modelName;
            if (stemCount === 6 && architecture === 'demucs') {
                effectiveModel = 'htdemucs_6s';
            }
            
            const res = await mockService.separateStems(
                filePath,
                stemCount === 6 ? 4 : stemCount, // Backend uses 4 for 6-stem model
                exportFormat,
                outputFolder,
                (prog) => {
                    setProgress(prog);
                    setStatus(`Processing: ${prog}%`);
                },
                effectiveModel,
                gpuAcceleration
            );

            // Filter stems based on outputMode
            let filteredStems = res.stems;
            if (outputMode !== 'all') {
                filteredStems = res.stems.filter(stem => {
                    const lower = stem.toLowerCase();
                    switch (outputMode) {
                        case 'vocals': return lower.includes('vocal');
                        case 'instrumental': return !lower.includes('vocal');
                        case 'drums': return lower.includes('drum');
                        case 'bass': return lower.includes('bass');
                        case 'other': return lower.includes('other');
                        default: return true;
                    }
                });
            }

            // Initialize Mixer State for filtered stems
            const initialStates: Record<string, StemState> = {};
            filteredStems.forEach(stem => {
                initialStates[stem] = { volume: 80, muted: false, soloed: false, playing: false };
            });
            setStemStates(initialStates);

            setResult({ ...res, stems: filteredStems, count: filteredStems.length });
            setStatus(`Complete · ${filteredStems.length} stems separated`);
            addToast({ type: 'success', title: t.ssSuccess, message: `${t.apSaved}: ${filteredStems.length} stems` });
        } catch (e: any) {
            console.error('[StemSeparator] Error:', e);
            setStatus(`Error: ${e?.message || 'Stem separation failed'}`);
            addToast({ type: 'error', title: t.ssError, message: e?.message || 'Separation failed' });
        } finally {
            setProcessing(false);
        }
    };

    const handleShare = async (path: string) => {
        const text = `Check out this stem: ${path.split('/').pop()}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'MediaFlow Stem', text, url: window.location.href });
            } catch (err) { console.error(err); }
        } else {
            await navigator.clipboard.writeText(path);
            addToast({ type: 'info', title: t.ssCopied, message: "Path copied to clipboard" });
        }
    };

    // Mixer Logic
    const toggleMute = (stem: string) => {
        setStemStates(prev => ({
            ...prev,
            [stem]: { ...prev[stem], muted: !prev[stem].muted }
        }));
    };

    const toggleSolo = (stem: string) => {
        // Toggle solo for this stem, handled in audio logic by checking if ANY are soloed
        setStemStates(prev => ({
            ...prev,
            [stem]: { ...prev[stem], soloed: !prev[stem].soloed }
        }));
    };

    const setVolume = (stem: string, val: number) => {
        setStemStates(prev => ({
            ...prev,
            [stem]: { ...prev[stem], volume: val }
        }));
    };

    const toggleStemPlay = (stem: string) => {
        setStemStates(prev => ({
            ...prev,
            [stem]: { ...prev[stem], playing: !prev[stem].playing }
        }));
    };

    // Master play toggles all stems
    const handleMasterPlay = () => {
        const newPlaying = !masterPlaying;
        setMasterPlaying(newPlaying);
        setStemStates(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                updated[key] = { ...updated[key], playing: newPlaying };
            });
            return updated;
        });
    };

    // Sync seek across all stems - ONLY when master is playing
    const handleStemSeek = (time: number) => {
        // Only sync if master play is active (all stems playing together)
        if (masterPlaying) {
            setMasterTime(time);
            // Reset after a short delay to allow sync
            setTimeout(() => setMasterTime(undefined), 100);
        }
        // If not master playing, each stem seeks independently (no sync)
    };

    const getStemStyle = (filename: string) => {
        const lower = filename.toLowerCase();
        if (lower.includes('vocal')) return { icon: Mic2, color: 'text-pink-400', bg: 'bg-pink-500/10' };
        if (lower.includes('drum')) return { icon: Disc, color: 'text-blue-400', bg: 'bg-blue-500/10' };
        if (lower.includes('bass')) return { icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' };
        return { icon: Music4, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    };

    // Check if any track is soloed
    const isAnySolo = Object.values<StemState>(stemStates).some((s) => s.soloed);

    // Models - organized by use case and VRAM requirement
    const getModels = () => {
        switch (architecture) {
            case 'demucs': return [
                'htdemucs_ft',           // 4 stems (6GB+ VRAM)
                'htdemucs_6s',           // 6 stems (8GB+ VRAM)
            ];
            case 'mdx': return [
                'MDX23C',                // Balanced - แนะนำ (4GB+)
                'BS-Roformer-Viperx',    // Best quality (8GB+)
                'UVR-MDX-NET-Inst_HQ_4', // Fast (2GB+)
            ];
            case 'vr': return [
                'Kim_Vocal_2',           // Best vocals
                'UVR-DeEcho-DeReverb',   // ลบเสียงก้อง
            ];
            default: return ['MDX23C'];
        }
    };
    
    const isArchitectureAvailable = true;

    return (
        <div className="pb-10 space-y-6">

            {/* Output Folder Display */}
            <div className="bg-[#121214] rounded-xl border border-white/5 p-3">
                <OutputFolderDisplay />
            </div>

            {/* File Upload Area */}
            <div
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center mb-6 transition-all duration-200 group overflow-hidden cursor-pointer
          ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : (filePath ? 'border-emerald-500/20 bg-[#121214]' : 'border-slate-800 bg-[#121214] hover:border-slate-600')}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleSelectFile}
            >
                <div className="flex flex-col items-center justify-center gap-3 relative z-10">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${filePath ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
                        {filePath ? <Check className="w-6 h-6" /> : <FolderOpen className="w-6 h-6" />}
                    </div>
                    <div>
                        {filePath ? (
                            <>
                                <h3 className="text-sm font-bold text-white">{fileName}</h3>
                                <p className="text-[10px] text-emerald-400 font-mono mt-1">Ready to separate</p>
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

            <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* Main Settings Panel */}
                <div className="w-full lg:w-2/3 space-y-6">
                    <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl relative">

                        {/* Header / Mode Switch */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.ssModel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsBatchMode(!isBatchMode)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${isBatchMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
                                    <Server className="w-3 h-3" /> {t.ssBatch}
                                </button>
                                <button onClick={() => setShowAdvanced(!showAdvanced)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${showAdvanced ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
                                    <Settings className="w-3 h-3" /> {t.ssAdvanced}
                                </button>
                            </div>
                        </div>

                        {/* Architecture Selector (UVR Style) */}
                        <div className="grid grid-cols-3 gap-2 mb-6 p-1 bg-[#09090b] rounded-xl border border-white/5">
                            {(['demucs', 'mdx', 'vr'] as Architecture[]).map(arch => (
                                <button
                                    key={arch}
                                    onClick={() => setArchitecture(arch)}
                                    className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${architecture === arch
                                        ? 'bg-emerald-600 text-white shadow-lg'
                                        : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    {arch === 'vr' ? 'VR Arch' : arch === 'mdx' ? 'MDX-Net' : 'Demucs'}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {/* Model Dropdown */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                                    <span>Selected Model</span>
                                    <span className="text-emerald-500/50">v5.0.2</span>
                                </label>
                                <select
                                    value={modelName}
                                    onChange={(e) => setModelName(e.target.value)}
                                    className="w-full bg-[#18181b] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500 transition-colors"
                                >
                                    {getModels().map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            {/* Stems Choice */}
                            <div className="grid grid-cols-3 gap-2">
                                {[2, 4, 6].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setStemCount(num as 2 | 4 | 6)}
                                        className={`relative p-2.5 rounded-xl border text-left transition-all ${stemCount === num ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-[#18181b] hover:border-white/10'}`}
                                    >
                                        <h4 className={`font-bold text-sm ${stemCount === num ? 'text-white' : 'text-slate-400'}`}>
                                            {num === 2 ? t.ss2Stems : num === 4 ? t.ss4Stems : '6 Stems'}
                                        </h4>
                                        <p className="text-[9px] text-slate-500 font-medium">
                                            {num === 2 ? 'Vocals / Music' : num === 4 ? 'Full Band' : '+ Piano/Guitar'}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            {/* Output Mode - Extract specific stems */}
                            <div className="mt-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Output Mode</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'all', label: 'All Stems', icon: Layers, desc: 'Export all' },
                                        { id: 'vocals', label: 'Vocals Only', icon: Mic2, desc: 'Voice track' },
                                        { id: 'instrumental', label: 'Instrumental', icon: Music4, desc: 'No vocals' },
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setOutputMode(mode.id as any)}
                                            className={`p-2 rounded-lg border text-center transition-all ${outputMode === mode.id ? 'border-pink-500 bg-pink-500/10' : 'border-white/5 bg-[#18181b] hover:border-white/10'}`}
                                        >
                                            <mode.icon className={`w-4 h-4 mx-auto mb-1 ${outputMode === mode.id ? 'text-pink-400' : 'text-slate-500'}`} />
                                            <div className={`text-[10px] font-bold ${outputMode === mode.id ? 'text-white' : 'text-slate-400'}`}>{mode.label}</div>
                                        </button>
                                    ))}
                                </div>
                                {stemCount >= 4 && (
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        {[
                                            { id: 'drums', label: 'Drums Only', icon: Disc },
                                            { id: 'bass', label: 'Bass Only', icon: Activity },
                                            { id: 'other', label: 'Other', icon: Music4 },
                                        ].map(mode => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setOutputMode(mode.id as any)}
                                                className={`p-2 rounded-lg border text-center transition-all ${outputMode === mode.id ? 'border-purple-500 bg-purple-500/10' : 'border-white/5 bg-[#18181b] hover:border-white/10'}`}
                                            >
                                                <mode.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${outputMode === mode.id ? 'text-purple-400' : 'text-slate-500'}`} />
                                                <div className={`text-[9px] font-bold ${outputMode === mode.id ? 'text-white' : 'text-slate-400'}`}>{mode.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Advanced UVR Params */}
                        {showAdvanced && (
                            <div className="mt-6 pt-6 border-t border-white/5 animate-fade-in-up">
                                <div className="grid grid-cols-2 gap-5 mb-4">
                                    {/* Architecture Specific Settings */}
                                    {architecture === 'vr' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t.ssWindowSize}</label>
                                            <select value={windowSize} onChange={(e) => setWindowSize(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-2 py-2 text-xs text-slate-200">
                                                <option value="320">320</option>
                                                <option value="512">512</option>
                                                <option value="1024">1024</option>
                                            </select>
                                        </div>
                                    )}

                                    {architecture === 'vr' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                                                <span>{t.ssAggression}</span>
                                                <span className="text-emerald-400">{aggression}</span>
                                            </label>
                                            <input type="range" min="1" max="20" value={aggression} onChange={(e) => setAggression(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-emerald-500" />
                                        </div>
                                    )}

                                    {architecture === 'mdx' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t.ssSegmentSize}</label>
                                            <select className="w-full bg-[#18181b] border border-white/10 rounded-lg px-2 py-2 text-xs text-slate-200">
                                                <option value="256">256 (Fast)</option>
                                                <option value="512">512 (Balanced)</option>
                                                <option value="1024">1024 (Quality)</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t.ssExportFormat}</label>
                                        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-2 py-2 text-xs text-slate-200">
                                            <option value="wav">WAV (PCM)</option>
                                            <option value="flac">FLAC</option>
                                            <option value="mp3">MP3 320k</option>
                                        </select>
                                    </div>
                                </div>

                                {/* GPU Status & TTA Toggle */}
                                <div className="flex gap-4">
                                    {/* GPU Status (read-only, configured in Settings) */}
                                    <div className={`flex-1 flex items-center justify-between p-3 rounded-lg border ${gpuAcceleration ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#18181b] border-white/5'}`}>
                                        <div className="flex items-center gap-2">
                                            <Cpu className={`w-4 h-4 ${gpuAcceleration ? 'text-emerald-400' : 'text-slate-500'}`} />
                                            <div className="text-left">
                                                <div className={`text-xs font-bold ${gpuAcceleration ? 'text-white' : 'text-slate-400'}`}>{gpuAcceleration ? 'GPU' : 'CPU'}</div>
                                                <div className="text-[9px] text-slate-600">Settings → AI</div>
                                            </div>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${gpuAcceleration ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}></div>
                                    </div>

                                    <button onClick={() => setTta(!tta)} className={`flex-1 flex items-center justify-between p-3 rounded-lg border transition-all ${tta ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-[#18181b] border-white/5'}`}>
                                        <div className="flex items-center gap-2">
                                            <Zap className={`w-4 h-4 ${tta ? 'text-indigo-400' : 'text-slate-500'}`} />
                                            <div className="text-left">
                                                <div className={`text-xs font-bold ${tta ? 'text-white' : 'text-slate-400'}`}>{t.ssTTA}</div>
                                                <div className="text-[9px] text-slate-600">High Quality</div>
                                            </div>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${tta ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-700'}`}></div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    {!result && (
                        <button
                            onClick={handleSeparation}
                            disabled={!filePath || processing}
                            className="w-full py-4 rounded-2xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20"
                        >
                            {processing ? <Loader2 className="animate-spin w-5 h-5" /> : <Layers className="w-5 h-5" />}
                            {processing ? t.ssBtnProcessing : t.ssBtn}
                        </button>
                    )}

                    {/* Processing Bar */}
                    {processing && (
                        <div className="p-4 bg-[#121214] rounded-xl border border-white/5">
                            <div className="flex justify-between items-center mb-2 text-xs">
                                <span className="text-emerald-400 font-bold animate-pulse">{t.ssProcessing}</span>
                                <span className="font-mono text-white">{progress}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-300 relative overflow-hidden" style={{ width: `${progress}%` }}>
                                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 text-center font-mono">
                                Running {modelName} on GPU [0]...
                            </p>
                        </div>
                    )}
                </div>

                {/* Results Panel / Mixer */}
                <div className="w-full lg:w-1/3">
                    {result && !processing ? (
                        <div className="bg-[#121214] border border-white/5 rounded-2xl p-4 shadow-xl animate-fade-in-up h-full flex flex-col">

                            {/* Mixer Header */}
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                                <div className="flex flex-col">
                                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                        <Sliders className="w-4 h-4 text-emerald-400" /> {t.ssMixer}
                                    </h3>
                                    <span className="text-[10px] text-slate-500">{result.count} Stems • {exportFormat.toUpperCase()}</span>
                                </div>
                                <button
                                    onClick={handleMasterPlay}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${masterPlaying ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    title={t.ssMaster}
                                >
                                    {masterPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                </button>
                            </div>

                            <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                                {result.stems.map((stemPath, index) => {
                                    const stemName = stemPath.split(/[/\\]/).pop();
                                    if (!stemName) return null;
                                    const style = getStemStyle(stemName);
                                    const Icon = style.icon;
                                    const state = stemStates[stemPath] || { volume: 80, muted: false, soloed: false };

                                    // Calculate effective mute state (if another track is soloed, mute this one unless it is also soloed)
                                    const isEffectivelyMuted = state.muted || (isAnySolo && !state.soloed);

                                    return (
                                        <div key={index} className="bg-[#18181b] rounded-xl border border-white/5 p-3 hover:border-white/10 transition-colors">
                                            {/* Track Header */}
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`p-1.5 rounded-lg ${style.bg}`}><Icon className={`w-3.5 h-3.5 ${style.color}`} /></div>
                                                <div className={`font-bold text-xs capitalize truncate flex-1 ${style.color}`}>{stemName.replace(/_/g, ' ')}</div>

                                                {/* Mute/Solo Buttons */}
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => toggleMute(stemPath)}
                                                        className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${state.muted ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-[#0c0c0e] border-white/5 text-slate-500 hover:text-slate-300'}`}
                                                        title="Mute"
                                                    >
                                                        {t.ssMute}
                                                    </button>
                                                    <button
                                                        onClick={() => toggleSolo(stemPath)}
                                                        className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${state.soloed ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-[#0c0c0e] border-white/5 text-slate-500 hover:text-slate-300'}`}
                                                        title="Solo"
                                                    >
                                                        {t.ssSolo}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Player & Visualizer */}
                                            <MiniPlayer
                                                src={stemPath}
                                                externalPlaying={state.playing}
                                                onPlayToggle={() => {
                                                    // If clicking individual stem play, turn off master mode
                                                    if (masterPlaying) {
                                                        setMasterPlaying(false);
                                                    }
                                                    toggleStemPlay(stemPath);
                                                }}
                                                volume={state.volume}
                                                muted={isEffectivelyMuted}
                                                syncTime={masterPlaying ? masterTime : undefined}
                                                onSeek={handleStemSeek}
                                            />

                                            {/* Volume Slider */}
                                            <div className="mt-2 flex items-center gap-2">
                                                {isEffectivelyMuted ? <VolumeX className="w-3 h-3 text-slate-600" /> : <Volume2 className="w-3 h-3 text-slate-400" />}
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={state.volume}
                                                    onChange={(e) => setVolume(stemPath, parseInt(e.target.value))}
                                                    className="flex-1 h-1 bg-slate-700 rounded-full appearance-none accent-slate-400"
                                                />
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 mt-3 pt-2 border-t border-white/5">
                                                <button onClick={() => addToast({ type: 'success', title: 'Saved', message: `Saved to ${settings.downloadPath}` })} className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition-colors flex items-center justify-center gap-1.5">
                                                    <Upload className="w-3 h-3" /> Save
                                                </button>
                                                <button onClick={() => handleShare(stemPath)} className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                                                    <Share2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <button onClick={() => { setResult(null); setFileName(null); setFilePath(null); setMasterTime(undefined); }} className="w-full py-3 text-xs font-bold text-slate-500 hover:text-white mt-4 border border-dashed border-slate-800 rounded-xl hover:border-slate-600 transition-all">
                                Process Another File
                            </button>
                        </div>
                    ) : (
                        <div className="h-full bg-[#121214] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                            <Layers className="w-12 h-12 text-slate-700 mb-4" />
                            <p className="text-sm font-bold text-slate-500">No active separation</p>
                            <p className="text-xs text-slate-600 mt-2 max-w-[200px]">Upload a file and configure parameters to see results here.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};