'use client';

import React, { useEffect, useState } from 'react';
import { SystemCheckResult } from '@/lib/types';
import { CheckCircle2, AlertTriangle, Cpu, Terminal, RefreshCw } from 'lucide-react';

export default function DependencyBanner() {
  const [systemInfo, setSystemInfo] = useState<SystemCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/check');
      const data = await res.json();
      setSystemInfo(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (!systemInfo && loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400 animate-pulse">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
        Detecting system tools (FFmpeg, yt-dlp, whisper)...
      </div>
    );
  }

  const allOk =
    systemInfo?.ffmpeg.installed &&
    systemInfo?.ffprobe.installed &&
    systemInfo?.ytDlp.installed;

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 text-sm backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Local Engines:</span>
          </div>

          {/* FFmpeg Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              systemInfo?.ffmpeg.installed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {systemInfo?.ffmpeg.installed ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>FFmpeg {systemInfo?.ffmpeg.version || 'Missing'}</span>
          </div>

          {/* yt-dlp Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              systemInfo?.ytDlp.installed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {systemInfo?.ytDlp.installed ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>yt-dlp {systemInfo?.ytDlp.version ? 'Ready' : 'Missing'}</span>
          </div>

          {/* Whisper Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              systemInfo?.whisper.installed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {systemInfo?.whisper.installed ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>
              Whisper ({systemInfo?.whisper.engine !== 'none' ? systemInfo?.whisper.engine : 'Optional'})
            </span>
          </div>

          {/* HW Accel info */}
          {systemInfo?.ffmpeg.hwAccelSupport && systemInfo.ffmpeg.hwAccelSupport.length > 0 && (
            <span className="hidden md:inline-flex text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
              GPU: {systemInfo.ffmpeg.hwAccelSupport.join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!allOk && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-amber-400 hover:text-amber-300 underline font-medium"
            >
              {expanded ? 'Hide install guide' : 'Show install guide'}
            </button>
          )}
          <button
            onClick={checkStatus}
            title="Refresh dependencies"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded install instructions */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-slate-200">How to install missing binaries:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800/80">
              <span className="font-semibold text-blue-400">Windows (PowerShell / winget):</span>
              <pre className="mt-1 font-mono text-[11px] text-slate-300 overflow-x-auto p-1.5 bg-slate-900 rounded">
                winget install Gyan.FFmpeg.Essentials{'\n'}python -m pip install yt-dlp faster-whisper
              </pre>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800/80">
              <span className="font-semibold text-blue-400">macOS (Homebrew):</span>
              <pre className="mt-1 font-mono text-[11px] text-slate-300 overflow-x-auto p-1.5 bg-slate-900 rounded">
                brew install ffmpeg yt-dlp{'\n'}pip install faster-whisper
              </pre>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800/80">
              <span className="font-semibold text-blue-400">Linux (Ubuntu / Debian):</span>
              <pre className="mt-1 font-mono text-[11px] text-slate-300 overflow-x-auto p-1.5 bg-slate-900 rounded">
                sudo apt install ffmpeg{'\n'}pip install yt-dlp faster-whisper
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
