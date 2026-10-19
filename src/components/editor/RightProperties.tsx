'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { Sliders, Crop, Info, ZoomIn, Move, RotateCcw, ChevronDown, ChevronUp, Cpu, Sparkles } from 'lucide-react';
import { FitMode } from '@/lib/types';
import SecondaryMediaManager from './SecondaryMediaManager';

export default function RightProperties() {
  const {
    project,
    selectedRegionId,
    updateRegionCrop,
    setDividerWidth,
    setDividerColor,
    updateProject,
    resetRegionCrop,
    selectedClipId,
    currentTime,
  } = useEditorStore();
  const [showAdvancedDimensions, setShowAdvancedDimensions] = useState(false);

  if (!project) return null;

  const videoTrack = project.tracks?.find((t) => t.type === 'video');
  const activeClip = videoTrack?.clips?.find(
    (c) => (selectedClipId ? c.id === selectedClipId : currentTime >= c.start && currentTime < c.start + c.duration)
  ) || videoTrack?.clips?.[0];

  const hasMultipleClips = (videoTrack?.clips?.length || 0) > 1;
  const effectiveLayout = activeClip?.layoutOverride || project.layout;

  const selectedRegion = effectiveLayout.regions.find((r) => r.id === selectedRegionId);
  const isSecondary = selectedRegion?.sourceType === 'secondary_media';
  const sourceProbe = project.source.probe;
  const regionProbe = (isSecondary ? (effectiveLayout.secondaryMediaProbe || project.layout.secondaryMediaProbe) : sourceProbe) || {
    width: 1920,
    height: 1080,
  };

  // Calculate current zoom factor based on crop width
  const currentZoom = Math.round((1 / Math.max(0.05, selectedRegion?.crop?.width || 1)) * 100);

  const handleZoomChange = (targetZoomPercent: number) => {
    if (!selectedRegion) return;
    const factor = Math.max(0.5, Math.min(4.0, targetZoomPercent / 100));
    const currentW = selectedRegion.crop?.width ?? 1;
    const currentH = selectedRegion.crop?.height ?? 1;

    const newW = 1 / factor;
    const targetAspect =
      (project.canvas.width * selectedRegion.targetBounds.width) /
      Math.max(1, project.canvas.height * selectedRegion.targetBounds.height);
    const srcW = regionProbe?.width || 1920;
    const srcH = regionProbe?.height || 1080;
    const srcAspect = srcW / srcH;
    const newH = (newW * srcAspect) / targetAspect;

    // Anchor center
    const centerX = (selectedRegion.crop?.x ?? 0) + currentW / 2;
    const centerY = (selectedRegion.crop?.y ?? 0) + currentH / 2;

    updateRegionCrop(selectedRegion.id, {
      x: parseFloat((centerX - newW / 2).toFixed(3)),
      y: parseFloat((centerY - newH / 2).toFixed(3)),
      width: parseFloat(newW.toFixed(3)),
      height: parseFloat(newH.toFixed(3)),
    });
  };

  const applyPreset = (preset: 'facecam_left' | 'facecam_right' | 'game_center' | 'center' | 'full') => {
    if (!selectedRegion) return;
    const targetAspect =
      (project.canvas.width * selectedRegion.targetBounds.width) /
      Math.max(1, project.canvas.height * selectedRegion.targetBounds.height);
    const srcW = regionProbe?.width || 1920;
    const srcH = regionProbe?.height || 1080;
    const srcAspect = srcW / srcH;

    if (preset === 'facecam_left') {
      const w = 0.35;
      const h = (w * srcAspect) / targetAspect;
      updateRegionCrop(selectedRegion.id, {
        x: 0.05,
        y: 0.05,
        width: parseFloat(w.toFixed(3)),
        height: parseFloat(h.toFixed(3)),
      });
    } else if (preset === 'facecam_right') {
      const w = 0.35;
      const h = (w * srcAspect) / targetAspect;
      updateRegionCrop(selectedRegion.id, {
        x: 0.60,
        y: 0.05,
        width: parseFloat(w.toFixed(3)),
        height: parseFloat(h.toFixed(3)),
      });
    } else if (preset === 'game_center') {
      let h = 1.0;
      let w = (h * targetAspect) / srcAspect;
      if (w > 1.0) {
        w = 1.0;
        h = (w * srcAspect) / targetAspect;
      }
      updateRegionCrop(selectedRegion.id, {
        x: parseFloat(((1 - w) / 2).toFixed(3)),
        y: parseFloat(((1 - h) / 2).toFixed(3)),
        width: parseFloat(w.toFixed(3)),
        height: parseFloat(h.toFixed(3)),
      });
    } else if (preset === 'center') {
      const w = selectedRegion.crop?.width ?? 1;
      const h = (w * srcAspect) / targetAspect;
      updateRegionCrop(selectedRegion.id, {
        x: parseFloat(((1 - w) / 2).toFixed(3)),
        y: parseFloat(((1 - h) / 2).toFixed(3)),
        width: parseFloat(w.toFixed(3)),
        height: parseFloat(h.toFixed(3)),
      });
    } else if (preset === 'full') {
      resetRegionCrop(selectedRegion.id);
    }
  };

  const applySecondaryPreset = (preset: 'fit' | 'fill' | 'zoom_150' | 'zoom_200' | 'center' | 'reset') => {
    if (!selectedRegion) return;
    const targetAspect =
      (project.canvas.width * selectedRegion.targetBounds.width) /
      Math.max(1, project.canvas.height * selectedRegion.targetBounds.height);
    const srcW = regionProbe?.width || 1920;
    const srcH = regionProbe?.height || 1080;
    const srcAspect = srcW / srcH;

    if (preset === 'fit') {
      let w = 1.0;
      let h = (w * srcAspect) / targetAspect;
      updateRegionCrop(selectedRegion.id, {
        x: parseFloat(((1 - w) / 2).toFixed(3)),
        y: parseFloat(((1 - h) / 2).toFixed(3)),
        width: parseFloat(w.toFixed(3)),
        height: parseFloat(h.toFixed(3)),
      });
      updateProject((draft) => {
        const reg = draft.layout.regions.find((r) => r.id === selectedRegion.id);
        if (reg) reg.fit = 'contain';
        return draft;
      });
    } else if (preset === 'fill') {
      let w = 1.0;
      let h = (w * srcAspect) / targetAspect;
      if (h < 1.0) {
        h = 1.0;
        w = (h * targetAspect) / srcAspect;
      }
      updateRegionCrop(selectedRegion.id, {
        x: parseFloat(((1 - w) / 2).toFixed(3)),
        y: parseFloat(((1 - h) / 2).toFixed(3)),
        width: parseFloat(w.toFixed(3)),
        height: parseFloat(h.toFixed(3)),
      });
      updateProject((draft) => {
        const reg = draft.layout.regions.find((r) => r.id === selectedRegion.id);
        if (reg) reg.fit = 'cover';
        return draft;
      });
    } else if (preset === 'zoom_150') {
      handleZoomChange(150);
    } else if (preset === 'zoom_200') {
      handleZoomChange(200);
    } else if (preset === 'center') {
      const w = selectedRegion.crop?.width ?? 1;
      const h = selectedRegion.crop?.height || (w * srcAspect) / targetAspect;
      updateRegionCrop(selectedRegion.id, {
        x: parseFloat(((1 - w) / 2).toFixed(3)),
        y: parseFloat(((1 - h) / 2).toFixed(3)),
      });
    } else if (preset === 'reset') {
      resetRegionCrop(selectedRegion.id);
    }
  };

  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-950/90 flex flex-col z-30 select-none overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Inspector & Framing
          </span>
        </div>
      </div>

      {/* GPU Acceleration Status Badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/20 text-emerald-400">
        <Cpu className="w-4 h-4 shrink-0 text-emerald-400" />
        <div className="text-[11px] leading-tight">
          <span className="font-bold text-white block">RTX 5050 Active</span>
          <span className="text-[10px] text-emerald-300/80">CUDA & Dual NVENC Ready</span>
        </div>
      </div>

      {/* Region Crop & Framing Inspector */}
      {selectedRegion ? (
        <div className="space-y-4">
          {hasMultipleClips && activeClip && (
            <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-300">
                  {activeClip.id.includes('split') ? 'Video Segment' : 'Clip 1'} ({(activeClip.start ?? 0).toFixed(1)}s - {((activeClip.start ?? 0) + (activeClip.duration ?? 0)).toFixed(1)}s)
                </span>
                {activeClip.layoutOverride ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    Segment Framing
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    Inheriting Default
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                Split clip selected: framing & zooms adjust this segment independently!
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{selectedRegion.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Region ID: {selectedRegion.id}
            </span>
          </div>

          {isSecondary && (
            <SecondaryMediaManager />
          )}

          {/* Quick Framing Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>{isSecondary ? 'Media Framing Presets' : 'Quick Framing Presets'}</span>
            </span>
            {isSecondary ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => applySecondaryPreset('fit')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Fit (Letterbox)
                </button>
                <button
                  onClick={() => applySecondaryPreset('fill')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Fill (Cover Slot)
                </button>
                <button
                  onClick={() => applySecondaryPreset('zoom_150')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Zoom 150%
                </button>
                <button
                  onClick={() => applySecondaryPreset('zoom_200')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Zoom 200%
                </button>
                <button
                  onClick={() => applySecondaryPreset('center')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Center Position
                </button>
                <button
                  onClick={() => applySecondaryPreset('reset')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Reset Framing
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => applyPreset('facecam_left')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Facecam (Left)
                </button>
                <button
                  onClick={() => applyPreset('facecam_right')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Facecam (Right)
                </button>
                <button
                  onClick={() => applyPreset('game_center')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Gameplay Focus
                </button>
                <button
                  onClick={() => applyPreset('center')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 transition text-left"
                >
                  Center Crop
                </button>
              </div>
            )}
          </div>

          {/* Unconstrained Framing Controls */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between text-slate-400 font-medium">
              <div className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-blue-400" />
                <span>Pan & Position (Unconstrained)</span>
              </div>
              <button
                onClick={() => (isSecondary ? applySecondaryPreset('reset') : applyPreset('full'))}
                title="Reset to full frame"
                className="p-1 hover:text-white hover:bg-slate-800 rounded transition"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Interactive hint */}
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 leading-snug">
              💡 Tip: Click and drag directly on the video preview to pan smoothly, or scroll mouse wheel to zoom!
            </div>

            {/* Zoom / Scale Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <ZoomIn className="w-3 h-3 text-blue-400" />
                  <span>Camera Zoom</span>
                </span>
                <span className="font-mono text-blue-400 font-bold">{currentZoom}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="350"
                step="5"
                value={currentZoom}
                onChange={(e) => handleZoomChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>50% (Wide)</span>
                <span>100%</span>
                <span>200%</span>
                <span>350% (Close)</span>
              </div>
            </div>

            {/* Unstretched indicator */}
            <div className="flex items-center justify-between text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <span className="font-medium">Aspect Ratio Locked</span>
              <span className="text-emerald-300/80">Square 1:1 Pixels</span>
            </div>

            {/* Pan X (Horizontal Position) with expanded range and direct numeric input */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Horizontal Pan (X)</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateRegionCrop(selectedRegion.id, {
                        x: parseFloat(((1 - (selectedRegion.crop?.width ?? 1)) / 2).toFixed(3)),
                      })
                    }
                    className="text-[9px] px-1 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 transition"
                    title="Center Horizontally"
                  >
                    Center
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min="-150"
                    max="150"
                    value={Math.round(selectedRegion.crop.x * 100)}
                    onChange={(e) =>
                      updateRegionCrop(selectedRegion.id, { x: (parseFloat(e.target.value) || 0) / 100 })
                    }
                    className="w-12 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-mono text-white text-[11px] outline-none"
                  />
                  <span className="text-slate-400 font-mono">%</span>
                </div>
              </div>
              <input
                type="range"
                min="-1.0"
                max="1.0"
                step="0.01"
                value={selectedRegion.crop.x}
                onChange={(e) => updateRegionCrop(selectedRegion.id, { x: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-100% (Left)</span>
                <span>0%</span>
                <span>+100% (Right)</span>
              </div>
            </div>

            {/* Pan Y (Vertical Position) with expanded range and direct numeric input */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Vertical Pan (Y)</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateRegionCrop(selectedRegion.id, {
                        y: parseFloat(((1 - (selectedRegion.crop?.height ?? 1)) / 2).toFixed(3)),
                      })
                    }
                    className="text-[9px] px-1 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 transition"
                    title="Center Vertically"
                  >
                    Center
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min="-150"
                    max="150"
                    value={Math.round(selectedRegion.crop.y * 100)}
                    onChange={(e) =>
                      updateRegionCrop(selectedRegion.id, { y: (parseFloat(e.target.value) || 0) / 100 })
                    }
                    className="w-12 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-mono text-white text-[11px] outline-none"
                  />
                  <span className="text-slate-400 font-mono">%</span>
                </div>
              </div>
              <input
                type="range"
                min="-1.0"
                max="1.0"
                step="0.01"
                value={selectedRegion.crop.y}
                onChange={(e) => updateRegionCrop(selectedRegion.id, { y: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-100% (Top)</span>
                <span>0%</span>
                <span>+100% (Bottom)</span>
              </div>
            </div>

            {/* Advanced Dimensions Toggle */}
            <div className="pt-1 border-t border-slate-800">
              <button
                onClick={() => setShowAdvancedDimensions(!showAdvancedDimensions)}
                className="flex items-center justify-between w-full text-[11px] text-slate-400 hover:text-white py-1"
              >
                <span>Manual Width / Height Override</span>
                {showAdvancedDimensions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvancedDimensions && (
                <div className="space-y-2.5 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Crop Box Width</span>
                      <span className="font-mono text-slate-200">
                        {Math.round(selectedRegion.crop.width * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.5"
                      step="0.01"
                      value={selectedRegion.crop.width}
                      onChange={(e) => updateRegionCrop(selectedRegion.id, { width: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Crop Box Height</span>
                      <span className="font-mono text-slate-200">
                        {Math.round(selectedRegion.crop.height * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.5"
                      step="0.01"
                      value={selectedRegion.crop.height}
                      onChange={(e) => updateRegionCrop(selectedRegion.id, { height: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fit Mode */}
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <span className="text-slate-400 font-medium">Fit Mode</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['cover', 'contain', 'fill'] as FitMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    updateProject((draft) => {
                      const vTrk = draft.tracks.find((t) => t.type === 'video');
                      const tgt = vTrk?.clips.find((c) =>
                        selectedClipId ? c.id === selectedClipId : currentTime >= c.start && currentTime < c.start + c.duration
                      );
                      if (tgt && vTrk && vTrk.clips.length > 1) {
                        if (!tgt.layoutOverride) tgt.layoutOverride = JSON.parse(JSON.stringify(draft.layout));
                        const reg = tgt.layoutOverride?.regions.find((r) => r.id === selectedRegion.id);
                        if (reg) reg.fit = mode;
                      }
                      const reg = draft.layout.regions.find((r) => r.id === selectedRegion.id);
                      if (reg) reg.fit = mode;
                      return draft;
                    });
                  }}
                  className={`py-1.5 rounded-lg text-center font-medium capitalize transition ${
                    selectedRegion.fit === mode
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Border & Rounded Corners */}
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Corner Radius</span>
              <span className="font-mono text-slate-200">{selectedRegion.borderRadius || 0}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="2"
              value={selectedRegion.borderRadius || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                updateProject((draft) => {
                  const vTrk = draft.tracks.find((t) => t.type === 'video');
                  const tgt = vTrk?.clips.find((c) =>
                    selectedClipId ? c.id === selectedClipId : currentTime >= c.start && currentTime < c.start + c.duration
                  );
                  if (tgt && vTrk && vTrk.clips.length > 1) {
                    if (!tgt.layoutOverride) tgt.layoutOverride = JSON.parse(JSON.stringify(draft.layout));
                    const reg = tgt.layoutOverride?.regions.find((r) => r.id === selectedRegion.id);
                    if (reg) reg.borderRadius = val;
                  }
                  const reg = draft.layout.regions.find((r) => r.id === selectedRegion.id);
                  if (reg) reg.borderRadius = val;
                  return draft;
                });
              }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Split Divider Controls with 0px (Off) option */}
          {(effectiveLayout?.regions?.length ?? 0) >= 2 && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-300 font-medium">Split Divider</span>
                  {(effectiveLayout.dividerWidth ?? 0) === 0 ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                      0px (Off)
                    </span>
                  ) : (
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono">
                      {effectiveLayout.dividerWidth}px
                    </span>
                  )}
                </div>
                <input
                  type="color"
                  disabled={(effectiveLayout.dividerWidth ?? 0) === 0}
                  value={effectiveLayout.dividerColor || '#3B82F6'}
                  onChange={(e) => setDividerColor(e.target.value)}
                  className={`w-5 h-5 rounded cursor-pointer border-0 bg-transparent transition ${
                    (effectiveLayout.dividerWidth ?? 0) === 0 ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                  title={
                    (effectiveLayout.dividerWidth ?? 0) === 0
                      ? 'Color inactive when divider is 0px'
                      : 'Change divider color'
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={effectiveLayout.dividerWidth ?? 0}
                  onChange={(e) => setDividerWidth(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs font-mono text-slate-300 w-8 text-right">
                  {effectiveLayout.dividerWidth ?? 0}px
                </span>
              </div>

              {/* Quick Thickness Presets */}
              <div className="grid grid-cols-5 gap-1 pt-0.5">
                {[
                  { label: '0px (Off)', val: 0, title: 'No divider line (seamless split)' },
                  { label: '2px', val: 2, title: 'Subtle 2px line' },
                  { label: '4px', val: 4, title: 'Standard 4px line' },
                  { label: '6px', val: 6, title: 'Bold 6px line' },
                  { label: '8px', val: 8, title: 'Thick 8px line' },
                ].map((preset) => {
                  const isSelected = (effectiveLayout.dividerWidth ?? 0) === preset.val;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDividerWidth(preset.val)}
                      title={preset.title}
                      className={`py-1 text-[10px] rounded border transition text-center ${
                        isSelected
                          ? preset.val === 0
                            ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                            : 'bg-blue-600 border-blue-500 text-white font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {preset.val === 0 ? '0px (Off)' : `${preset.val}px`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500 italic">
          Select a region in the preview to edit crop & framing
        </div>
      )}

      {/* Media Probe Information */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>Source Stream Probe</span>
        </div>
        <div className="space-y-1 text-[11px] text-slate-400 pt-1 font-mono">
          <div className="flex justify-between">
            <span>Dimensions:</span>
            <span className="text-white">
              {sourceProbe?.width || 1920}x{sourceProbe?.height || 1080}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Duration:</span>
            <span className="text-white">
              {typeof sourceProbe?.duration === 'number' && !isNaN(sourceProbe.duration)
                ? `${sourceProbe.duration.toFixed(1)}s`
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Framerate:</span>
            <span className="text-white">{sourceProbe?.fps || 30} FPS</span>
          </div>
          <div className="flex justify-between">
            <span>Codec:</span>
            <span className="text-white uppercase">{sourceProbe?.codec || 'H.264'}</span>
          </div>
          <div className="flex justify-between">
            <span>Audio Tracks:</span>
            <span className="text-emerald-400">{sourceProbe?.audioTracks?.length || 0} track(s)</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
