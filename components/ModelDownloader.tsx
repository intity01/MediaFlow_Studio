import React, { useState, useEffect } from 'react';
import { Download, Check, Loader2, AlertCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/tauriHelper';

interface ModelStatus {
    installed: boolean;
    model_path: string;
}

export const ModelDownloader: React.FC = () => {
    const [status, setStatus] = useState<'checking' | 'not_installed' | 'downloading' | 'installed' | 'error'>('checking');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkModels();
    }, []);

    const checkModels = async () => {
        if (!isTauri()) {
            setStatus('not_installed');
            return;
        }

        try {
            const result = await invoke('check_models_installed');
            const data: ModelStatus = JSON.parse(result as string);
            setStatus(data.installed ? 'installed' : 'not_installed');
        } catch (e) {
            setStatus('not_installed');
        }
    };

    const downloadModels = async () => {
        if (!isTauri()) return;

        setStatus('downloading');
        setError(null);

        try {
            await invoke('download_ai_models');
            setStatus('installed');
        } catch (e: any) {
            setError(e?.message || 'Download failed');
            setStatus('error');
        }
    };

    if (status === 'checking') {
        return (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Checking AI models...</span>
            </div>
        );
    }

    if (status === 'installed') {
        return (
            <div className="flex items-center gap-2 text-emerald-400 text-xs">
                <Check className="w-3 h-3" />
                <span>AI Models Ready</span>
            </div>
        );
    }

    if (status === 'downloading') {
        return (
            <div className="flex items-center gap-2 text-blue-400 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Downloading AI models (~67MB)...</span>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                </div>
                <button
                    onClick={downloadModels}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={downloadModels}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-500/30 transition-colors"
        >
            <Download className="w-3 h-3" />
            <span>Download AI Models (67MB)</span>
        </button>
    );
};
