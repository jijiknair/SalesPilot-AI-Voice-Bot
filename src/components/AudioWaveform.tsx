import React, { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  status: 'Ready' | 'Connecting' | 'Listening' | 'Speaking' | 'Ended' | 'Error';
  audioLevel?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  analyser,
  isActive,
  status,
  audioLevel = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = 36;
      const barWidth = 4;
      const spacing = (width - barCount * barWidth) / (barCount - 1);

      let dataArray: Uint8Array = new Uint8Array(barCount);

      if (analyser && isActive) {
        const bufferLength = analyser.frequencyBinCount;
        const rawData = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(rawData);

        // Subsample frequency bins
        for (let i = 0; i < barCount; i++) {
          const index = Math.floor((i / barCount) * (bufferLength / 2));
          dataArray[i] = rawData[index];
        }
      }

      phase += 0.08;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + spacing);
        let barHeight = 6;

        if (isActive) {
          if (status === 'Speaking') {
            // Pulsing synthetic wave for AI speaking
            const sine = Math.sin(phase + i * 0.3) * 0.5 + 0.5;
            barHeight = 12 + sine * (height * 0.65) * Math.max(0.3, audioLevel);
          } else if (status === 'Listening') {
            // Real mic frequency data or subtle listening pulse
            const freqVal = dataArray[i] / 255;
            const micBoost = Math.max(freqVal, audioLevel * 1.2);
            barHeight = 6 + micBoost * (height * 0.7);
          } else if (status === 'Connecting') {
            const wave = Math.sin(phase * 1.5 + i * 0.25) * 0.5 + 0.5;
            barHeight = 6 + wave * (height * 0.35);
          }
        } else {
          barHeight = 4;
        }

        const y = (height - barHeight) / 2;

        // Gradient based on status
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (status === 'Speaking') {
          gradient.addColorStop(0, '#6366f1'); // Indigo
          gradient.addColorStop(0.5, '#8b5cf6'); // Purple
          gradient.addColorStop(1, '#3b82f6'); // Blue
        } else if (status === 'Listening') {
          gradient.addColorStop(0, '#10b981'); // Emerald
          gradient.addColorStop(1, '#06b6d4'); // Cyan
        } else if (status === 'Error') {
          gradient.addColorStop(0, '#ef4444');
          gradient.addColorStop(1, '#f97316');
        } else {
          gradient.addColorStop(0, '#94a3b8');
          gradient.addColorStop(1, '#cbd5e1');
        }

        ctx.fillStyle = gradient;
        // Rounded bar caps
        ctx.beginPath();
        const radius = barWidth / 2;
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser, isActive, status, audioLevel]);

  return (
    <div className="w-full flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900/5 border border-slate-200/80">
      <div className="flex items-center justify-between w-full px-2 mb-2 text-xs text-slate-500 font-medium">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'Speaking'
                ? 'bg-indigo-500 animate-ping'
                : status === 'Listening'
                ? 'bg-emerald-500 animate-pulse'
                : status === 'Connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-slate-300'
            }`}
          />
          Live Audio Waveform
        </span>
        <span className="font-mono text-[11px] text-slate-600">
          {status === 'Speaking'
            ? 'Alex Spoken Output'
            : status === 'Listening'
            ? 'Mic Spoken Input'
            : status}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={340}
        height={56}
        className="w-full max-w-[340px] h-[56px] rounded-lg"
      />
    </div>
  );
};
