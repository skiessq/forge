'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import {
  LayoutTemplate,
  Type,
  Volume2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Sliders,
  Check,
} from 'lucide-react';
import { LayoutTemplateId } from '@/lib/types';

export default function LeftSidebar() {
  const { project, setLayoutTemplate, setSplitRatio, updateProject } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'layout' | 'media' | 'subtitles' | 'audio' | 'effects'>('layout');

  if (!project) return null;

  const templates: { id: LayoutTemplateId; title: string; desc: string }[] = [
    {
      id: 'split_facecam_top',
      title: 'Split (Facecam Top)',
      desc: 'Top: Facecam crop, Bottom: Full gameplay',
    },
    {
      id: 'split_gameplay_top',
      title: 'Split (Game Top)',
      desc: 'Top: Gameplay, Bottom: Facecam crop',
    },
    {
      id: 'gameplay_full',
      title: 'Gameplay Full Frame',
      desc: 'Fills the 9:16 canvas with smart crop',
    },
    {
      id: 'blurred_background_fit',
      title: 'Blurred Background',
      desc: 'Fit clip centered with zoomed blurred copy behind',
    },
    {
      id: 'picture_in_picture',
      title: 'Picture-in-Picture',
      desc: 'Facecam as rounded floating overlay on gameplay',
    },
    {
      id: 'media_top_game_bottom',
      title: 'Media Top / Gameplay Bottom',
      desc: 'Top: Uploaded GIF / Image / Video, Bottom: Game',
    },
    {
      id: 'media_bottom_game_top',
      title: 'Media Bottom / Gameplay Top',
      desc: 'Bottom: Uploaded GIF / Image / Video, Top: Game',
    },
  ];

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-950/90 flex flex-col z-30 select-none">
      {/* Category Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950 px-2 pt-2 gap-1 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('layout')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'layout'
              ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          <span>Layout</span>
        </button>
        <button
          onClick={() => setActiveTab('subtitles')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'subtitles'
              ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Captions</span>
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'audio'
              ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Audio</span>
        </button>
        <button
          onClick={() => setActiveTab('effects')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'effects'
              ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Effects</span>
        </button>
      </div>

      {/* Tab Content Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: LAYOUT TEMPLATES */}
        {activeTab === 'layout' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Layout Template
              </h3>
              <div className="space-y-2">
                {templates.map((tpl) => {
                  const isActive = project.layout.templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => setLayoutTemplate(tpl.id)}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between ${
                        isActive
                          ? 'bg-blue-600/10 border-blue-500/80 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs flex items-center gap-1.5">
                          <span>{tpl.title}</span>
                          {isActive && <Check className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{tpl.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Split Ratio Slider (if split template) */}
            {(project.layout.templateId === 'split_facecam_top' ||
              project.layout.templateId === 'split_gameplay_top' ||
              project.layout.templateId === 'media_top_game_bottom' ||
              project.layout.templateId === 'media_bottom_game_top') && (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Split Ratio</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {Math.round((project.layout.splitRatio || 0.5) * 100)} /{' '}
                    {100 - Math.round((project.layout.splitRatio || 0.5) * 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="0.75"
                  step="0.05"
                  value={project.layout.splitRatio || 0.5}
                  onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>30/70</span>
                  <span>50/50</span>
                  <span>70/30</span>
                </div>
              </div>
            )}

            {/* Divider Line Style */}
            {project.layout.regions.length >= 2 && (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Divider Border</span>
                  <input
                    type="color"
                    value={project.layout.dividerColor || '#3B82F6'}
                    onChange={(e) => {
                      updateProject((draft) => {
                        draft.layout.dividerColor = e.target.value;
                        return draft;
                      });
                    }}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={project.layout.dividerWidth ?? 4}
                    onChange={(e) => {
                      updateProject((draft) => {
                        draft.layout.dividerWidth = parseInt(e.target.value, 10);
                        return draft;
                      });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs font-mono text-slate-400 w-6">
                    {project.layout.dividerWidth}px
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CAPTIONS / SUBTITLES PLACEHOLDER (Will be expanded in Phase 4) */}
        {activeTab === 'subtitles' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 text-slate-300">
              <span className="font-semibold text-white">Subtitle Engine</span>
              <p className="text-[11px] text-slate-400 leading-snug">
                One-click local Whisper AI speech-to-text with word-level timestamps and karaoke animation.
              </p>
              <div className="pt-2">
                <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono">
                  Phase 4 Feature
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIO RULES (Will be expanded in Phase 3) */}
        {activeTab === 'audio' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 text-slate-300">
              <span className="font-semibold text-white">Audio Integrity Rules</span>
              <p className="text-[11px] text-slate-400 leading-snug">
                By default, the original audio stream is kept 100% untouched. No silent cuts, no mute, no auto-noise removal.
              </p>
              <div className="pt-2">
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                  Default: Original Audio Untouched
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: EFFECTS & HOOKS (Phase 6) */}
        {activeTab === 'effects' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 text-slate-300">
              <span className="font-semibold text-white">Transitions & Intro Hooks</span>
              <p className="text-[11px] text-slate-400 leading-snug">
                Intro hook text, auto punch-in zooms at sentence starts, watermarks, and xfade transitions.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
