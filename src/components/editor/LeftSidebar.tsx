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
  Scissors,
} from 'lucide-react';
import { LayoutTemplateId } from '@/lib/types';
import SilenceRemovalModal from './SilenceRemovalModal';
import SubtitleEditor from './SubtitleEditor';

export default function LeftSidebar() {
  const { project, setLayoutTemplate, setSplitRatio, updateProject } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'layout' | 'media' | 'subtitles' | 'audio' | 'effects'>('layout');
  const [isSilenceModalOpen, setIsSilenceModalOpen] = useState(false);

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

        {/* TAB 2: CAPTIONS / SUBTITLES */}
        {activeTab === 'subtitles' && <SubtitleEditor />}

        {/* TAB 3: AUDIO RULES */}
        {activeTab === 'audio' && (
          <div className="space-y-4 text-xs">
            {/* Original Audio Guaranteed Untouched */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Original Audio Stream
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Bitstream Copy
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Voice and game sounds are kept exactly as recorded by default. No silent cuts, no mute, no unwanted denoising.
              </p>
            </div>

            {/* Source Audio Track Selection */}
            {project.source.probe?.audioTracks && project.source.probe.audioTracks.length > 1 && (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <label className="font-semibold text-slate-200 block">Select Audio Track</label>
                <select
                  value={project.audioSettings.sourceAudioTrackIndex}
                  onChange={(e) => {
                    updateProject((draft) => {
                      draft.audioSettings.sourceAudioTrackIndex = parseInt(e.target.value, 10);
                      return draft;
                    });
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none"
                >
                  {project.source.probe.audioTracks.map((tr) => (
                    <option key={tr.index} value={tr.index}>
                      Track {tr.index + 1}: {tr.title || tr.codec} ({tr.channels}ch)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Optional Toggles (OFF by default) */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                Optional Audio Processing
              </span>

              {/* Loudness Normalization */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-white font-medium block">Normalize Loudness</span>
                  <span className="text-[11px] text-slate-400">EBU R128 broadcast standard</span>
                </div>
                <input
                  type="checkbox"
                  checked={project.audioSettings.normalizeLoudness}
                  onChange={(e) => {
                    updateProject((draft) => {
                      draft.audioSettings.normalizeLoudness = e.target.checked;
                      return draft;
                    });
                  }}
                  className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 w-4 h-4"
                />
              </label>

              {/* Auto Ducking */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-white font-medium block">Game Audio Ducking</span>
                    <span className="text-[11px] text-slate-400">Lower game volume during speech</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={project.audioSettings.duckGameAudio}
                    onChange={(e) => {
                      updateProject((draft) => {
                        draft.audioSettings.duckGameAudio = e.target.checked;
                        return draft;
                      });
                    }}
                    className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 w-4 h-4"
                  />
                </label>
              </div>

              {/* Background Music Track */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium block">Background Music Track</span>
                    <span className="text-[11px] text-slate-400">Mix background song</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Music Volume</span>
                    <span className="font-mono text-white">
                      {Math.round((project.audioSettings.backgroundMusicVolume ?? 0.25) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={project.audioSettings.backgroundMusicVolume ?? 0.25}
                    onChange={(e) => {
                      updateProject((draft) => {
                        draft.audioSettings.backgroundMusicVolume = parseFloat(e.target.value);
                        return draft;
                      });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Silence Remover Tool Button */}
            <div className="pt-2">
              <button
                onClick={() => setIsSilenceModalOpen(true)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-medium rounded-xl transition flex items-center justify-center gap-2"
              >
                <Scissors className="w-3.5 h-3.5 text-rose-400 -rotate-45" />
                <span>Remove Silences Tool (Preview First)</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: EFFECTS & HOOKS */}
        {activeTab === 'effects' && (
          <div className="space-y-4 text-xs">
            {/* Intro Hook Text */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase tracking-wider text-[10px]">
                  Intro Hook Text
                </span>
                <input
                  type="checkbox"
                  checked={project.introHook?.enabled ?? false}
                  onChange={(e) => {
                    updateProject((draft) => {
                      if (!draft.introHook) {
                        draft.introHook = { enabled: true, text: 'WATCH TILL THE END! 🔥', duration: 2.5, fontSize: 56, color: '#FFE600' };
                      } else {
                        draft.introHook.enabled = e.target.checked;
                      }
                      return draft;
                    });
                  }}
                  className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 w-4 h-4"
                />
              </div>

              {project.introHook?.enabled && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Hook Text</label>
                    <input
                      type="text"
                      value={project.introHook.text}
                      onChange={(e) => {
                        updateProject((draft) => {
                          if (draft.introHook) draft.introHook.text = e.target.value;
                          return draft;
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Duration</span>
                        <span className="font-mono text-white">{project.introHook.duration}s</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="5.0"
                        step="0.5"
                        value={project.introHook.duration}
                        onChange={(e) => {
                          updateProject((draft) => {
                            if (draft.introHook) draft.introHook.duration = parseFloat(e.target.value);
                            return draft;
                          });
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Color</label>
                      <input
                        type="color"
                        value={project.introHook.color}
                        onChange={(e) => {
                          updateProject((draft) => {
                            if (draft.introHook) draft.introHook.color = e.target.value;
                            return draft;
                          });
                        }}
                        className="w-full h-6 rounded cursor-pointer bg-slate-950 border border-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Watermark Overlay */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase tracking-wider text-[10px]">
                  Watermark Overlay
                </span>
                <input
                  type="checkbox"
                  checked={project.watermark?.enabled ?? false}
                  onChange={(e) => {
                    updateProject((draft) => {
                      if (!draft.watermark) {
                        draft.watermark = { enabled: true, opacity: 0.8, position: 'top-right', scale: 0.2 };
                      } else {
                        draft.watermark.enabled = e.target.checked;
                      }
                      return draft;
                    });
                  }}
                  className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 w-4 h-4"
                />
              </div>

              {project.watermark?.enabled && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Position</label>
                    <select
                      value={project.watermark.position}
                      onChange={(e) => {
                        updateProject((draft) => {
                          if (draft.watermark) draft.watermark.position = e.target.value as any;
                          return draft;
                        });
                      }}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    >
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Opacity</span>
                      <span className="font-mono text-white">
                        {Math.round((project.watermark.opacity || 0.8) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={project.watermark.opacity || 0.8}
                      onChange={(e) => {
                        updateProject((draft) => {
                          if (draft.watermark) draft.watermark.opacity = parseFloat(e.target.value);
                          return draft;
                        });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Auto Punch-in Assistant */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <span className="font-bold text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Auto Punch-In Assistant
              </span>
              <p className="text-[11px] text-slate-400 leading-snug">
                Detects sentence beginnings from your subtitles and applies subtle zoom punch-ins to maintain audience attention.
              </p>
              <button
                onClick={() => {
                  const { detectAutoPunchIns } = require('@/lib/effects/autoPunchIn');
                  const punches = detectAutoPunchIns(project);
                  alert(`Suggested ${punches.length} punch-in moments! Applied to project.`);
                }}
                className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-semibold rounded-lg transition text-xs flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Suggest Sentence Punch-Ins</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Silence Removal & Preview Modal */}
      <SilenceRemovalModal
        isOpen={isSilenceModalOpen}
        onClose={() => setIsSilenceModalOpen(false)}
      />
    </aside>
  );
}
