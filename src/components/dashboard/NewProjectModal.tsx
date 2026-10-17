'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  Link as LinkIcon,
  Sparkles,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Film,
} from 'lucide-react';
import { JobProgress } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewProjectModal({ isOpen, onClose, onCreated }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'upload' | 'twitch' | 'sample'>('upload');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Twitch state
  const [twitchUrl, setTwitchUrl] = useState('');
  const [twitchJob, setTwitchJob] = useState<JobProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Sample state
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle local file upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file.');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append('file', file);
    if (projectName) formData.append('name', projectName);

    try {
      // Simulate progress ticks during streaming upload
      const progressTimer = setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + 15 : p));
      }, 300);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to upload video');
      }

      onCreated();
      onClose();
      router.push(`/editor/${data.project.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsUploading(false);
    }
  };

  // Handle Twitch clip URL
  const handleTwitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twitchUrl.trim().startsWith('http')) {
      setError('Please enter a valid URL (e.g. https://clips.twitch.tv/...)');
      return;
    }

    setError(null);
    setIsDownloading(true);

    try {
      const res = await fetch('/api/twitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: twitchUrl, name: projectName }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to initiate download');
      }

      // Connect to SSE stream
      const sse = new EventSource(`/api/jobs/${data.jobId}`);
      eventSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const job: JobProgress = JSON.parse(event.data);
          setTwitchJob(job);

          if (job.status === 'completed' && job.resultUrl) {
            sse.close();
            onCreated();
            onClose();
            router.push(job.resultUrl);
          } else if (job.status === 'failed') {
            sse.close();
            setError(job.error || 'Download failed');
            setIsDownloading(false);
          }
        } catch (e) {
          console.error(e);
        }
      };

      sse.onerror = () => {
        sse.close();
        if (isDownloading) {
          setError('Lost connection to download progress');
          setIsDownloading(false);
        }
      };
    } catch (err: any) {
      setError(err.message);
      setIsDownloading(false);
    }
  };

  // Handle Instant Sample Clip Generation
  const handleGenerateSample = async () => {
    setError(null);
    setIsGeneratingSample(true);
    try {
      const res = await fetch('/api/media/generate-sample', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate demo clip');
      }
      onCreated();
      onClose();
      router.push(`/editor/${data.project.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsGeneratingSample(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create New Short</h2>
              <p className="text-xs text-slate-400">Import a Twitch clip or local video file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-4 bg-slate-950/20">
          <button
            onClick={() => { setTab('upload'); setError(null); }}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              tab === 'upload'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Upload Video
          </button>
          <button
            onClick={() => { setTab('twitch'); setError(null); }}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              tab === 'twitch'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            Twitch Clip URL
          </button>
          <button
            onClick={() => { setTab('sample'); setError(null); }}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              tab === 'sample'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Instant Demo Clip
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Name Field */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Project Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Insane 1v5 Clutch in Valorant"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* TAB 1: File Upload */}
          {tab === 'upload' && (
            <form onSubmit={handleUpload} className="space-y-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500/80 rounded-2xl p-8 cursor-pointer bg-slate-950/40 hover:bg-slate-950/60 transition group">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <UploadCloud className="w-10 h-10 text-slate-500 group-hover:text-blue-400 mb-3 transition" />
                <span className="text-sm font-medium text-slate-200">
                  {file ? file.name : 'Click to select or drag and drop video'}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  MP4, MOV, WEBM, MKV (Streaming directly to local disk)
                </span>
                {file && (
                  <span className="mt-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </label>

              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Uploading & Probing media...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!file || isUploading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Source...</span>
                  </>
                ) : (
                  <span>Load Into ClipForge</span>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: Twitch URL */}
          {tab === 'twitch' && (
            <form onSubmit={handleTwitchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Twitch Clip or Stream URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://clips.twitch.tv/RelievedGracefulCroissant..."
                    value={twitchUrl}
                    onChange={(e) => setTwitchUrl(e.target.value)}
                    disabled={isDownloading}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                  <LinkIcon className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {isDownloading && twitchJob && (
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">{twitchJob.stage}</span>
                    <span className="font-mono text-blue-400 font-bold">{twitchJob.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300"
                      style={{ width: `${twitchJob.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!twitchUrl.trim() || isDownloading}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Downloading Clip via yt-dlp...</span>
                  </>
                ) : (
                  <span>Download & Open in Editor</span>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: Instant Demo Clip */}
          {tab === 'sample' && (
            <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Generate Synthetic Test Clip</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Uses local FFmpeg to generate a 12-second 1080p clip with moving gameplay visuals, a facecam PIP overlay, and audio. Ideal for testing layouts, subtitles, and exports immediately!
                </p>
              </div>

              <button
                onClick={handleGenerateSample}
                disabled={isGeneratingSample}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {isGeneratingSample ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Synthetic Clip...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate & Open Demo Clip</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
