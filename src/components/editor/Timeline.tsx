'use client';

import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { ZoomIn, ZoomOut, Film, Volume2, Type } from 'lucide-react';

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
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey && e.shiftKey && e.code === 'KeyZ') ||
        (e.ctrlKey && e.code === 'KeyY')
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, undo, redo, setIsPlaying]);

  if (!project) return null;

  const totalWidth = Math.max(800, duration * zoom);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const newTime = Math.max(0, Math.min(duration, clickX / zoom));
    setCurrentTime(newTime);
  };

  return (
    <div className="h-48 border-t border-slate-800 bg-slate-950/95 flex flex-col z-30 select-none">
      {/* Timeline Toolbar */}
      <div className="h-8 border-b border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-400 bg-slate-950">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-300">Timeline</span>
          <span className="text-[11px] text-slate-500">
            Shortcuts: [Space] Play/Pause, [Ctrl+Z] Undo
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(zoom - 10)}
            className="p-1 hover:text-white rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min="20"
            max="150"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-20 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
          />
          <button
            onClick={() => setZoom(zoom + 10)}
            className="p-1 hover:text-white rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tracks Area */}
      <div
        ref={containerRef}
        onClick={handleTimelineClick}
        className="flex-1 overflow-x-auto overflow-y-auto relative p-3 cursor-pointer bg-slate-950"
      >
        <div style={{ width: `${totalWidth}px` }} className="relative min-h-full space-y-2">
          {/* Time Ruler */}
          <div className="h-5 border-b border-slate-800 relative font-mono text-[10px] text-slate-500">
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, sec) => (
              <div
                key={sec}
                style={{ left: `${sec * zoom}px` }}
                className="absolute top-0 flex flex-col items-start"
              >
                <div className="h-2 w-px bg-slate-700" />
                <span className="pl-1 text-[9px]">{sec}s</span>
              </div>
            ))}
          </div>

          {/* Video Track Block */}
          <div className="h-9 bg-blue-950/40 border border-blue-500/30 rounded-lg relative overflow-hidden flex items-center px-3 gap-2">
            <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-blue-200 font-medium truncate">
              {project.source.originalFileName}
            </span>
          </div>

          {/* Audio Track Block */}
          <div className="h-9 bg-emerald-950/40 border border-emerald-500/30 rounded-lg relative overflow-hidden flex items-center px-3 gap-2">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-200 font-medium truncate">
              Original Audio Stream ({project.source.probe?.audioCodec || 'aac'})
            </span>
          </div>

          {/* Captions Track Block (if subtitles present) */}
          <div className="h-9 bg-amber-950/30 border border-amber-500/30 rounded-lg relative overflow-hidden flex items-center px-3 gap-2">
            <Type className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-200 font-medium truncate">
              {project.subtitles.length > 0
                ? `${project.subtitles.length} Subtitle cues`
                : 'Subtitles (Auto-generate in Captions tab)'}
            </span>
          </div>

          {/* Red Playhead Needle */}
          <div
            style={{ left: `${currentTime * zoom}px` }}
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none transition-all duration-75"
          >
            <div className="w-3 h-3 bg-rose-500 -ml-[5px] -top-1 absolute rotate-45 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
