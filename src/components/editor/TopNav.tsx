'use client';

import React from 'react';
import Link from 'next/link';
import { useEditorStore } from '@/store/useEditorStore';
import {
  ChevronLeft,
  Undo2,
  Redo2,
  Smartphone,
  Square,
  Monitor,
  Eye,
  EyeOff,
  Download,
  Save,
  CheckCircle2,
  Scissors,
  PanelBottomClose,
  PanelBottomOpen,
} from 'lucide-react';
import { AspectRatio } from '@/lib/types';

interface Props {
  onOpenExport: () => void;
}

export default function TopNav({ onOpenExport }: Props) {
  const {
    project,
    updateProject,
    undo,
    redo,
    canUndo,
    canRedo,
    safeZoneVisible,
    setSafeZoneVisible,
    isTimelineVisible,
    toggleTimeline,
    setCanvasAspectRatio,
    isSaving,
    lastSavedAt,
    saveToServer,
  } = useEditorStore();

  if (!project) return null;

  const currentRatio = project.canvas.aspectRatio;

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/90 px-4 flex items-center justify-between z-40 select-none">
      {/* Left Section: Back & Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          title="Back to Dashboard"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-blue-500 -rotate-45" />
          <input
            type="text"
            value={project.name}
            onChange={(e) => {
              updateProject((draft) => {
                draft.name = e.target.value;
                return draft;
              }, false);
            }}
            onBlur={() => saveToServer()}
            className="bg-transparent font-bold text-sm text-white px-2 py-1 rounded hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 outline-none max-w-xs transition"
          />
        </div>

        {/* History Controls */}
        <div className="flex items-center border-l border-slate-800 pl-3 gap-1">
          <button
            onClick={undo}
            disabled={!canUndo()}
            title="Undo (Ctrl+Z)"
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-800 rounded transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-800 rounded transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle Section: Aspect Ratio Switcher & Safe-Zone */}
      <div className="flex items-center gap-3">
        {/* Canvas Format Segmented Control */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl text-xs">
          <button
            onClick={() => setCanvasAspectRatio('9:16')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              currentRatio === '9:16'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="9:16 Vertical (TikTok / Reels / Shorts)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16</span>
          </button>
          <button
            onClick={() => setCanvasAspectRatio('1:1')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              currentRatio === '1:1'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="1:1 Square (Instagram Post)"
          >
            <Square className="w-3.5 h-3.5" />
            <span>1:1</span>
          </button>
          <button
            onClick={() => setCanvasAspectRatio('16:9')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              currentRatio === '16:9'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="16:9 Landscape (YouTube)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>16:9</span>
          </button>
        </div>

        {/* Safe-zone overlay toggle */}
        <button
          onClick={() => setSafeZoneVisible(!safeZoneVisible)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
            safeZoneVisible
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Toggle TikTok / Reels UI Safe Zone Guide"
        >
          {safeZoneVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>Safe Zone</span>
        </button>

        {/* Timeline visibility toggle (for massive full preview) */}
        <button
          onClick={toggleTimeline}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
            !isTimelineVisible
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-sm'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Toggle Timeline (Shortcut: T) to expand video preview"
        >
          {isTimelineVisible ? (
            <PanelBottomClose className="w-3.5 h-3.5" />
          ) : (
            <PanelBottomOpen className="w-3.5 h-3.5" />
          )}
          <span>{isTimelineVisible ? 'Hide Timeline' : 'Show Timeline'}</span>
        </button>
      </div>

      {/* Right Section: Save Status & Export */}
      <div className="flex items-center gap-3">
        {/* Auto-save status */}
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          {isSaving ? (
            <span className="flex items-center gap-1 text-blue-400">
              <Save className="w-3 h-3 animate-spin" /> Saving...
            </span>
          ) : lastSavedAt ? (
            <span className="flex items-center gap-1 text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Saved {lastSavedAt}
            </span>
          ) : null}
        </div>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Export MP4</span>
        </button>
      </div>
    </header>
  );
}
