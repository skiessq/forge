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
  Sparkles,
  LayoutTemplate,
  Sliders,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import Waveform from './Waveform';
import { splitClip, deleteClip, duplicateClip } from '@/lib/timeline/operations';
import { TRANSITION_PRESETS } from '@/lib/constants';
import { TransitionType, TimelineClip } from '@/lib/types';

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
    setTransition,
    removeTransition,
    setLayoutScope,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rippleDelete, setRippleDelete] = useState(true);

  // Transition modal state
  const [transitionModal, setTransitionModal] = useState<{
    fromClip: TimelineClip;
    toClip: TimelineClip;
    fromIndex: number;
    toIndex: number;
    initialType: TransitionType;
    initialDuration: number;
  } | null>(null);

  const [selectedType, setSelectedType] = useState<TransitionType>('crossfade');
  const [transitionDuration, setTransitionDuration] = useState<number>(0.5);

  if (!project) return null;

  const totalWidth = Math.max(900, duration * zoom);

  const getLayoutLabel = (templateId?: string) => {
    switch (templateId) {
      case 'split_facecam_top':
        return 'Facecam Top';
      case 'split_gameplay_top':
        return 'Facecam Bottom';
      case 'gameplay_full':
        return 'Full Game';
      case 'media_top_game_bottom':
        return 'Media Top';
      case 'media_bottom_game_top':
        return 'Media Bottom';
      case 'blurred_background_fit':
        return 'Blur Fit';
      case 'picture_in_picture':
        return 'PiP';
      default:
        return 'Default Layout';
    }
  };

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

  // Open transition modal for adjacent clips
  const openTransitionModal = (
    clipA: TimelineClip,
    clipB: TimelineClip,
    fromIdx: number,
    toIdx: number
  ) => {
    const existing = project.transitions?.find(
      (t) => t.fromClipId === clipA.id && t.toClipId === clipB.id
    );
    const type = existing ? existing.type : 'crossfade';
    const dur = existing ? existing.duration : 0.5;
    setSelectedType(type);
    setTransitionDuration(dur);
    setTransitionModal({
      fromClip: clipA,
      toClip: clipB,
      fromIndex: fromIdx,
      toIndex: toIdx,
      initialType: type,
      initialDuration: dur,
    });
  };

  const handleApplyTransition = () => {
    if (!transitionModal) return;
    setTransition(
      transitionModal.fromClip.id,
      transitionModal.toClip.id,
      selectedType,
      transitionDuration
    );
    setTransitionModal(null);
  };

  const handleRemoveTransition = () => {
    if (!transitionModal) return;
    removeTransition(
      transitionModal.fromClip.id,
      transitionModal.toClip.id
    );
    setTransitionModal(null);
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
      } else if (e.code === 'Escape' && transitionModal) {
        e.preventDefault();
        setTransitionModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, undo, redo, setIsPlaying, selectedClipId, currentTime, transitionModal]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const newTime = Math.max(0, Math.min(duration, clickX / zoom));
    setCurrentTime(newTime);
  };

  const videoTrack = project.tracks.find((t) => t.type === 'video');
  const audioTrack = project.tracks.find((t) => t.type === 'audio');

  const maxAllowedDuration = transitionModal
    ? Math.min(
        1.5,
        Math.max(
          0.2,
          parseFloat(
            (
              Math.min(transitionModal.fromClip.duration, transitionModal.toClip.duration) * 0.45
            ).toFixed(1)
          )
        )
      )
    : 1.0;

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
          <div className="h-11 bg-slate-900/50 border border-slate-800/80 rounded-lg relative overflow-hidden flex items-center">
            {videoTrack?.clips.map((clip, index) => {
              const isSelected = selectedClipId === clip.id;
              const clipWidth = Math.max(30, clip.duration * zoom);
              const clipLeft = clip.start * zoom;
              const effectiveLayout = clip.layoutOverride || project.layout;
              const clipLayoutLabel = getLayoutLabel(effectiveLayout?.templateId);

              return (
                <div
                  key={clip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClipId(clip.id);
                    setLayoutScope('clip');
                    if (containerRef.current) {
                      const rect = containerRef.current.getBoundingClientRect();
                      const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
                      const newTime = Math.max(0, Math.min(duration, clickX / zoom));
                      setCurrentTime(newTime);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: `${clipLeft}px`,
                    width: `${clipWidth}px`,
                  }}
                  className={`h-full rounded-md border flex items-center px-2.5 gap-2 transition cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-400 shadow-md ring-1 ring-blue-400'
                      : 'bg-blue-950/60 border-blue-500/40 hover:border-blue-400'
                  }`}
                >
                  <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-100 font-medium truncate">
                    {clip.id.includes('split') || (videoTrack?.clips.length || 0) > 1
                      ? `Segment ${index + 1}`
                      : project.source.originalFileName}
                  </span>

                  {/* Layout Badge per Clip */}
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-1 border transition ${
                      clip.layoutOverride
                        ? 'bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-sm'
                        : 'bg-slate-800/90 text-slate-300 border-slate-700/70'
                    }`}
                    title={
                      clip.layoutOverride
                        ? `Custom Layout: ${clipLayoutLabel} (Only Segment ${index + 1})`
                        : `Default Layout: ${clipLayoutLabel}`
                    }
                  >
                    <LayoutTemplate className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                    <span className="truncate max-w-[80px]">{clipLayoutLabel}</span>
                  </span>

                  <span className="ml-auto font-mono text-[10px] text-blue-300/80 shrink-0">
                    {(clip.duration ?? 0).toFixed(1)}s
                  </span>
                </div>
              );
            })}

            {/* Transition Junction Buttons between adjacent video clips */}
            {videoTrack && videoTrack.clips.length > 1 && (
              <>
                {videoTrack.clips.slice(0, -1).map((clipA, i) => {
                  const clipB = videoTrack.clips[i + 1];
                  const junctionX = (clipA.start + clipA.duration) * zoom;
                  const transition = project.transitions?.find(
                    (t) => t.fromClipId === clipA.id && t.toClipId === clipB.id
                  );
                  const hasActiveTransition = transition && transition.type !== 'cut';

                  return (
                    <div
                      key={`tr_junction_${clipA.id}_${clipB.id}`}
                      style={{
                        position: 'absolute',
                        left: `${junctionX}px`,
                        transform: 'translateX(-50%)',
                        zIndex: 25,
                      }}
                      className="flex items-center justify-center pointer-events-auto"
                    >
                      {hasActiveTransition ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTransitionModal(clipA, clipB, i, i + 1);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[9px] font-semibold shadow-lg shadow-purple-950/80 border border-purple-300/50 transition hover:scale-105 active:scale-95"
                          title={`Transition: ${transition.type.replace('_', ' ')} (${transition.duration}s). Click to modify.`}
                        >
                          <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0 animate-pulse" />
                          <span className="capitalize">{transition.type.replace('_', ' ')}</span>
                          <span className="text-[8px] opacity-80 font-mono">({transition.duration}s)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTransitionModal(clipA, clipB, i, i + 1);
                          }}
                          className="w-5 h-5 rounded-full bg-slate-900/95 hover:bg-purple-600 text-slate-400 hover:text-white border border-slate-700 hover:border-purple-400 shadow-md flex items-center justify-center transition-all hover:scale-125 group"
                          title={`Add Transition between Segment ${i + 1} and Segment ${i + 2}`}
                        >
                          <Sparkles className="w-2.5 h-2.5 group-hover:rotate-12 transition-transform text-slate-400 group-hover:text-white" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentTime(sub.start);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${subLeft}px`,
                    width: `${subWidth}px`,
                  }}
                  className={`h-6 rounded border px-1.5 flex items-center text-[10px] font-medium truncate transition cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/40 border-amber-400 text-white shadow-sm'
                      : 'bg-amber-950/40 border-amber-500/30 text-amber-200 hover:bg-amber-900/60'
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

      {/* Transition Configuration Modal */}
      {transitionModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTransitionModal(null)}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Clip Transition</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                      Segment {transitionModal.fromIndex + 1}{' '}
                      <ArrowRight className="w-3 h-3 inline mx-0.5" /> Segment{' '}
                      {transitionModal.toIndex + 1}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Smoothly bridge the cut between these two video segments
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransitionModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Transition Presets Grid */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Transition Style</span>
                <span className="text-[11px] text-purple-400 font-mono">
                  {TRANSITION_PRESETS.find((p) => p.id === selectedType)?.label}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {TRANSITION_PRESETS.map((preset) => {
                  const isSelected = selectedType === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedType(preset.id)}
                      className={`text-left p-2.5 rounded-xl border transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500 text-white ring-1 ring-purple-500'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold">{preset.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">
                        {preset.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration Slider (Only if not straight cut) */}
            {selectedType !== 'cut' && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Transition Duration</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-purple-400 font-bold text-sm">
                      {transitionDuration.toFixed(2)}s
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      (max {maxAllowedDuration.toFixed(1)}s)
                    </span>
                  </div>
                </div>

                <input
                  type="range"
                  min="0.1"
                  max={maxAllowedDuration}
                  step="0.05"
                  value={Math.min(transitionDuration, maxAllowedDuration)}
                  onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[0.2, 0.35, 0.5, 0.8, 1.0].map((sec) => {
                    if (sec > maxAllowedDuration) return null;
                    const isActive = Math.abs(transitionDuration - sec) < 0.04;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setTransitionDuration(sec)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition ${
                          isActive
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                {project.transitions?.some(
                  (t) =>
                    t.fromClipId === transitionModal.fromClip.id &&
                    t.toClipId === transitionModal.toClip.id
                ) && (
                  <button
                    type="button"
                    onClick={handleRemoveTransition}
                    className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 rounded-lg transition"
                  >
                    Remove Transition
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTransitionModal(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyTransition}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg shadow-lg shadow-purple-900/40 transition active:scale-95"
                >
                  Apply Transition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
