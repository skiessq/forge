'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import {
  ZoomIn,
  ZoomOut,
  Film,
  Volume2,
  Type,
  Scissors,
  Trash2,
  Copy,
  VolumeX,
} from 'lucide-react';
import Waveform from './Waveform';
import { splitClip, deleteClip, duplicateClip } from '@/lib/timeline/operations';

export default function Timeline() {
  const {
    project,
    currentTime,
    setCurrentTime,
    duration,
    isPlaying,
    setIsPlaying,
    zoom,
    setZoom,
    undo,
    redo,
    selectedClipId,
    setSelectedClipId,
    updateProject,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rippleDelete, setRippleDelete] = useState(true);

  if (!project) return null;

  const totalWidth = Math.max(900, duration * zoom);

  // Split selected or hovered clip at playhead
  const handleSplitAtPlayhead = () => {
    updateProject((draft) => {
      draft.tracks = draft.tracks.map((track) => {
        // If clip selected, split it; otherwise split any clip covering currentTime
        const targetClip = track.clips.find((c) =>
          selectedClipId ? c.id === selectedClipId : currentTime > c.start && currentTime < c.start + c.duration
        );
        if (targetClip) {
          const res = splitClip(track, targetClip.id, currentTime);
          return res.track;
        }
        return track;
      });
      return draft;
    });
  };

  // Delete selected clip
  const handleDeleteSelected = () => {
    if (!selectedClipId) return;
    updateProject((draft) => {
      draft.tracks = draft.tracks.map((track) => {
        if (track.clips.some((c) => c.id === selectedClipId)) {
          return deleteClip(track, selectedClipId, rippleDelete);
        }
        return track;
      });
      return draft;
    });
    setSelectedClipId(null);
  };

  // Duplicate selected clip
  const handleDuplicateSelected = () => {
    if (!selectedClipId) return;
    updateProject((draft) => {
      draft.tracks = draft.tracks.map((track) => {
        if (track.clips.some((c) => c.id === selectedClipId)) {
          const res = duplicateClip(track, selectedClipId);
          return res.track;
        }
        return track;
      });
      return draft;
    });
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.code === 'KeyS' && !e.ctrlKey) {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey && e.shiftKey && e.code === 'KeyZ') || (e.ctrlKey && e.code === 'KeyY')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, undo, redo, setIsPlaying, selectedClipId, currentTime]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const newTime = Math.max(0, Math.min(duration, clickX / zoom));
    setCurrentTime(newTime);
  };

  const videoTrack = project.tracks.find((t) => t.type === 'video');
  const audioTrack = project.tracks.find((t) => t.type === 'audio');

  return (
    <div className="h-56 border-t border-slate-800 bg-slate-950/95 flex flex-col z-30 select-none">
      {/* Timeline Action Header */}
      <div className="h-9 border-b border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-400 bg-slate-950">
        <div className="flex items-center gap-2">
          {/* Split button */}
          <button
            onClick={handleSplitAtPlayhead}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-lg font-medium transition"
            title="Split Clip at Playhead (S)"
          >
            <Scissors className="w-3.5 h-3.5 text-blue-400 -rotate-45" />
            <span>Split (S)</span>
          </button>

          {/* Delete button */}
          <button
            onClick={handleDeleteSelected}
            disabled={!selectedClipId}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-rose-500/20 disabled:opacity-40 border border-slate-800 hover:border-rose-500/30 text-rose-300 rounded-lg font-medium transition"
            title="Delete Selected Clip (Del)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete</span>
          </button>

          {/* Duplicate button */}
          <button
            onClick={handleDuplicateSelected}
            disabled={!selectedClipId}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 rounded-lg font-medium transition"
            title="Duplicate Clip"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span>Duplicate</span>
          </button>

          {/* Ripple Delete Toggle */}
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-3 border-l border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={rippleDelete}
              onChange={(e) => setRippleDelete(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Ripple Delete</span>
          </label>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(zoom - 10)}
            className="p-1 text-slate-400 hover:text-white rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min="20"
            max="160"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-24 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
          />
          <button
            onClick={() => setZoom(zoom + 10)}
            className="p-1 text-slate-400 hover:text-white rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Tracks Workspace */}
      <div
        ref={containerRef}
        onClick={handleTimelineClick}
        className="flex-1 overflow-x-auto overflow-y-auto relative p-3 cursor-pointer bg-[#0A0D14]"
      >
        <div style={{ width: `${totalWidth}px` }} className="relative min-h-full space-y-2">
          {/* Timecode Ruler */}
          <div className="h-5 border-b border-slate-800 relative font-mono text-[10px] text-slate-500">
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, sec) => (
              <div
                key={sec}
                style={{ left: `${sec * zoom}px` }}
                className="absolute top-0 flex flex-col items-start pointer-events-none"
              >
                <div className="h-2 w-px bg-slate-700" />
                <span className="pl-1 text-[9px]">{sec}s</span>
              </div>
            ))}
          </div>

          {/* 1. Video Track */}
          <div className="h-10 bg-slate-900/50 border border-slate-800/80 rounded-lg relative overflow-hidden flex items-center">
            {videoTrack?.clips.map((clip) => {
              const isSelected = selectedClipId === clip.id;
              const clipWidth = Math.max(30, clip.duration * zoom);
              const clipLeft = clip.start * zoom;

              return (
                <div
                  key={clip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClipId(clip.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${clipLeft}px`,
                    width: `${clipWidth}px`,
                  }}
                  className={`h-full rounded-md border flex items-center px-2.5 gap-2 transition ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-400 shadow-md ring-1 ring-blue-400'
                      : 'bg-blue-950/60 border-blue-500/40 hover:border-blue-400'
                  }`}
                >
                  <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-100 font-medium truncate">
                    {clip.id.includes('split') ? 'Video Segment' : project.source.originalFileName}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-blue-300/80">
                    {clip.duration.toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* 2. Audio Track (with Waveform Visualizer) */}
          <div className="h-10 bg-slate-900/50 border border-slate-800/80 rounded-lg relative overflow-hidden flex items-center">
            <div className="absolute inset-0 flex items-center pointer-events-none">
              <Waveform duration={duration} zoom={zoom} height={32} color="#10B981" />
            </div>
            <div className="relative z-10 px-3 flex items-center gap-2 pointer-events-none">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-200 font-semibold drop-shadow">
                Untouched Audio Track
              </span>
            </div>
          </div>

          {/* 3. Subtitles Track */}
          <div className="h-8 bg-slate-900/40 border border-slate-800/60 rounded-lg relative overflow-hidden flex items-center">
            {project.subtitles.map((sub) => {
              const subLeft = sub.start * zoom;
              const subWidth = Math.max(20, (sub.end - sub.start) * zoom);
              const isActive = currentTime >= sub.start && currentTime <= sub.end;

              return (
                <div
                  key={sub.id}
                  style={{
                    position: 'absolute',
                    left: `${subLeft}px`,
                    width: `${subWidth}px`,
                  }}
                  className={`h-6 rounded border px-1.5 flex items-center text-[10px] font-medium truncate transition ${
                    isActive
                      ? 'bg-amber-500/40 border-amber-400 text-white'
                      : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <Type className="w-2.5 h-2.5 mr-1 text-amber-400 shrink-0" />
                  <span className="truncate">{sub.text}</span>
                </div>
              );
            })}
          </div>

          {/* Red Playhead Line */}
          <div
            style={{ left: `${currentTime * zoom}px` }}
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none transition-all duration-75"
          >
            <div className="w-3 h-3 bg-rose-500 -ml-[5px] -top-1 absolute rotate-45 rounded-sm shadow-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
