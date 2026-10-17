'use client';

import React, { useEffect, useState } from 'react';
import { Project } from '@/lib/types';
import DependencyBanner from '@/components/dashboard/DependencyBanner';
import NewProjectModal from '@/components/dashboard/NewProjectModal';
import ProjectCard from '@/components/dashboard/ProjectCard';
import { Plus, Scissors, Sparkles, FolderOpen, ShieldAlert } from 'lucide-react';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#080B10] text-slate-100">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Scissors className="w-5 h-5 text-blue-400 -rotate-45" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  ClipForge
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 tracking-wider">
                  LOCAL STUDIO
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Long clips to viral 9:16 vertical shorts</p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl transition shadow-lg shadow-blue-600/25 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Short</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* System Engine Status */}
        <DependencyBanner />

        {/* Hero Banner / Quick Action */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/40 border border-slate-800 p-8 shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Facecam + Gameplay Splitter</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Turn long gameplay clips into polished viral shorts.
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Automatic 7-layout framing, word-level Whisper subtitles with karaoke animation, untouched original audio, and native hardware-accelerated 1080x1920 MP4 export. Runs completely local on your machine.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>Import Clip or Twitch URL</span>
              </button>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Your Workspace Projects</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {projects.length}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
                <Scissors className="w-7 h-7 -rotate-45" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">No clips in your workspace yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Import a Twitch clip link, upload a gameplay video, or generate a sample demo clip to get started.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition"
              >
                Create First Short
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDeleted={fetchProjects} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer & Content Rights Notice */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 px-6 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-slate-300">Content Rights & Fair Usage Notice</span>
        </div>
        <p className="max-w-2xl mx-auto text-slate-500 text-[11px] leading-relaxed">
          ClipForge is designed strictly for footage the user is authorized to edit and publish (e.g. gameplay footage supplied by a campaign, streams you own, or creator-permissioned content). ClipForge does not include any features that obfuscate media origins, bypass platform attribution, or falsify engagement metrics.
        </p>
      </footer>

      {/* Modal for Creating / Ingesting Clips */}
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchProjects}
      />
    </div>
  );
}
