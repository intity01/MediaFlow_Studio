import React, { useState, useEffect } from 'react';
import { Download, Film, Music, Play, Search, CheckCircle2, Loader2, ArrowRight, List, Link as LinkIcon, AlertCircle, X, Plus, Trash2, Settings2, Sliders, ChevronDown, ChevronUp, RefreshCw, FolderOpen, ListVideo } from 'lucide-react';
import { VideoInfo, VideoFormat, DownloadType } from '../types';
import { mockService } from '../services/mockService';
import { useLanguage, useStatus } from '../App';
import { TauriWarning } from './TauriWarning';
import { isTauri } from '../utils/tauriHelper';
import { useToast } from '../context/ToastContext';
import { useOutputPaths, OutputFolderDisplay } from './FolderSetup';

interface BatchItem {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  title?: string;
  filename?: string;
  progress: number;
  errorMsg?: string;
  type?: DownloadType;
}

export const Downloader: React.FC = () => {
  const { t, settings } = useLanguage();
  const { setStatus } = useStatus();
  const paths = useOutputPaths();

  // Mode State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showSettings, setShowSettings] = useState(true);

  // Single Mode State
  const [url, setUrl] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const CONCURRENCY = 3; // max parallel downloads
  const [activeDownloads, setActiveDownloads] = useState(0);
  const { addToast } = useToast();

  // Batch Mode State
  const [batchInput, setBatchInput] = useState('');
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [processingBatch, setProcessingBatch] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [batchFilter, setBatchFilter] = useState<'all' | 'audio' | 'video'>('all');
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  // Configuration State
  const [downloadType, setDownloadType] = useState<DownloadType>(DownloadType.Video);
  const [audioQuality, setAudioQuality] = useState('320');
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [videoResolution, setVideoResolution] = useState('1080');
  const [videoFps, setVideoFps] = useState('60');
  const [videoContainer, setVideoContainer] = useState('mp4');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);

  // Auto-expand settings on desktop
  useEffect(() => {
    setShowSettings(true);
  }, []);

  const extractYouTubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Parse available formats from video info
  const getAvailableFormats = () => {
    if (!videoInfo?.formats) return { resolutions: ['1080', '720', '480'], fpsList: ['60', '30'], audioFormats: ['mp3', 'm4a', 'flac'] };
    
    const videoFormats = videoInfo.formats.filter(f => f.vcodec && f.vcodec !== 'none');
    const audioFormats = videoInfo.formats.filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
    
    // Extract unique resolutions (e.g., "1920x1080" -> "1080")
    const resolutions = [...new Set(
      videoFormats
        .map(f => f.resolution?.split('x')[1])
        .filter(Boolean)
        .map(r => parseInt(r!))
        .filter(r => r >= 360)
        .sort((a, b) => b - a)
        .map(r => r.toString())
    )];
    
    // Extract unique FPS values
    const fpsList = [...new Set(
      videoFormats
        .map(f => f.fps)
        .filter(Boolean)
        .map(f => Math.round(f!))
        .filter(f => f >= 24)
        .sort((a, b) => b - a)
        .map(f => f.toString())
    )];
    
    // Audio formats available
    const audioExts = [...new Set(audioFormats.map(f => f.ext).filter(Boolean))];
    
    return {
      resolutions: resolutions.length > 0 ? resolutions : ['1080', '720', '480'],
      fpsList: fpsList.length > 0 ? fpsList : ['60', '30'],
      audioFormats: audioExts.length > 0 ? audioExts : ['mp3', 'm4a', 'flac'],
      videoFormats,
      audioFormatsRaw: audioFormats
    };
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const availableFormats = getAvailableFormats();

  const applyAudioPreset = (format: string, quality: string) => {
    setAudioFormat(format);
    setAudioQuality(quality);
  };

  const formatStatusTitle = (title?: string | null) => {
    if (!title) return t.tabDownloader;
    return title.length > 40 ? `${title.slice(0, 37)}...` : title;
  };

  const handleGetInfo = async () => {
    if (!url) return;
    setLoadingInfo(true);
    setVideoInfo(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    setDownloadProgress(0);
    setStatus('Analyzing link...');
    try {
      const info = await mockService.getVideoInfo(url);
      setVideoInfo(info);
      setStatus(`Ready · ${formatStatusTitle(info.title)}`);
    } catch (e: any) {
      console.error('Get info error:', e);
      const errorMessage = e?.message || "Failed to resolve URL. Please check the URL and try again.";
      setErrorMsg(errorMessage);
      setStatus(`Error: ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`);
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo) return;

    // Check if Tauri backend is available
    if (!isTauri()) {
      setErrorMsg("Tauri backend not available. Please run the application using 'npm run tauri:dev' for full functionality.");
      setStatus('Error: Tauri backend required');
      addToast({ title: 'Backend missing', message: 'Run npm run tauri:dev for full features.', type: 'error' });
      return;
    }

    setDownloading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    setDownloadProgress(0);
    setStatus('Downloading media...');
    try {
      // Use folder based on download type (Audio or Video)
      const downloadPath = downloadType === DownloadType.Audio 
        ? paths.downloaderAudio 
        : paths.downloaderVideo;

      if (!downloadPath) {
        throw new Error('Please set output folder first.');
      }

      const filename = await mockService.downloadMedia(
        url,
        downloadType,
        {
          quality: audioQuality,
          resolution: videoResolution,
          fps: videoFps,
          includeAudio: includeAudio,
          audioFormat,
          container: videoContainer,
          downloadPath
        },
        (prog) => setDownloadProgress(prog)
      );
      // Extract just the filename from full path if it's a path
      const displayName = filename.includes('/') || filename.includes('\\')
        ? filename.split(/[/\\]/).pop() || filename
        : filename;
      setSuccessMsg(displayName);
      setDownloadProgress(100);
      setStatus('Ready');
      addToast({ type: 'success', title: 'Download Complete', message: `Saved ${displayName}` });
    } catch (e: any) {
      console.error('Download error:', e);
      const errorMessage = e?.message || "Download failed. Please check if yt-dlp is installed and on PATH.";
      setErrorMsg(errorMessage);
      setDownloadProgress(0);
      setStatus(`Error: ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`);
      addToast({ type: 'error', title: 'Download Failed', message: errorMessage });
    } finally {
      setDownloading(false);
    }
  };

  // Batch Handlers
  const addToBatch = () => {
    if (!batchInput.trim()) return;
    const urls = batchInput.split('\n').filter(u => u.trim().length > 0);
    const newItems: BatchItem[] = urls.map((u) => ({
      id: Math.random().toString(36).substr(2, 9),
      url: u.trim(),
      status: 'pending',
      progress: 0,
      type: downloadType
    }));
    setBatchQueue([...batchQueue, ...newItems]);
    setBatchInput('');
  };

  const clearQueue = () => {
    if (processingBatch) return;
    setBatchQueue([]);
    setCompletedCount(0);
  };

  // Import playlist - extract all video URLs from playlist
  const importPlaylist = async () => {
    const playlistUrl = batchInput.trim();
    if (!playlistUrl) return;
    
    // Check if it looks like a playlist URL
    if (!playlistUrl.includes('playlist') && !playlistUrl.includes('list=')) {
      addToast({ type: 'warning', title: 'Not a Playlist', message: 'Please enter a playlist URL (contains "list=" or "playlist")' });
      return;
    }

    setLoadingPlaylist(true);
    setStatus('Loading playlist...');
    try {
      const playlist = await mockService.getPlaylistInfo(playlistUrl);
      
      if (playlist.items.length === 0) {
        addToast({ type: 'warning', title: 'Empty Playlist', message: 'No videos found in this playlist' });
        return;
      }

      const newItems: BatchItem[] = playlist.items.map((item) => ({
        id: Math.random().toString(36).substr(2, 9),
        url: item.url,
        title: item.title,
        status: 'pending',
        progress: 0,
        type: downloadType
      }));

      setBatchQueue([...batchQueue, ...newItems]);
      setBatchInput('');
      setStatus(`Added ${playlist.items.length} videos from "${playlist.title}"`);
      addToast({ 
        type: 'success', 
        title: 'Playlist Imported', 
        message: `Added ${playlist.items.length} videos from "${playlist.title}"` 
      });
    } catch (e: any) {
      setStatus('Failed to load playlist');
      addToast({ type: 'error', title: 'Playlist Error', message: e?.message || 'Failed to load playlist' });
    } finally {
      setLoadingPlaylist(false);
    }
  };

  const processBatchQueue = async (itemsToProcess: BatchItem[], fullQueue: BatchItem[]) => {
    setProcessingBatch(true);
    let currentCompleted = fullQueue.filter(i => i.status === 'completed').length;
    setCompletedCount(currentCompleted);
    setStatus(`Processing batch: ${itemsToProcess.length} items`);

    const updatedQueue = fullQueue.map(item => {
      const isTarget = itemsToProcess.some(t => t.id === item.id);
      return isTarget ? { ...item, status: 'pending' as const, progress: 0, errorMsg: undefined } : item;
    });
    setBatchQueue(updatedQueue);

    const downloadItem = async (itemId: string, itemUrl: string) => {
      setBatchQueue(prev => prev.map(item => item.id === itemId ? { ...item, status: 'processing' } : item));
      try {
        const info = await mockService.getVideoInfo(itemUrl);
        setBatchQueue(prev => prev.map(item => item.id === itemId ? { ...item, title: info.title } : item));

        const currentItem = updatedQueue.find(i => i.id === itemId);
        const itemType = currentItem?.type || downloadType;

        // Use folder based on item type
        const downloadPath = itemType === DownloadType.Audio 
          ? paths.downloaderAudio 
          : paths.downloaderVideo;

        await mockService.downloadMedia(
          itemUrl,
          itemType,
          {
            quality: audioQuality,
            resolution: videoResolution,
            fps: videoFps,
            includeAudio: includeAudio,
            audioFormat,
            container: videoContainer,
            downloadPath: downloadPath || ''
          },
          (prog) => {
            setBatchQueue(prev => prev.map(item => item.id === itemId ? { ...item, progress: prog } : item));
          }
        );
        setBatchQueue(prev => prev.map(item => item.id === itemId ? { ...item, status: 'completed', progress: 100 } : item));
        setCompletedCount(prev => prev + 1);
        addToast({ type: 'success', title: 'Batch Item Finished', message: info.title });
      } catch (error: any) {
        setBatchQueue(prev => prev.map(item => item.id === itemId ? { ...item, status: 'error', errorMsg: error?.message || t.dlStatusError } : item));
        addToast({ type: 'error', title: 'Batch Item Failed', message: error?.message || 'Unknown error' });
      }
    };

    const pendingItems = updatedQueue.filter(i => i.status === 'pending');
    const pool: Promise<void>[] = [];

    for (const item of pendingItems) {
      const p = downloadItem(item.id, item.url).then(() => {
        pool.splice(pool.indexOf(p), 1);
      });
      pool.push(p);
      if (pool.length >= CONCURRENCY) {
        await Promise.race(pool);
      }
    }
    await Promise.all(pool);

    setStatus(`Batch processing finished`);
    setProcessingBatch(false);
  };

  const handleBatchProcess = async () => {
    if (batchQueue.length === 0 || processingBatch) return;
    const itemsToProcess = batchQueue.filter(item => item.status !== 'completed');
    if (itemsToProcess.length === 0) {
      processBatchQueue(batchQueue, batchQueue);
    } else {
      processBatchQueue(itemsToProcess, batchQueue);
    }
  };

  const handleRetryFailed = async () => {
    const failedItems = batchQueue.filter(item => item.status === 'error');
    if (failedItems.length === 0 || processingBatch) return;
    processBatchQueue(failedItems, batchQueue);
  };

  const handleRetryItem = (id: string) => {
    const itemToRetry = batchQueue.find(i => i.id === id);
    if (!itemToRetry || processingBatch) return;
    processBatchQueue([itemToRetry], batchQueue);
  };

  const youtubeId = videoInfo ? extractYouTubeID(url) : null;
  const totalProgress = batchQueue.length > 0 ? (completedCount / batchQueue.length) * 100 : 0;
  const filteredQueue = batchFilter === 'all' ? batchQueue : batchQueue.filter(i => i.type === (batchFilter === 'audio' ? DownloadType.Audio : DownloadType.Video));
  const hasErrors = batchQueue.some(item => item.status === 'error');

  return (
    <div className="space-y-4">
      {!isTauri() && (
        <TauriWarning />
      )}

      {/* Settings / Mode Panel */}
      <div className="bg-[#121214] rounded-2xl border border-white/5 overflow-hidden">
        {/* Output Folder Display */}
        <div className="p-3 border-b border-white/5 bg-[#18181b]">
          <OutputFolderDisplay />
        </div>
        {/* Top Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#18181b]">
          <div className="flex items-center gap-4">
            <div className="flex bg-[#09090b] p-0.5 rounded-lg border border-white/10">
              <button onClick={() => setIsBatchMode(false)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!isBatchMode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {t.dlSingleMode}
              </button>
              <button onClick={() => setIsBatchMode(true)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isBatchMode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {t.dlBatchMode}
              </button>
            </div>
            <div className="h-6 w-px bg-white/10 mx-2"></div>
            <div className="flex bg-[#09090b] p-0.5 rounded-lg border border-white/10">
              <button onClick={() => setDownloadType(DownloadType.Audio)} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${downloadType === DownloadType.Audio ? 'bg-pink-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                <Music className="w-3 h-3" /> {t.dlAudio}
              </button>
              <button onClick={() => setDownloadType(DownloadType.Video)} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${downloadType === DownloadType.Video ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                <Film className="w-3 h-3" /> {t.dlVideo}
              </button>
            </div>
          </div>

          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}>
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsible Settings */}
        {showSettings && (
          <div className="p-3 bg-[#0e0e10]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {downloadType === DownloadType.Audio ? (
                <>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">{t.dlFormat}</label>
                    <select value={audioFormat} onChange={(e) => setAudioFormat(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500">
                      <option value="mp3">MP3</option>
                      <option value="m4a">M4A</option>
                      <option value="flac">FLAC</option>
                      <option value="wav">WAV</option>
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">{t.dlQuality}</label>
                    <select value={audioQuality} onChange={(e) => setAudioQuality(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500">
                      <option value="128">128 kbps</option>
                      <option value="320">320 kbps</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">{t.dlPresets}</label>
                    <div className="flex gap-2">
                      <button onClick={() => applyAudioPreset('mp3', '320')} className="px-3 py-2 rounded-lg bg-[#18181b] hover:bg-[#27272a] border border-white/10 text-xs font-medium text-slate-300">MP3 320k</button>
                      <button onClick={() => applyAudioPreset('flac', '0')} className="px-3 py-2 rounded-lg bg-[#18181b] hover:bg-[#27272a] border border-white/10 text-xs font-medium text-slate-300">FLAC Lossless</button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">{t.dlContainer}</label>
                    <select value={videoContainer} onChange={(e) => setVideoContainer(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500">
                      <option value="mp4">MP4</option>
                      <option value="mkv">MKV</option>
                      <option value="webm">WebM</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1">
                      {t.dlResolution}
                      {videoInfo?.formats && <span className="text-emerald-500 text-[8px]">• detected</span>}
                    </label>
                    <select value={videoResolution} onChange={(e) => setVideoResolution(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500">
                      {availableFormats.resolutions.map(res => (
                        <option key={res} value={res}>{res}p {parseInt(res) >= 2160 ? '(4K)' : parseInt(res) >= 1440 ? '(2K)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1">
                      {t.dlFps}
                      {videoInfo?.formats && <span className="text-emerald-500 text-[8px]">• detected</span>}
                    </label>
                    <select value={videoFps} onChange={(e) => setVideoFps(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500">
                      {availableFormats.fpsList.map(fps => (
                        <option key={fps} value={fps}>{fps} FPS</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">{t.dlIncludeAudio}</label>
                    <button onClick={() => setIncludeAudio(!includeAudio)} className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 ${includeAudio ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' : 'bg-[#18181b] border-white/10 text-slate-400'}`}>
                      <div className={`w-3 h-3 rounded-full border ${includeAudio ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}></div>
                      Yes
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Single Mode Content */}
      {!isBatchMode && (
        <div className="space-y-4">
          <div className="relative group">
            <div className="flex items-center bg-[#121214] rounded-xl p-1.5 border border-white/10 focus-within:border-indigo-500/50 transition-colors shadow-lg">
              <div className="pl-3 pr-2 text-slate-500">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGetInfo()}
                placeholder={t.dlPlaceholder}
                className="block w-full bg-transparent border-none focus:ring-0 text-slate-100 placeholder-slate-600 text-sm py-2.5 font-medium"
              />
              {url && (
                <button onClick={() => setUrl('')} className="p-1.5 text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleGetInfo}
                disabled={loadingInfo || !url}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md ml-1"
              >
                {loadingInfo ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{t.dlGetInfo}</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${errorMsg.includes('Tauri backend not available') || errorMsg.includes('npm run tauri:dev')
              ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <span>{errorMsg}</span>
                {errorMsg.includes('Tauri backend not available') && (
                  <div className="mt-2 text-xs text-yellow-300/80">
                    💡 Tip: Run <code className="bg-yellow-500/20 px-1.5 py-0.5 rounded font-mono">npm run tauri:dev</code> for full functionality
                  </div>
                )}
              </div>
            </div>
          )}

          {videoInfo && !errorMsg && (
            <div className="bg-[#121214] rounded-xl border border-white/5 overflow-hidden flex flex-col md:flex-row shadow-xl animate-fade-in-up">
              <div className="md:w-64 lg:w-80 bg-black relative flex-shrink-0 group overflow-hidden">
                {youtubeId ? (
                  <iframe
                    className="w-full h-full aspect-video md:aspect-auto md:absolute inset-0 border-0"
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&modestbranding=1&controls=1`}
                    title="YouTube video player"
                    allowFullScreen
                    style={{ border: 'none' }}
                  ></iframe>
                ) : (
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full h-full object-cover opacity-80"
                  />
                )}
              </div>

              <div className="p-5 flex flex-col justify-center flex-1">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{videoInfo.title}</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">{videoInfo.uploader}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                    <span className="text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      {downloadType === DownloadType.Audio ? audioFormat.toUpperCase() : `${videoContainer.toUpperCase()} ${videoResolution}p`}
                    </span>
                  </div>
                </div>

                {downloading && (
                  <div className="mb-4 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>{t.dlDownloading}</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-150" style={{ width: `${downloadProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Available Formats Summary */}
                {videoInfo.formats && videoInfo.formats.length > 0 && (
                  <div className="mb-4 p-2 bg-[#18181b] rounded-lg border border-white/5">
                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-2">Available Quality</div>
                    <div className="flex flex-wrap gap-1">
                      {availableFormats.resolutions.slice(0, 5).map(res => (
                        <span key={res} className={`px-2 py-0.5 rounded text-[10px] font-mono ${videoResolution === res ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400'}`}>
                          {res}p
                        </span>
                      ))}
                      {availableFormats.fpsList.slice(0, 3).map(fps => (
                        <span key={fps} className={`px-2 py-0.5 rounded text-[10px] font-mono ${videoFps === fps ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                          {fps}fps
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-auto">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all active:scale-95 ${downloading ? 'bg-slate-700 text-slate-400' :
                      downloadType === DownloadType.Audio ? 'bg-pink-600 hover:bg-pink-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                  >
                    {downloading ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {t.dlDownloadBtn}
                  </button>
                </div>

                {successMsg && (
                  <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">Download complete</div>
                        <div className="text-emerald-500/70 truncate font-mono text-[10px] mt-0.5">{successMsg}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch Mode Content */}
      {isBatchMode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)]">
          {/* Batch Input */}
          <div className="lg:col-span-1 flex flex-col h-full bg-[#121214] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-3 border-b border-white/5 bg-[#18181b] flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <LinkIcon className="w-3 h-3" /> Source Links
              </label>
            </div>
            <textarea
              className="flex-1 bg-[#09090b] p-4 text-xs font-mono text-slate-300 focus:outline-none resize-none"
              placeholder={t.dlBatchPlaceholder}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              disabled={processingBatch}
            />
            <div className="p-3 border-t border-white/5 bg-[#18181b] space-y-2">
              <button
                onClick={addToBatch}
                disabled={processingBatch || !batchInput.trim()}
                className="w-full py-2 rounded-lg font-bold text-xs bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add URLs to Queue
              </button>
              <button
                onClick={importPlaylist}
                disabled={processingBatch || loadingPlaylist || !batchInput.trim()}
                className="w-full py-2 rounded-lg font-bold text-xs bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loadingPlaylist ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ListVideo className="w-3.5 h-3.5" />
                )}
                Import Playlist
              </button>
            </div>
          </div>

          {/* Queue */}
          <div className="lg:col-span-2 flex flex-col h-full bg-[#121214] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
            <div className="p-3 border-b border-white/5 bg-[#18181b] flex items-center justify-between">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <List className="w-4 h-4 text-indigo-400" />
                Queue
                <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[10px] font-mono">
                  {filteredQueue.length}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex bg-[#09090b] p-0.5 rounded-md border border-white/10">
                  {(['all', 'audio', 'video'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setBatchFilter(f)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${batchFilter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {hasErrors && !processingBatch && (
                  <button onClick={handleRetryFailed} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:text-red-300" title="Retry Errors"><RefreshCw className="w-3.5 h-3.5" /></button>
                )}
                {!processingBatch && batchQueue.length > 0 && (
                  <button onClick={clearQueue} className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
                <button
                  onClick={handleBatchProcess}
                  disabled={processingBatch || batchQueue.length === 0}
                  className="ml-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  {processingBatch ? <Loader2 className="animate-spin w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                  {processingBatch ? 'Working...' : 'Start'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0c0c0e] p-2 space-y-2">
              {filteredQueue.map((item, idx) => (
                <div key={item.id} className="group relative bg-[#18181b] border border-white/5 rounded-lg p-3 hover:border-white/10 transition-colors">
                  {item.status === 'processing' && (
                    <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-500 transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${item.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      item.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        item.status === 'processing' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                          'bg-slate-800 border-slate-700 text-slate-500'
                      }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className={`text-xs font-bold truncate ${item.status === 'completed' ? 'text-emerald-400' : item.status === 'error' ? 'text-red-400' : 'text-slate-200'}`}>
                          {item.title || item.url}
                        </h4>
                        <span className="text-[9px] font-mono text-slate-600 uppercase ml-2">{item.type || 'MEDIA'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{item.url}</span>
                        {item.status === 'error' && (
                          <button onClick={() => handleRetryItem(item.id)} className="text-[9px] text-indigo-400 hover:underline flex items-center gap-1">Retry</button>
                        )}
                        {item.status === 'completed' && <span className="text-[9px] text-emerald-500">Saved</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredQueue.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-700">
                  <List className="w-8 h-8 mb-2 opacity-20" />
                  <span className="text-xs font-medium">List is empty</span>
                </div>
              )}
            </div>

            {processingBatch && (
              <div className="bg-[#121214] p-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Batch Progress</span>
                <span className="font-mono text-indigo-400">{Math.round(totalProgress)}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};