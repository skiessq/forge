'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { ShortCandidate } from '@/lib/split/autoSplit';
import { X, Scissors, Loader2, CheckCircle2, AlertCircle, Play, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AutoSplitModal({ isOpen, onClose }: Props) {
  const { project } = useEditorStore();
  const [targetDuration, setTargetDuration] = useState<number>(30);
  const [candidates, setCandidates] = useState<ShortCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const handleGenerateCandidates = async () => {
    setIsLoading(true);
    setError(null);
    setCreatedCount(null);
    try {
      const res = await fetch('/api/autosplit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, targetDuration }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to generate split candidates');

      setCandidates(data.candidates || []);
      const sel: Record<string, boolean> = {};
      (data.candidates || []).forEach((c: ShortCandidate) => (sel[c.id] = true));
      setSelectedIds(sel);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSplits = async () => {
    const toApply = candidates.filter((c) => selectedIds[c.id]);
    if (toApply.length === 0) {
      setError('Please select at least one segment to create.');
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/autosplit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, applyCandidates: toApply }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create short projects');

      setCreatedCount(data.count);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsApplying(false);
    }
  };

  const updateCandidate = (id: string, field: 'start' | 'end' | 'title', val: any) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: val };
        if (field === 'start' || field === 'end') {
          updated.duration = Math.max(0.5, updated.end - updated.start);
        }
        return updated;
      })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-blue-400 -rotate-45" />
            <div>
              <h2 className="text-base font-bold text-white">AI Auto-Split Long Clip</h2>
              <p className="text-[11px] text-slate-400">
                Segment clip based on transcript sentence clusters and pacing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {createdCount !== null ? (
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Successfully Generated {createdCount} Short Projects!
                </h3>
                <p className="text-slate-400 text-xs">
                  Each short has its own trimmed timeline, layout framing, and synchronized subtitles ready to preview and export.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href="/"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition"
                >
                  <span>View in Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Configuration Controls */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-semibold text-white">Target Duration per Short</span>
                  <p className="text-slate-400 text-[11px]">
                    Clips will align around natural speech breaks close to this length.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {[15, 30, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setTargetDuration(sec)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition text-xs ${
                        targetDuration === sec
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                  <button
                    onClick={handleGenerateCandidates}
                    disabled={isLoading}
                    className="ml-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5 -rotate-45" />}
                    <span>{candidates.length > 0 ? 'Regenerate' : 'Analyze Clip'}</span>
                  </button>
                </div>
              </div>

              {/* Candidates List */}
              {candidates.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      Suggested Segments ({candidates.length})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Edit start/end times or uncheck segments you do not want.
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {candidates.map((c) => (
                      <div
                        key={c.id}
                        className={`p-3 rounded-xl border transition space-y-2 ${
                          selectedIds[c.id]
                            ? 'bg-slate-950 border-slate-700'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedIds[c.id])}
                              onChange={(e) =>
                                setSelectedIds({ ...selectedIds, [c.id]: e.target.checked })
                              }
                              className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0"
                            />
                            <input
                              type="text"
                              value={c.title}
                              onChange={(e) => updateCandidate(c.id, 'title', e.target.value)}
                              className="bg-transparent font-semibold text-white border-b border-transparent hover:border-slate-700 focus:border-blue-500 outline-none text-xs"
                            />
                          </label>

                          <div className="flex items-center gap-2 text-[11px]">
                            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                              <span className="text-slate-500 font-mono">In:</span>
                              <input
                                type="number"
                                step="0.5"
                                value={parseFloat(c.start.toFixed(1))}
                                onChange={(e) =>
                                  updateCandidate(c.id, 'start', parseFloat(e.target.value) || 0)
                                }
                                className="w-12 bg-transparent text-white font-mono outline-none text-right"
                              />
                              <span className="text-slate-500">s</span>
                            </div>

                            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                              <span className="text-slate-500 font-mono">Out:</span>
                              <input
                                type="number"
                                step="0.5"
                                value={parseFloat(c.end.toFixed(1))}
                                onChange={(e) =>
                                  updateCandidate(c.id, 'end', parseFloat(e.target.value) || 0)
                                }
                                className="w-12 bg-transparent text-white font-mono outline-none text-right"
                              />
                              <span className="text-slate-500">s</span>
                            </div>

                            <span className="font-mono text-blue-400 font-bold px-1">
                              {c.duration.toFixed(1)}s
                            </span>
                          </div>
                        </div>

                        {c.snippet && (
                          <p className="text-[11px] text-slate-400 italic pl-6 truncate">
                            "{c.snippet}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleConfirmSplits}
                    disabled={isApplying || Object.values(selectedIds).filter(Boolean).length === 0}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Short Projects in Workspace...</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4 -rotate-45" />
                        <span>
                          Confirm & Create {Object.values(selectedIds).filter(Boolean).length} Shorts
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
