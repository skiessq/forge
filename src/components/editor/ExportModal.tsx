'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { X, Download, Cpu, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { JobProgress } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: Props) {
  const { project } = useEditorStore();
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  const [fps, setFps] = useState<'source' | 30 | 60>(30);
  const [quality, setQuality] = useState<'fast' | 'balanced' | 'high'>('high');
  const [hwAccel, setHwAccel] = useState<'auto' | 'nvenc' | 'videotoolbox' | 'qsv' | 'cpu'>('auto');

  const [isExporting, setIsExporting] = useState(false);
  const [job, setJob] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setError(null);
    setExportedUrl(null);

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          settings: {
            resolution,
            fps,
            quality,
            hwAccel,
            outputFileName: `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${resolution}.mp4`,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Export request failed');
      }

      // Connect to SSE stream
      const sse = new EventSource(`/api/jobs/${data.jobId}`);
      sse.onmessage = (event) => {
        const jobData: JobProgress = JSON.parse(event.data);
        setJob(jobData);

        if (jobData.status === 'completed') {
          sse.close();
          setIsExporting(false);
          setExportedUrl(jobData.resultUrl || null);
        } else if (jobData.status === 'failed') {
          sse.close();
          setIsExporting(false);
          setError(jobData.error || 'Export failed');
        }
      };

      sse.onerror = () => {
        sse.close();
        if (isExporting) {
          setError('Lost connection to export worker');
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
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Export Video (MP4)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-300">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {exportedUrl && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">Export Completed Successfully!</h3>
              <p className="text-slate-400 text-xs">
                Your vertical short is ready and saved to your project folder.
              </p>
              <div className="pt-2">
                <a
                  href={exportedUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Download MP4 File</span>
                </a>
              </div>
            </div>
          )}

          {!exportedUrl && (
            <>
              {/* Resolution */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200">Resolution</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['1080p', '720p'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      disabled={isExporting}
                      className={`py-2 rounded-xl border text-center font-medium transition ${
                        resolution === r
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {r === '1080p' ? '1080p (1080x1920 Full HD)' : '720p (720x1280 Fast)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Framerate */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200">Framerate (FPS)</label>
                <div className="grid grid-cols-3 gap-2">
                  {([30, 60, 'source'] as const).map((f) => (
                    <button
                      key={String(f)}
                      onClick={() => setFps(f)}
                      disabled={isExporting}
                      className={`py-2 rounded-xl border text-center font-medium transition ${
                        fps === f
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {f === 'source' ? 'Source FPS' : `${f} FPS`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality & Hardware Accel */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  <span>Hardware Acceleration (GPU)</span>
                </label>
                <select
                  value={hwAccel}
                  onChange={(e) => setHwAccel(e.target.value as any)}
                  disabled={isExporting}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500"
                >
                  <option value="auto">Auto-detect GPU (NVENC / VideoToolbox / QSV / libx264)</option>
                  <option value="nvenc">NVIDIA NVENC (Fastest)</option>
                  <option value="qsv">Intel QuickSync (QSV)</option>
                  <option value="cpu">Software libx264 (Highest compatibility)</option>
                </select>
              </div>

              {/* Export Progress Bar */}
              {isExporting && job && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">{job.stage}</span>
                    <span className="font-mono text-blue-400 font-bold">{job.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleStartExport}
                disabled={isExporting}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rendering with FFmpeg...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Start Export</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
