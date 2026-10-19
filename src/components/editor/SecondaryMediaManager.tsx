'use client';

import React, { useState, useRef } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  FileVideo,
  Play,
  Layers,
} from 'lucide-react';

interface SecondaryMediaManagerProps {
  compact?: boolean;
}

export default function SecondaryMediaManager({ compact = false }: SecondaryMediaManagerProps) {
  const {
    project,
    setSecondaryMedia,
    selectedClipId,
    currentTime,
  } = useEditorStore();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [localPathInput, setLocalPathInput] = useState('');
  const [showLocalInput, setShowLocalInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!project) return null;

  const videoTrack = project.tracks?.find((t) => t.type === 'video');
  const clips = videoTrack?.clips || [];
  const activeClip = clips.find((c) =>
    selectedClipId ? c.id === selectedClipId : currentTime >= c.start && currentTime < c.start + c.duration
  ) || clips[0];

  const activeLayout = activeClip?.layoutOverride || project.layout;

  const isMediaLayout =
    activeLayout?.templateId === 'media_top_game_bottom' ||
    activeLayout?.templateId === 'media_bottom_game_top' ||
    project.layout?.templateId === 'media_top_game_bottom' ||
    project.layout?.templateId === 'media_bottom_game_top';

  if (!isMediaLayout) return null;

  const isMediaTop =
    activeLayout?.templateId === 'media_top_game_bottom' ||
    project.layout?.templateId === 'media_top_game_bottom';
  const slotLabel = isMediaTop ? 'Top Media Slot' : 'Bottom Media Slot';
  const mediaPath =
    activeLayout?.secondaryMediaPath ||
    project.layout?.secondaryMediaPath ||
    '';
  const mediaType =
    activeLayout?.secondaryMediaType ||
    project.layout?.secondaryMediaType ||
    'video';
  const hasMedia = Boolean(mediaPath);
  const fileName = mediaPath ? mediaPath.split(/[\\/]/).pop() : '';

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setError(null);
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('projectId', project.id);
      formData.append('file', file);

      // Simulated upload progress steps
      const progressTimer = setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + 15 : p));
      }, 150);

      const res = await fetch('/api/media/upload-secondary', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to upload secondary media');
      }

      setSecondaryMedia(data.secondaryMediaPath, data.secondaryMediaType, data.secondaryMediaProbe);
    } catch (err: any) {
      console.error('Secondary media upload error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLocalPathImport = async () => {
    if (!localPathInput.trim()) return;
    setError(null);
    setIsUploading(true);

    try {
      const res = await fetch('/api/media/upload-secondary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          localPath: localPathInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Local import failed');
      }

      setSecondaryMedia(data.secondaryMediaPath, data.secondaryMediaType, data.secondaryMediaProbe);
      setLocalPathInput('');
      setShowLocalInput(false);
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveMedia = async () => {
    try {
      await fetch('/api/media/upload-secondary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      setSecondaryMedia(null);
    } catch (err) {
      console.error('Failed to remove media:', err);
      setSecondaryMedia(null);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="p-3.5 bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-xl space-y-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-xs text-white flex items-center gap-1.5">
              <span>{slotLabel}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono uppercase">
                {isMediaTop ? 'Top' : 'Bottom'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Attach B-Roll, Gameplay, Meme, or Reaction video</p>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska,image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
        }}
      />

      {/* Error Notice */}
      {error && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Uploading State */}
      {isUploading && (
        <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-semibold">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Processing Media...</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-200"
              style={{ width: `${uploadProgress || 50}%` }}
            />
          </div>
        </div>
      )}

      {/* Attached Media Card */}
      {!isUploading && hasMedia && (
        <div className="p-3 bg-slate-950/80 border border-slate-800/90 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                {mediaType === 'video' ? <FileVideo className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-xs text-white block truncate" title={fileName}>
                  {fileName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wide">
                  {mediaType === 'video' ? 'Video Stream' : mediaType === 'gif' ? 'Animated GIF' : 'Image Graphic'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Replace with different media"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemoveMedia}
                title="Remove media"
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle className="w-3 h-3" />
              <span>Attached to Layout</span>
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-400 hover:underline"
            >
              Change file
            </button>
          </div>
        </div>
      )}

      {/* Empty State / Upload Dropzone */}
      {!isUploading && !hasMedia && (
        <div className="space-y-2">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer p-4 rounded-xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-2 ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-900/60'
            }`}
          >
            <div className="p-2.5 rounded-full bg-slate-800/80 text-emerald-400 border border-slate-700">
              <UploadCloud className="w-5 h-5" />
            </div>

            <div className="space-y-0.5">
              <div className="font-semibold text-xs text-white">Click or Drag Media Here</div>
              <p className="text-[10px] text-slate-400">
                Upload MP4, WebM, MOV, GIF, or PNG
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-sm transition flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse Files</span>
            </button>
          </div>

          {/* Quick Local Path Option */}
          <div className="pt-1">
            {!showLocalInput ? (
              <button
                type="button"
                onClick={() => setShowLocalInput(true)}
                className="w-full text-center text-[10px] text-slate-400 hover:text-slate-200 hover:underline transition py-0.5"
              >
                Or enter local file path from PC
              </button>
            ) : (
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 animate-in fade-in">
                <span className="text-[10px] font-semibold text-slate-300 block">
                  Paste Absolute Path (e.g. C:\Videos\clip.mp4)
                </span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="C:\path\to\media.mp4"
                    value={localPathInput}
                    onChange={(e) => setLocalPathInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLocalPathImport()}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleLocalPathImport}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition"
                  >
                    Import
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
