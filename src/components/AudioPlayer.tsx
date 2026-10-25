import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { downloadAudioBlob } from '../lib/audioRecorder';

interface AudioPlayerProps {
  audioBlob?: Blob | null;
  audioUrl?: string | null;
  filename?: string;
  title?: string;
  durationSeconds?: number;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBlob,
  audioUrl,
  filename = 'call-recording.webm',
  title = 'Call Audio Recording',
  durationSeconds = 0,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(Number.isFinite(durationSeconds) ? durationSeconds : 0);
    setPlaybackError(null);
    if (audioBlob) {
      objectUrl = URL.createObjectURL(audioBlob);
      setResolvedSrc(objectUrl);
    } else if (audioUrl) {
      setResolvedSrc(audioUrl);
    } else {
      setResolvedSrc(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [audioBlob, audioUrl, durationSeconds]);

  const togglePlay = () => {
    if (!audioRef.current || !resolvedSrc) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setPlaybackError('Playback failed. Check audio permissions or download the recording.'));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const actual = audioRef.current.duration;
      if (Number.isFinite(actual) && actual > 0) setDuration(actual);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDownload = () => {
    if (audioBlob) {
      downloadAudioBlob(audioBlob, filename);
    } else if (resolvedSrc) {
      const a = document.createElement('a');
      a.href = resolvedSrc;
      const extension = new URL(resolvedSrc, window.location.href).pathname.match(/\.(webm|ogg|wav|m4a)$/i)?.[1];
      a.download = extension ? filename.replace(/\.(webm|ogg|wav|m4a)$/i, `.${extension}`) : filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleReset = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  if (!resolvedSrc) {
    return (
      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center gap-2">
        <span>No audio recording available for this call.</span>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 text-white rounded-xl p-3.5 shadow-md border border-slate-800">
      <audio
        ref={audioRef}
        src={resolvedSrc}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onError={() => setPlaybackError('This recording could not be loaded. Check the stored file or connection.')}
      />

      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
        <span className="truncate text-slate-200 font-semibold">{title}</span>
        <span className="font-mono text-[11px] text-slate-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {playbackError && <p role="alert" className="text-xs text-amber-300 mb-2">{playbackError}</p>}
      {/* Progress slider */}
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-3"
      />

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white flex items-center justify-center transition-transform active:scale-95 shadow-sm"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Restart playback"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition-colors border border-slate-700/80"
          title="Download recording"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
};
