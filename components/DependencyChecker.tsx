import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Terminal, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/tauriHelper';

interface DependencyStatus {
    available: boolean;
    version: string | null;
    error: string | null;
}

interface DependenciesResult {
    yt_dlp: DependencyStatus;
    python: DependencyStatus;
    ffmpeg: DependencyStatus;
}

export const DependencyChecker: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [dependencies, setDependencies] = useState<DependenciesResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        checkDependencies();
    }, []);

    const checkDependencies = async () => {
        // Only check if Tauri is available
        if (isTauri()) {
            try {
                const result = await invoke('check_dependencies');
                const data = typeof result === 'string' ? JSON.parse(result) : result;
                setDependencies(data);
            } catch (error) {
                console.error('Failed to check dependencies:', error);
            }
        }
        setLoading(false);
    };

    if (loading || !dependencies || dismissed) return null;

    const missingDeps = [
        !dependencies.yt_dlp.available && { name: 'yt-dlp', info: dependencies.yt_dlp },
        !dependencies.python.available && { name: 'Python', info: dependencies.python },
        !dependencies.ffmpeg.available && { name: 'FFmpeg', info: dependencies.ffmpeg }
    ].filter(Boolean);

    // Don't show if all dependencies are available
    if (missingDeps.length === 0) return null;

    const handleDismiss = () => {
        setDismissed(true);
        onClose();
    };

    return (
        <div className="fixed bottom-20 right-4 z-50 max-w-md animate-fade-in-up">
            <div className="bg-gradient-to-br from-yellow-900/90 to-orange-900/90 backdrop-blur-lg border border-yellow-500/30 rounded-xl shadow-2xl p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                        <h3 className="text-sm font-bold text-yellow-100">Missing Dependencies</h3>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-yellow-300 hover:text-white transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Missing Dependencies List */}
                <div className="space-y-2 mb-3">
                    {missingDeps.map((dep: any, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                            <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <span className="font-semibold text-white">{dep.name}</span>
                                <span className="text-yellow-200"> is not installed</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Installation Instructions */}
                <div className="bg-black/30 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Terminal className="w-3 h-3 text-yellow-400" />
                        <span className="text-[10px] font-bold text-yellow-300 uppercase">Quick Fix</span>
                    </div>
                    <div className="space-y-1.5 text-[10px] text-yellow-100 font-mono">
                        {!dependencies.yt_dlp.available && (
                            <div>
                                <div className="text-yellow-300 mb-0.5">Install yt-dlp:</div>
                                <code className="bg-black/40 px-2 py-0.5 rounded block">pip install yt-dlp</code>
                            </div>
                        )}
                        {!dependencies.python.available && (
                            <div>
                                <div className="text-yellow-300 mb-0.5">Install Python:</div>
                                <a
                                    href="https://www.python.org/downloads/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-300 hover:text-blue-200 underline"
                                >
                                    python.org/downloads
                                </a>
                            </div>
                        )}
                        {!dependencies.ffmpeg.available && (
                            <div>
                                <div className="text-yellow-300 mb-0.5">Install FFmpeg:</div>
                                <a
                                    href="https://ffmpeg.org/download.html"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-300 hover:text-blue-200 underline"
                                >
                                    ffmpeg.org/download
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* Feature Impact */}
                <div className="text-[10px] text-yellow-200 bg-yellow-500/10 rounded-lg p-2">
                    <span className="font-semibold">⚠️ Impact: </span>
                    Some features will not work until dependencies are installed. The app will run in demo mode.
                </div>
            </div>
        </div>
    );
};
