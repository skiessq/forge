'use client';

import React, { useState, useEffect } from 'react';
import { Project, JobProgress } from '@/lib/types';
import { ProjectTemplate } from '@/lib/storage/templates';
import { X, Layers, Download, Check, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
}

export default function BatchExportModal({ isOpen, onClose, projects }: Props) {
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [job, setJob] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Select all projects by default
      const map: Record<string, boolean> = {};
      projects.forEach((p) => (map[p.id] = true));
      setSelectedIds(map);

      // Load saved templates
      fetch('/api/templates')
        .then((r) => r.json())
        .then((d) => setTemplates(d.templates || []))
        .catch(console.error);
    }
  }, [isOpen, projects]);

  if (!isOpen) return null;

  const countSelected = Object.values(selectedIds).filter(Boolean).length;

  const handleStartBatch = async () => {
    const targetProjectIds = projects.filter((p) => selectedIds[p.id]).map((p) => p.id);
    if (targetProjectIds.length === 0) {
      setError('Please select at least one clip for batch export.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds: targetProjectIds,
          templateId: selectedTemplateId || undefined,
          settings: { resolution: '1080p', fps: 30, quality: 'high', hwAccel: 'auto' },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to start batch queue');

      // Connect to SSE stream
      const sse = new EventSource(`/api/jobs/${data.jobId}`);
      sse.onmessage = (event) => {
        const jobData: JobProgress = JSON.parse(event.data);
        setJob(jobData);

        if (jobData.status === 'completed') {
          sse.close();
          setIsExporting(false);
        } else if (jobData.status === 'failed') {
          sse.close();
          setIsExporting(false);
          setError(jobData.error || 'Batch export failed');
        }
      };

      sse.onerror = () => {
        sse.close();
        if (isExporting) {
          setError('Lost connection to batch worker');
          setIsExporting(false);
        }
      };
    } catch (e: any) {
      setError(e.message);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Batch Export Queue</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {job?.status === 'completed' && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">Batch Export Completed!</h3>
              <p className="text-slate-400 text-xs">
                All selected clips have been rendered and saved in their respective project folders.
              </p>
            </div>
          )}

          {/* Reusable Template Selection */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">
                Apply Reusable Template to all clips (Optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={isExporting}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
              >
                <option value="">Keep Each Project's Own Layout & Style</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    Template: {tpl.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Project Checkbox List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Select Clips ({countSelected}/{projects.length}):</span>
              <button
                onClick={() => {
                  const allOn = countSelected === projects.length;
                  const next: Record<string, boolean> = {};
                  projects.forEach((p) => (next[p.id] = !allOn));
                  setSelectedIds(next);
                }}
                className="text-blue-400 hover:underline text-[11px]"
              >
                {countSelected === projects.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-950/60">
              {projects.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds[p.id])}
                      onChange={(e) =>
                        setSelectedIds({ ...selectedIds, [p.id]: e.target.checked })
                      }
                      disabled={isExporting}
                      className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0"
                    />
                    <span className="font-medium text-white truncate max-w-xs">{p.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    {typeof p.source.probe?.duration === 'number' && !isNaN(p.source.probe.duration)
                      ? `${p.source.probe.duration.toFixed(1)}s`
                      : 'N/A'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          {isExporting && job && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium truncate">{job.stage}</span>
                <span className="font-mono text-blue-400 font-bold">{job.progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleStartBatch}
            disabled={isExporting || countSelected === 0}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Batch Export Queue...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export {countSelected} Clips in Batch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
