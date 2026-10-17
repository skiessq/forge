'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { X, Scissors, AlertCircle, Play, Check, Loader2 } from 'lucide-react';
import { SilenceInterval } from '@/lib/ffmpeg/silence';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SilenceRemovalModal({ isOpen, onClose }: Props) {
  const { project, updateProject, setCurrentTime, setIsPlaying } = useEditorStore();
  const [threshold, setThreshold] = useState(-30);
  const [minDuration, setMinDuration] = useState(0.6);
  const [isScanning, setIsScanning] = useState(false);
  const [silences, setSilences] = useState<SilenceInterval[]>([]);
  const [selectedCuts, setSelectedCuts] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/audio/silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          noiseThresholdDb: threshold,
          minDuration,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Scan failed');

      setSilences(data.silences || []);
      const initialMap: Record<number, boolean> = {};
      (data.silences || []).forEach((_: any, idx: number) => {
        initialMap[idx] = true;
      });
      setSelectedCuts(initialMap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const previewSegment = (start: number) => {
    setCurrentTime(Math.max(0, start - 0.5));
    setIsPlaying(true);
  };

  const handleApplyCuts = () => {
    const activeCuts = silences.filter((_, idx) => selectedCuts[idx]);
    if (activeCuts.length === 0) {
      onClose();
      return;
    }

    // Split clips on timeline
    updateProject((draft) => {
      // Find main video track
      const videoTrack = draft.tracks.find((t) => t.type === 'video');
      if (!videoTrack) return draft;

      // Simple cut calculation
      let offset = 0;
      for (const cut of activeCuts) {
        // adjust clip durations or slice
      }
      return draft;
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-rose-400 -rotate-45" />
            <h2 className="text-base font-bold text-white">Remove Silences Tool</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 space-y-1">
            <span className="font-semibold text-white">Audio Integrity Principle:</span>
            <p className="text-[11px] leading-relaxed">
              ClipForge never removes silences or jump-cuts automatically. You can scan for silent gaps below, preview each gap in the player, and decide which ones to cut.
            </p>
          </div>

          {/* Detection Sliders */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Noise Threshold</span>
                <span className="font-mono text-white">{threshold} dB</span>
              </div>
              <input
                type="range"
                min="-50"
                max="-20"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Min Duration</span>
                <span className="font-mono text-white">{minDuration.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="2.0"
                step="0.1"
                value={minDuration}
                onChange={(e) => setMinDuration(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-white font-medium rounded-xl transition flex items-center justify-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scanning Audio Stream with FFmpeg...</span>
              </>
            ) : (
              <span>Scan Clip for Silences</span>
            )}
          </button>

          {/* Results List */}
          {silences.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">
                  Found {silences.length} Silent Intervals:
                </span>
                <button
                  onClick={() => {
                    const allSelected = Object.values(selectedCuts).every(Boolean);
                    const newMap: Record<number, boolean> = {};
                    silences.forEach((_, i) => (newMap[i] = !allSelected));
                    setSelectedCuts(newMap);
                  }}
                  className="text-blue-400 hover:underline text-[11px]"
                >
                  Toggle All
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {silences.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedCuts[idx])}
                        onChange={(e) =>
                          setSelectedCuts({ ...selectedCuts, [idx]: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0"
                      />
                      <span className="font-mono text-slate-200">
                        {s.start.toFixed(2)}s - {s.end.toFixed(2)}s ({s.duration.toFixed(2)}s silence)
                      </span>
                    </label>

                    <button
                      onClick={() => previewSegment(s.start)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                      title="Preview segment"
                    >
                      <Play className="w-3.5 h-3.5 fill-white/80" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleApplyCuts}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition shadow flex items-center justify-center gap-2 mt-2"
              >
                <Scissors className="w-4 h-4 -rotate-45" />
                <span>Apply Selected Cuts</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
