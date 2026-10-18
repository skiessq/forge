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
  Play,
  Move,
  Film,
} from 'lucide-react';
import { LayoutTemplateId, IntroHookTransition } from '@/lib/types';
import { BUILT_IN_FONTS } from '@/lib/constants';
import { ProjectTemplate } from '@/lib/storage/templates';
import SilenceRemovalModal from './SilenceRemovalModal';
import SubtitleEditor from './SubtitleEditor';
import AutoSplitModal from './AutoSplitModal';
import AutoHighlightModal from '@/components/highlight/AutoHighlightModal';
import SecondaryMediaManager from './SecondaryMediaManager';
import { Bookmark, FolderDown, PlusCircle } from 'lucide-react';

export default function LeftSidebar() {
  const {
    project,
    setLayoutTemplate,
    setSplitRatio,
    updateProject,
    setCurrentTime,
    setIsPlaying,
    selectedClipId,
    setSelectedClipId,
    layoutScope,
    setLayoutScope,
    currentTime,
  } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'layout' | 'media' | 'subtitles' | 'audio' | 'effects' | 'presets'>('layout');
  const [isSilenceModalOpen, setIsSilenceModalOpen] = useState(false);
  const [isAutoSplitOpen, setIsAutoSplitOpen] = useState(false);
  const [isAutoHighlightOpen, setIsAutoHighlightOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<ProjectTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const videoTrack = project?.tracks?.find((t) => t.type === 'video');
  const clips = videoTrack?.clips || [];
  const hasMultipleClips = clips.length > 1;

  const activeClip = hasMultipleClips
    ? (clips.find((c) => selectedClipId ? c.id === selectedClipId : currentTime >= c.start && currentTime < c.start + c.duration) || clips[0])
    : clips[0];
  const activeClipIndex = activeClip ? clips.indexOf(activeClip) : 0;

  const currentLayout = (hasMultipleClips && layoutScope === 'clip' && activeClip?.layoutOverride)
    ? activeClip.layoutOverride
    : (activeClip?.layoutOverride || project?.layout);

  const videoDuration = Math.round((videoTrack?.clips?.reduce((acc, c) => acc + c.duration, 0) || project?.source?.probe?.duration || 30) * 10) / 10;

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setIsSavingTemplate(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          layout: project?.layout,
          subtitleStyle: project?.subtitleStyle,
          introHook: project?.introHook,
          watermark: project?.watermark,
          audioSettings: project?.audioSettings,
        }),
      });
      const d = await res.json();
      if (d.template) {
        setSavedTemplates((prev) => [...prev.filter((t) => t.id !== d.template.id), d.template]);
        setNewTemplateName('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleApplyTemplate = (tpl: ProjectTemplate) => {
    updateProject((draft) => {
      draft.layout = tpl.layout;
      draft.subtitleStyle = tpl.subtitleStyle;
      if (tpl.introHook) draft.introHook = tpl.introHook;
      if (tpl.watermark) draft.watermark = tpl.watermark;
      if (tpl.audioSettings) draft.audioSettings = tpl.audioSettings;
      return draft;
    });
  };

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
        <button
          onClick={() => {
            setActiveTab('presets');
            fetch('/api/templates')
              .then((r) => r.json())
              .then((d) => setSavedTemplates(d.templates || []))
              .catch(console.error);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'presets'
              ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Templates</span>
        </button>
      </div>

      {/* Tab Content Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: LAYOUT TEMPLATES */}
        {activeTab === 'layout' && (
          <div className="space-y-4">
            {/* Multi-Clip Segment Header & Scope Switcher */}
            {hasMultipleClips && (
              <div className="p-3 bg-gradient-to-r from-blue-950/50 via-slate-900 to-indigo-950/40 border border-blue-500/30 rounded-xl space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-bold text-white">
                      {activeClip ? `Segment ${activeClipIndex + 1}` : 'Selected Clip'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({(activeClip?.duration || 0).toFixed(1)}s)
                    </span>
                  </div>
                  {/* Next / Prev Navigation between split clips */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = clips[activeClipIndex - 1];
                        if (prev) {
                          setSelectedClipId(prev.id);
                          setCurrentTime(prev.start);
                        }
                      }}
                      disabled={activeClipIndex <= 0}
                      className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300 font-medium"
                      title="Previous clip"
                    >
                      ◀ Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = clips[activeClipIndex + 1];
                        if (next) {
                          setSelectedClipId(next.id);
                          setCurrentTime(next.start);
                        }
                      }}
                      disabled={activeClipIndex >= clips.length - 1}
                      className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300 font-medium"
                      title="Next clip"
                    >
                      Next ▶
                    </button>
                  </div>
                </div>

                {/* Scope selector */}
                <div className="grid grid-cols-2 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setLayoutScope('clip')}
                    className={`py-1 rounded-md transition ${
                      layoutScope === 'clip'
                        ? 'bg-blue-600 text-white font-semibold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    This Clip Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutScope('all')}
                    className={`py-1 rounded-md transition ${
                      layoutScope === 'all'
                        ? 'bg-blue-600 text-white font-semibold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Clips
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {layoutScope === 'clip'
                    ? `Layout and crops will only apply to Segment ${activeClipIndex + 1}.`
                    : 'Layout changes will apply to all clips on the timeline.'}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Layout Template
                </h3>
                {hasMultipleClips && layoutScope === 'clip' && (
                  <span className="text-[10px] text-blue-400 font-mono font-medium">
                    Segment {activeClipIndex + 1}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {templates.map((tpl) => {
                  const isActive = (currentLayout?.templateId || project.layout.templateId) === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => setLayoutTemplate(tpl.id, layoutScope === 'clip' ? activeClip?.id : null)}
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

            {/* Secondary Media Upload & Manager (for Media Top / Media Bottom templates) */}
            <SecondaryMediaManager />

            {/* Split Ratio Slider (if split template) */}
            {(currentLayout?.templateId === 'split_facecam_top' ||
              currentLayout?.templateId === 'split_gameplay_top' ||
              currentLayout?.templateId === 'media_top_game_bottom' ||
              currentLayout?.templateId === 'media_bottom_game_top') && (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Split Ratio</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Unstretched
                    </span>
                    <span className="font-mono text-blue-400 font-bold">
                      {Math.round((currentLayout.splitRatio || 0.5) * 100)} /{' '}
                      {100 - Math.round((currentLayout.splitRatio || 0.5) * 100)}
                    </span>
                  </div>
                </div>

                <input
                  type="range"
                  min="0.20"
                  max="0.80"
                  step="0.01"
                  value={currentLayout.splitRatio || 0.5}
                  onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />

                {/* Quick Split Ratio Presets */}
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {[
                    { label: '25/75', val: 0.25, title: '25% Cam / 75% Game' },
                    { label: '33/67', val: 0.33, title: '1/3 Cam / 2/3 Game' },
                    { label: '50/50', val: 0.50, title: 'Equal Half Split' },
                    { label: '67/33', val: 0.67, title: '2/3 Game / 1/3 Cam' },
                    { label: '75/25', val: 0.75, title: '75% Game / 25% Cam' },
                  ].map((preset) => {
                    const isSelected = Math.abs((project.layout.splitRatio || 0.5) - preset.val) < 0.02;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setSplitRatio(preset.val)}
                        title={preset.title}
                        className={`py-1 text-[10px] font-mono rounded border transition text-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Divider Line Style with 0px (Seamless) support */}
            {project.layout.regions.length >= 2 && (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-300 font-medium">Divider Border</span>
                    {(project.layout.dividerWidth ?? 0) === 0 ? (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                        0px (Seamless)
                      </span>
                    ) : (
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono">
                        {project.layout.dividerWidth}px
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={(project.layout.dividerWidth ?? 0) === 0}
                      value={project.layout.dividerColor || '#3B82F6'}
                      onChange={(e) => {
                        updateProject((draft) => {
                          draft.layout.dividerColor = e.target.value;
                          return draft;
                        });
                      }}
                      className={`w-5 h-5 rounded cursor-pointer border-0 bg-transparent transition ${
                        (project.layout.dividerWidth ?? 0) === 0 ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                      title={
                        (project.layout.dividerWidth ?? 0) === 0
                          ? 'Color inactive when divider is 0px'
                          : 'Change divider color'
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={project.layout.dividerWidth ?? 0}
                    onChange={(e) => {
                      updateProject((draft) => {
                        draft.layout.dividerWidth = parseInt(e.target.value, 10);
                        return draft;
                      });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs font-mono text-slate-300 w-8 text-right">
                    {project.layout.dividerWidth ?? 0}px
                  </span>
                </div>

                {/* Quick Thickness Presets including 0px */}
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {[
                    { label: '0px (Off)', val: 0, title: 'Seamless split (no divider line)' },
                    { label: '2px', val: 2, title: 'Subtle 2px line' },
                    { label: '4px', val: 4, title: 'Standard 4px line' },
                    { label: '6px', val: 6, title: 'Bold 6px line' },
                    { label: '8px', val: 8, title: 'Thick 8px line' },
                  ].map((preset) => {
                    const isSelected = (project.layout.dividerWidth ?? 0) === preset.val;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          updateProject((draft) => {
                            draft.layout.dividerWidth = preset.val;
                            return draft;
                          });
                        }}
                        title={preset.title}
                        className={`py-1 text-[10px] rounded border transition text-center ${
                          isSelected
                            ? preset.val === 0
                              ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-sm'
                              : 'bg-blue-600 border-blue-500 text-white font-bold shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
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
            {/* Intro Hook Studio */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white uppercase tracking-wider text-[10px]">
                    Intro Hook Headline
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    Viral
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={project.introHook?.enabled ?? false}
                  onChange={(e) => {
                    updateProject((draft) => {
                      if (!draft.introHook) {
                        draft.introHook = {
                          enabled: true,
                          text: 'WATCH TILL THE END! 🔥',
                          duration: 2.5,
                          fontSize: 56,
                          color: '#FFE600',
                          highlightColor: '#FFFFFF',
                          fontFamily: 'Montserrat',
                          transition: 'bounce_drop',
                          positionX: 0.5,
                          positionY: 0.22,
                        };
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
                <div className="space-y-3 pt-1">
                  {/* Test Playback button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTime(0);
                      setIsPlaying(true);
                    }}
                    className="w-full py-1.5 rounded-lg bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/40 hover:to-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-amber-300" />
                    <span>Preview Hook Transition (0s)</span>
                  </button>

                  {/* Hook Text Input with highlight tips */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] text-slate-400 font-medium">Hook Headline</label>
                      <span className="text-[9px] text-amber-400 font-mono">Wrap *word* to highlight</span>
                    </div>
                    <textarea
                      rows={2}
                      value={project.introHook.text}
                      onChange={(e) => {
                        updateProject((draft) => {
                          if (draft.introHook) draft.introHook.text = e.target.value;
                          return draft;
                        });
                      }}
                      placeholder="e.g. *WAIT* FOR THE END! 😱"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-medium text-xs resize-y min-h-[46px]"
                    />
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      Tip: Use Enter or \n for custom line breaks, or choose words per line below.
                    </div>
                  </div>

                  {/* Words Per Line / Line Break Mode */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] text-slate-400 font-medium">Line Layout / Words Per Line</label>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {project.introHook.wordsPerLine === -1
                          ? 'Single Line'
                          : (project.introHook.wordsPerLine ?? 0) === 0
                          ? 'Auto'
                          : `${project.introHook.wordsPerLine} words/line`}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { label: 'Auto', val: 0 },
                        { label: '1 Line', val: -1 },
                        { label: '2 Words', val: 2 },
                        { label: '3 Words', val: 3 },
                        { label: '4 Words', val: 4 },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => {
                            updateProject((draft) => {
                              if (draft.introHook) draft.introHook.wordsPerLine = opt.val;
                              return draft;
                            });
                          }}
                          className={`py-1 text-[10px] rounded font-semibold transition border ${
                            (project.introHook.wordsPerLine ?? 0) === opt.val
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size Control */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-slate-400 font-medium">Font Size</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="16"
                          max="90"
                          value={project.introHook.fontSize || 42}
                          onChange={(e) => {
                            const val = Math.max(14, Math.min(100, parseInt(e.target.value) || 32));
                            updateProject((draft) => {
                              if (draft.introHook) draft.introHook.fontSize = val;
                              return draft;
                            });
                          }}
                          className="w-12 px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-white text-[11px] text-right"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="18"
                      max="72"
                      step="2"
                      value={project.introHook.fontSize || 42}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        updateProject((draft) => {
                          if (draft.introHook) draft.introHook.fontSize = val;
                          return draft;
                        });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex gap-1 mt-1.5">
                      {[
                        { label: 'Compact 26px', size: 26 },
                        { label: 'Normal 36px', size: 36 },
                        { label: 'Medium 46px', size: 46 },
                        { label: 'Large 58px', size: 58 },
                      ].map((preset) => (
                        <button
                          key={preset.size}
                          type="button"
                          onClick={() => {
                            updateProject((draft) => {
                              if (draft.introHook) draft.introHook.fontSize = preset.size;
                              return draft;
                            });
                          }}
                          className={`flex-1 py-0.5 text-[9px] rounded font-medium transition border ${
                            (project.introHook.fontSize || 42) === preset.size
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-white'
                          }`}
                        >
                          {preset.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transition Effect Selector */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Transition Animation</label>
                    <select
                      value={project.introHook.transition || 'bounce_drop'}
                      onChange={(e) => {
                        updateProject((draft) => {
                          if (draft.introHook) {
                            draft.introHook.transition = e.target.value as IntroHookTransition;
                          }
                          return draft;
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-medium"
                    >
                      <option value="static">📌 Static (No Animation / Clean Hold)</option>
                      <option value="bounce_drop">💥 Bounce Drop (Viral Pop 🔥)</option>
                      <option value="zoom_pop">⚡ Zoom Pop (Impact Punch)</option>
                      <option value="slide_down">⬇ Slide Down (Smooth In)</option>
                      <option value="glitch">👾 Glitch Jitter (Cyberpunk)</option>
                      <option value="fade_zoom">🎬 Fade & Zoom (Cinematic)</option>
                      <option value="pop_in">🎯 Snappy Pop In</option>
                    </select>
                  </div>

                  {/* Viral Font Selector */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Viral Typography</label>
                    <select
                      value={project.introHook.fontFamily || 'Montserrat'}
                      onChange={(e) => {
                        updateProject((draft) => {
                          if (draft.introHook) draft.introHook.fontFamily = e.target.value;
                          return draft;
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-medium"
                    >
                      {BUILT_IN_FONTS.map((font) => (
                        <option key={font.name} value={font.name}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Colors: Primary & Highlight Punch */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Primary Color</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={project.introHook.color || '#FFE600'}
                          onChange={(e) => {
                            updateProject((draft) => {
                              if (draft.introHook) draft.introHook.color = e.target.value;
                              return draft;
                            });
                          }}
                          className="w-8 h-7 rounded cursor-pointer bg-slate-950 border border-slate-800 flex-shrink-0"
                        />
                        <span className="font-mono text-[10px] text-slate-300 uppercase">
                          {project.introHook.color || '#FFE600'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Highlight Color</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={project.introHook.highlightColor || '#FFFFFF'}
                          onChange={(e) => {
                            updateProject((draft) => {
                              if (draft.introHook) draft.introHook.highlightColor = e.target.value;
                              return draft;
                            });
                          }}
                          className="w-8 h-7 rounded cursor-pointer bg-slate-950 border border-slate-800 flex-shrink-0"
                        />
                        <span className="font-mono text-[10px] text-slate-300 uppercase">
                          {project.introHook.highlightColor || '#FFFFFF'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Duration & Whole Video Control */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Duration on Screen</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max={videoDuration}
                          disabled={project.introHook.stayWholeVideo}
                          value={project.introHook.stayWholeVideo ? videoDuration : (project.introHook.duration || 2.5)}
                          onChange={(e) => {
                            const val = Math.max(0.5, Math.min(videoDuration, parseFloat(e.target.value) || 2.5));
                            updateProject((draft) => {
                              if (draft.introHook) {
                                draft.introHook.duration = val;
                                draft.introHook.stayWholeVideo = false;
                              }
                              return draft;
                            });
                          }}
                          className="w-14 px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-white text-[11px] text-right disabled:opacity-50"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">sec</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0.5"
                      max={videoDuration}
                      step="0.1"
                      disabled={project.introHook.stayWholeVideo}
                      value={project.introHook.stayWholeVideo ? videoDuration : (project.introHook.duration || 2.5)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateProject((draft) => {
                          if (draft.introHook) {
                            draft.introHook.duration = val;
                            draft.introHook.stayWholeVideo = false;
                          }
                          return draft;
                        });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
                    />

                    {/* Quick Duration & Whole Video Toggles */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {[
                        { label: '2.5s', dur: 2.5 },
                        { label: '5s', dur: 5.0 },
                        { label: '10s', dur: 10.0 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            updateProject((draft) => {
                              if (draft.introHook) {
                                draft.introHook.duration = preset.dur;
                                draft.introHook.stayWholeVideo = false;
                              }
                              return draft;
                            });
                          }}
                          className={`px-2 py-0.5 text-[10px] rounded font-medium border transition ${
                            !project.introHook.stayWholeVideo && project.introHook.duration === preset.dur
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}

                      {/* Stay Whole Video Button */}
                      <button
                        type="button"
                        onClick={() => {
                          updateProject((draft) => {
                            if (draft.introHook) {
                              draft.introHook.stayWholeVideo = !draft.introHook.stayWholeVideo;
                              if (draft.introHook.stayWholeVideo) {
                                draft.introHook.duration = videoDuration;
                              }
                            }
                            return draft;
                          });
                        }}
                        className={`flex-1 py-0.5 text-[10px] rounded font-semibold border transition flex items-center justify-center gap-1 ${
                          project.introHook.stayWholeVideo
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : 'bg-slate-950 text-amber-400 border-amber-500/30 hover:border-amber-500/60'
                        }`}
                      >
                        <span>Entire Video ({videoDuration}s)</span>
                      </button>
                    </div>
                  </div>

                  {/* Direct Screen Positioning Section */}
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                        <Move className="w-3 h-3 text-amber-400" />
                        <span>Screen Positioning</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          updateProject((draft) => {
                            if (draft.introHook) {
                              draft.introHook.positionX = 0.5;
                              draft.introHook.positionY = 0.22;
                            }
                            return draft;
                          });
                        }}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold"
                      >
                        Reset Center
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Horizontal (X)</span>
                          <span className="font-mono text-white">
                            {Math.round((project.introHook.positionX ?? 0.5) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="0.9"
                          step="0.02"
                          value={project.introHook.positionX ?? 0.5}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateProject((draft) => {
                              if (draft.introHook) draft.introHook.positionX = val;
                              return draft;
                            });
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Vertical (Y)</span>
                          <span className="font-mono text-white">
                            {Math.round((project.introHook.positionY ?? 0.22) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.08"
                          max="0.9"
                          step="0.02"
                          value={project.introHook.positionY ?? 0.22}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateProject((draft) => {
                              if (draft.introHook) draft.introHook.positionY = val;
                              return draft;
                            });
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400/90 bg-amber-500/10 border border-amber-500/20 p-1.5 rounded flex items-center gap-1.5">
                      <span>💡</span>
                      <span>You can also click & drag the hook directly on the video preview!</span>
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

        {/* TAB 5: PRESETS & REUSABLE TEMPLATES */}
        {activeTab === 'presets' && (
          <div className="space-y-5">
            {/* AI Auto-Highlight Viral Moments (NEW) */}
            <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-amber-500/30 rounded-2xl space-y-2.5 shadow-lg shadow-amber-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white text-xs">Auto-Highlight AI</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 tracking-wider">
                  VIRAL PIPELINE
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Extract the 10-20 highest performing clips in this video using audio energy spikes, sentence windows, and LLM scoring.
              </p>
              <button
                onClick={() => setIsAutoHighlightOpen(true)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-indigo-600 to-blue-600 hover:from-amber-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Launch Auto-Highlight Studio</span>
              </button>
            </div>

            {/* AI Auto-Split Long Clip */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-blue-400 -rotate-45" />
                <span className="font-bold text-white text-xs">Pacing Auto-Split</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Segment clip based on transcript sentence clusters and pacing.
              </p>
              <button
                onClick={() => setIsAutoSplitOpen(true)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <Scissors className="w-3.5 h-3.5 -rotate-45" />
                <span>Basic Auto-Split</span>
              </button>
            </div>

            {/* Save Current as Template */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-white text-xs">Save Current Template</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Save your current layout framing, subtitle typography, visual effects, and audio settings as a reusable template.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Template Name (e.g. Neon Facecam Top)"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSavingTemplate || !newTemplateName.trim()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {/* Saved Templates List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Saved Reusable Templates ({savedTemplates.length})
              </span>

              {savedTemplates.length === 0 ? (
                <div className="p-4 border border-dashed border-slate-800 rounded-xl text-center text-[11px] text-slate-500">
                  No saved templates yet. Name and save your first template above!
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {savedTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-xs">{tpl.name}</span>
                        <button
                          onClick={() => handleApplyTemplate(tpl)}
                          className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <FolderDown className="w-3 h-3" />
                          <span>Apply</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {tpl.layout?.templateId}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">
                          Font: {tpl.subtitleStyle?.fontFamily || 'Outfit'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Silence Removal & Preview Modal */}
      <SilenceRemovalModal
        isOpen={isSilenceModalOpen}
        onClose={() => setIsSilenceModalOpen(false)}
      />

      {/* Auto-Split Modal */}
      <AutoSplitModal
        isOpen={isAutoSplitOpen}
        onClose={() => setIsAutoSplitOpen(false)}
      />

      {/* Auto-Highlight Studio Modal */}
      <AutoHighlightModal
        isOpen={isAutoHighlightOpen}
        onClose={() => setIsAutoHighlightOpen(false)}
        projectId={project.id}
        sourcePath={project.source.path}
        sourceDuration={project.source.probe?.duration}
      />
    </aside>
  );
}
