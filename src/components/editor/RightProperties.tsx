'use client';

import React from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { Sliders, Crop, Info, Box, Maximize2 } from 'lucide-react';
import { FitMode } from '@/lib/types';

export default function RightProperties() {
  const { project, selectedRegionId, updateRegionCrop, updateProject } = useEditorStore();

  if (!project) return null;

  const selectedRegion = project.layout.regions.find((r) => r.id === selectedRegionId);
  const probe = project.source.probe;

  return (
    <aside className="w-72 border-l border-slate-800 bg-slate-950/90 flex flex-col z-30 select-none overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
      {/* Panel Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-slate-400">
        <Sliders className="w-4 h-4 text-blue-400" />
        <span className="font-bold text-white uppercase tracking-wider text-[11px]">
          Inspector & Properties
        </span>
      </div>

      {/* Region Crop & Framing Inspector */}
      {selectedRegion ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{selectedRegion.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Region ID: {selectedRegion.id}
            </span>
          </div>

          {/* Crop Rectangle Coordinates */}
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Crop className="w-3.5 h-3.5 text-blue-400" />
              <span>Source Crop Rectangle</span>
            </div>

            {/* Crop X */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Horizontal Position (X)</span>
                <span className="font-mono text-slate-200">
                  {Math.round(selectedRegion.crop.x * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.01"
                value={selectedRegion.crop.x}
                onChange={(e) => updateRegionCrop(selectedRegion.id, { x: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Crop Y */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Vertical Position (Y)</span>
                <span className="font-mono text-slate-200">
                  {Math.round(selectedRegion.crop.y * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.01"
                value={selectedRegion.crop.y}
                onChange={(e) => updateRegionCrop(selectedRegion.id, { y: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Crop Width */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Crop Width</span>
                <span className="font-mono text-slate-200">
                  {Math.round(selectedRegion.crop.width * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.01"
                value={selectedRegion.crop.width}
                onChange={(e) => updateRegionCrop(selectedRegion.id, { width: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Crop Height */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Crop Height</span>
                <span className="font-mono text-slate-200">
                  {Math.round(selectedRegion.crop.height * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.01"
                value={selectedRegion.crop.height}
                onChange={(e) => updateRegionCrop(selectedRegion.id, { height: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
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
                updateProject((draft) => {
                  const reg = draft.layout.regions.find((r) => r.id === selectedRegion.id);
                  if (reg) reg.borderRadius = parseInt(e.target.value, 10);
                  return draft;
                });
              }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500 italic">
          Select a region in the canvas to edit crop & framing
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
              {probe?.width}x{probe?.height}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Duration:</span>
            <span className="text-white">{probe?.duration.toFixed(1)}s</span>
          </div>
          <div className="flex justify-between">
            <span>Framerate:</span>
            <span className="text-white">{probe?.fps} FPS</span>
          </div>
          <div className="flex justify-between">
            <span>Codec:</span>
            <span className="text-white uppercase">{probe?.codec}</span>
          </div>
          <div className="flex justify-between">
            <span>Audio Tracks:</span>
            <span className="text-emerald-400">{probe?.audioTracks.length || 0} track(s)</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
