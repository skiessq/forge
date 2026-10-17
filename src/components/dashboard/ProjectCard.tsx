'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Project } from '@/lib/types';
import { Film, Clock, Trash2, ArrowRight, Layers, Volume2 } from 'lucide-react';

interface Props {
  project: Project;
  onDeleted: () => void;
  onAutoHighlight?: (project: Project) => void;
}

export default function ProjectCard({ project, onDeleted, onAutoHighlight }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  const durationSec = Math.round(project.source.probe?.duration || 0);
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Delete project "${project.name}"?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted();
      }
    } catch (e) {
      console.error(e);
      setIsDeleting(false);
    }
  };

  const layoutLabels: Record<string, string> = {
    gameplay_full: 'Full Crop',
    split_facecam_top: 'Cam Top / Game Bottom',
    split_gameplay_top: 'Game Top / Cam Bottom',
    media_top_game_bottom: 'Media Top / Game Bottom',
    media_bottom_game_top: 'Media Bottom / Game Top',
    blurred_background_fit: 'Blurred Fit',
    picture_in_picture: 'PiP Overlay',
  };

  return (
    <div className="group relative bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl overflow-hidden shadow-lg transition duration-200 flex flex-col justify-between">
      <div className="p-5 space-y-4">
        {/* Top Badges */}
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-300 font-medium">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            {timeFormatted}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono text-[11px] border border-indigo-500/20">
            {project.canvas.aspectRatio} ({project.canvas.width}x{project.canvas.height})
          </span>
        </div>

        {/* Project Name */}
        <div>
          <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition line-clamp-1">
            {project.name}
          </h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1 font-mono">
            {project.source.originalFileName}
          </p>
        </div>

        {/* Metadata Details */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>{layoutLabels[project.layout.templateId] || project.layout.templateId}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            <span>{project.source.probe?.hasAudio ? 'Audio Stream' : 'Muted'}</span>
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-5 py-3.5 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {onAutoHighlight && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAutoHighlight(project);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/20 transition"
              title="Find viral shorts with Auto-Highlight AI"
            >
              <span className="text-[11px]">✨</span>
              <span>Highlight</span>
            </button>
          )}
        </div>

        <Link
          href={`/editor/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition group-hover:translate-x-0.5"
        >
          <span>Open Studio</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
