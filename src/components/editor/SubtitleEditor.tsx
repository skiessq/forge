'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import {
  Sparkles,
  Type,
  Plus,
  Trash2,
  Download,
  Upload,
  Split,
  Merge,
  Loader2,
  Check,
  Palette,
  Sliders,
} from 'lucide-react';
import { SUBTITLE_PRESETS, BUILT_IN_FONTS } from '@/lib/constants';
import { SubtitleItem, SubtitleAnimation, JobProgress } from '@/lib/types';
import { exportToSrt, parseSrt, generateAssSubtitles } from '@/lib/subtitles/assGenerator';

export default function SubtitleEditor() {
  const { project, updateProject, currentTime, setCurrentTime } = useEditorStore();
  const [subTab, setSubTab] = useState<'transcript' | 'style'>('transcript');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [job, setJob] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!project) return null;

  // Trigger Whisper Auto-Transcription
  const handleAutoTranscribe = async () => {
    setIsTranscribing(true);
    setError(null);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, modelSize: 'base' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to start transcription');

      const sse = new EventSource(`/api/jobs/${data.jobId}`);
      sse.onmessage = (event) => {
        const jobData: JobProgress = JSON.parse(event.data);
        setJob(jobData);

        if (jobData.status === 'completed') {
          sse.close();
          setIsTranscribing(false);
          // Reload project subtitles
          fetch(`/api/projects/${project.id}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.project?.subtitles) {
                updateProject((draft) => {
                  draft.subtitles = d.project.subtitles;
                  return draft;
                });
              }
            });
        } else if (jobData.status === 'failed') {
          sse.close();
          setIsTranscribing(false);
          setError(jobData.error || 'Transcription failed');
        }
      };

      sse.onerror = () => {
        sse.close();
        if (isTranscribing) {
          setError('Lost connection to transcription worker');
          setIsTranscribing(false);
        }
      };
    } catch (e: any) {
      setError(e.message);
      setIsTranscribing(false);
    }
  };

  // Add a new subtitle cue at current playhead
  const handleAddSubtitle = () => {
    const newSub: SubtitleItem = {
      id: `sub_${Date.now()}`,
      start: currentTime,
      end: Math.min(project.source.probe?.duration || 10, currentTime + 2.0),
      text: 'New Subtitle',
      words: [{ word: 'New', start: currentTime, end: currentTime + 0.8 }, { word: 'Subtitle', start: currentTime + 0.9, end: currentTime + 1.8 }],
    };

    updateProject((draft) => {
      draft.subtitles = [...draft.subtitles, newSub].sort((a, b) => a.start - b.start);
      return draft;
    });
  };

  // Delete a subtitle cue
  const handleDeleteSubtitle = (id: string) => {
    updateProject((draft) => {
      draft.subtitles = draft.subtitles.filter((s) => s.id !== id);
      return draft;
    });
  };

  // Export SRT
  const handleExportSrt = () => {
    const srtData = exportToSrt(project.subtitles);
    const blob = new Blob([srtData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_subtitles.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export ASS
  const handleExportAss = () => {
    const assData = generateAssSubtitles(project);
    const blob = new Blob([assData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_subtitles.ass`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import SRT file
  const handleImportSrt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseSrt(content);
        if (parsed.length > 0) {
          updateProject((draft) => {
            draft.subtitles = parsed;
            return draft;
          });
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Sub Tabs: Transcript vs Style Presets */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setSubTab('transcript')}
          className={`pb-2 font-semibold transition border-b-2 flex items-center gap-1.5 ${
            subTab === 'transcript'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Transcript</span>
        </button>
        <button
          onClick={() => setSubTab('style')}
          className={`pb-2 font-semibold transition border-b-2 flex items-center gap-1.5 ${
            subTab === 'style'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Style & Presets</span>
        </button>
      </div>

      {/* SUBTAB 1: TRANSCRIPT */}
      {subTab === 'transcript' && (
        <div className="space-y-3">
          {/* Auto-Transcribe Button */}
          <button
            onClick={handleAutoTranscribe}
            disabled={isTranscribing}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transcribing Speech with Whisper AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Generate Subtitles (Whisper)</span>
              </>
            )}
          </button>

          {isTranscribing && job && (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-300 font-medium truncate">{job.stage}</span>
                <span className="font-mono text-blue-400 font-bold">{job.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          {error && <div className="p-2.5 bg-rose-500/10 text-rose-300 rounded-xl">{error}</div>}

          {/* Action Row: Add, Import, Export */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleAddSubtitle}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Cue</span>
            </button>

            <div className="flex items-center gap-1.5">
              <label className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer transition" title="Import .srt">
                <Upload className="w-3.5 h-3.5" />
                <input type="file" accept=".srt" onChange={handleImportSrt} className="hidden" />
              </label>
              <button
                onClick={handleExportSrt}
                title="Export .srt"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                <span className="text-[10px] font-bold">SRT</span>
              </button>
              <button
                onClick={handleExportAss}
                title="Export .ass"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                <span className="text-[10px] font-bold">ASS</span>
              </button>
            </div>
          </div>

          {/* Subtitles List */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {project.subtitles.length === 0 ? (
              <div className="text-center py-8 text-slate-500 italic bg-slate-900/40 rounded-xl border border-slate-800/60 p-4">
                No captions yet. Click Auto-Generate Subtitles above or Add Cue.
              </div>
            ) : (
              project.subtitles.map((sub, idx) => {
                const isActive = currentTime >= sub.start && currentTime <= sub.end;

                return (
                  <div
                    key={sub.id}
                    className={`p-3 rounded-xl border transition space-y-2 ${
                      isActive
                        ? 'bg-blue-600/10 border-blue-500/80 ring-1 ring-blue-500/50'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Time Header */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-1 font-mono">
                        <input
                          type="number"
                          step="0.1"
                          value={sub.start}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateProject((draft) => {
                              draft.subtitles[idx].start = val;
                              return draft;
                            });
                          }}
                          className="w-12 bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-white"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          step="0.1"
                          value={sub.end}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateProject((draft) => {
                              draft.subtitles[idx].end = val;
                              return draft;
                            });
                          }}
                          className="w-12 bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-white"
                        />
                        <span>s</span>
                      </div>

                      <button
                        onClick={() => handleDeleteSubtitle(sub.id)}
                        className="text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Editable Text */}
                    <textarea
                      value={sub.text}
                      rows={2}
                      onChange={(e) => {
                        const newText = e.target.value;
                        updateProject((draft) => {
                          draft.subtitles[idx].text = newText;
                          // If words exist, update words proportional to timing
                          const wordTokens = newText.trim().split(/\s+/);
                          const totalD = sub.end - sub.start;
                          draft.subtitles[idx].words = wordTokens.map((w, wIdx) => ({
                            word: w,
                            start: sub.start + (totalD / wordTokens.length) * wIdx,
                            end: sub.start + (totalD / wordTokens.length) * (wIdx + 1),
                          }));
                          return draft;
                        });
                      }}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-white font-medium resize-none outline-none leading-snug"
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: STYLE & PRESETS */}
      {subTab === 'style' && (
        <div className="space-y-4">
          {/* 5 Built-in Presets */}
          <div className="space-y-2">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
              Viral Subtitle Presets
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.entries(SUBTITLE_PRESETS).map(([key, preset]) => {
                const isSelected =
                  project.subtitleStyle.primaryColor === preset.primaryColor &&
                  project.subtitleStyle.fontFamily === preset.fontFamily &&
                  project.subtitleStyle.animation === preset.animation;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      updateProject((draft) => {
                        draft.subtitleStyle = { ...preset };
                        return draft;
                      });
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="font-bold capitalize text-xs">
                        {key.replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {preset.fontFamily} • {preset.animation.replace('_', ' ')}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Typography Customization */}
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
              Typography & Colors
            </span>

            {/* Font Family */}
            <div className="space-y-1">
              <label className="text-slate-400 text-[11px]">Font Family</label>
              <select
                value={project.subtitleStyle.fontFamily}
                onChange={(e) => {
                  updateProject((draft) => {
                    draft.subtitleStyle.fontFamily = e.target.value;
                    return draft;
                  });
                }}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
              >
                {BUILT_IN_FONTS.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Font Size</span>
                <span className="font-mono text-white">{project.subtitleStyle.fontSize}px</span>
              </div>
              <input
                type="range"
                min="32"
                max="84"
                value={project.subtitleStyle.fontSize}
                onChange={(e) => {
                  updateProject((draft) => {
                    draft.subtitleStyle.fontSize = parseInt(e.target.value, 10);
                    return draft;
                  });
                }}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Text Color</label>
                <input
                  type="color"
                  value={project.subtitleStyle.primaryColor}
                  onChange={(e) => {
                    updateProject((draft) => {
                      draft.subtitleStyle.primaryColor = e.target.value;
                      return draft;
                    });
                  }}
                  className="w-full h-7 rounded cursor-pointer bg-slate-950 border border-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Highlight</label>
                <input
                  type="color"
                  value={project.subtitleStyle.highlightColor}
                  onChange={(e) => {
                    updateProject((draft) => {
                      draft.subtitleStyle.highlightColor = e.target.value;
                      return draft;
                    });
                  }}
                  className="w-full h-7 rounded cursor-pointer bg-slate-950 border border-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Outline</label>
                <input
                  type="color"
                  value={project.subtitleStyle.outlineColor}
                  onChange={(e) => {
                    updateProject((draft) => {
                      draft.subtitleStyle.outlineColor = e.target.value;
                      return draft;
                    });
                  }}
                  className="w-full h-7 rounded cursor-pointer bg-slate-950 border border-slate-800"
                />
              </div>
            </div>

            {/* Animation Style */}
            <div className="space-y-1 pt-1">
              <label className="text-slate-400 text-[11px]">Animation Effect</label>
              <select
                value={project.subtitleStyle.animation}
                onChange={(e) => {
                  updateProject((draft) => {
                    draft.subtitleStyle.animation = e.target.value as SubtitleAnimation;
                    return draft;
                  });
                }}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
              >
                <option value="karaoke_highlight">Karaoke Active Word Highlight</option>
                <option value="pop_in">Pop-In Bounce</option>
                <option value="fade">Smooth Fade</option>
                <option value="none">Static (None)</option>
              </select>
            </div>

            {/* Vertical Position */}
            <div className="space-y-1 pt-1">
              <label className="text-slate-400 text-[11px]">Screen Position</label>
              <div className="grid grid-cols-3 gap-1">
                {(['top', 'middle', 'bottom'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => {
                      updateProject((draft) => {
                        draft.subtitleStyle.position = pos;
                        return draft;
                      });
                    }}
                    className={`py-1.5 rounded-lg text-center capitalize font-medium transition ${
                      project.subtitleStyle.position === pos
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-950 text-slate-400'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
