import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isTauri } from '../utils/tauriHelper';

interface MiniPlayerProps {
  src?: string;
  externalPlaying?: boolean;
  onPlayToggle?: () => void;
  volume?: number;
  muted?: boolean;
  syncTime?: number;  // Time to sync to (from master)
  onSeek?: (time: number) => void;  // Callback when user seeks
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ 
  src,
  externalPlaying, 
  onPlayToggle, 
  volume = 100, 
  muted = false,
  syncTime,
  onSeek
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioSrc, setAudioSrc] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (src) {
      if (isTauri()) {
        try {
          const assetUrl = convertFileSrc(src);
          setAudioSrc(assetUrl);
        } catch (e) {
          setAudioSrc('');
        }
      } else {
        setAudioSrc(src);
      }
    }
  }, [src]);

  const isControlled = externalPlaying !== undefined;
  const isPlaying = isControlled ? externalPlaying : internalPlaying;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    
    if (isPlaying && !muted) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, muted, audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  const togglePlay = () => {
    if (onPlayToggle) onPlayToggle();
    if (externalPlaying === undefined) setInternalPlaying(!internalPlaying);
  };

  const handleTimeUpdate = () => {
    if (!isDragging && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    if (!isControlled) setInternalPlaying(false);
    setCurrentTime(0);
  };

  // Sync time from master when it changes
  useEffect(() => {
    if (syncTime !== undefined && audioRef.current && Math.abs(audioRef.current.currentTime - syncTime) > 0.5) {
      audioRef.current.currentTime = syncTime;
      setCurrentTime(syncTime);
    }
  }, [syncTime]);

  // Seek to position
  const seekTo = (clientX: number) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = percent * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Notify parent to sync other stems
    if (onSeek) onSeek(newTime);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    seekTo(e.clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    seekTo(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) seekTo(e.clientX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      const handleGlobalMouseMove = (e: MouseEvent) => seekTo(e.clientX);
      
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mousemove', handleGlobalMouseMove);
      
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('mousemove', handleGlobalMouseMove);
      };
    }
  }, [isDragging, duration]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-[#121214] rounded-lg border border-white/5 p-2 space-y-2">
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}

      {/* Controls Row */}
      <div className="flex items-center gap-3">
        <button 
          onClick={togglePlay}
          disabled={!audioSrc}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isPlaying ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          } disabled:opacity-50`}
        >
          {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
        </button>

        <div className="text-[10px] font-mono text-slate-400">
          {formatTime(currentTime)}
        </div>

        {/* Seekbar */}
        <div 
          ref={progressRef}
          className="flex-1 h-2 bg-slate-800 rounded-full cursor-pointer relative group"
          onClick={handleProgressClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Progress fill */}
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            {/* Seek handle */}
            <div 
              className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-transform ${
                isDragging ? 'scale-125' : 'scale-0 group-hover:scale-100'
              }`}
            />
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-400">
          {formatTime(duration)}
        </div>
      </div>
    </div>
  );
};
