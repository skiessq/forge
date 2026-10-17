'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/useEditorStore';
import TopNav from '@/components/editor/TopNav';
import LeftSidebar from '@/components/editor/LeftSidebar';
import PreviewPlayer from '@/components/editor/PreviewPlayer';
import RightProperties from '@/components/editor/RightProperties';
import Timeline from '@/components/editor/Timeline';
import ExportModal from '@/components/editor/ExportModal';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { project, setProject, saveToServer } = useEditorStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProject() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load project');
        }

        if (isMounted) {
          setProject(data.project);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (projectId) {
      loadProject();
    }

    return () => {
      isMounted = false;
    };
  }, [projectId, setProject]);

  // Periodic autosave every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (project) {
        saveToServer();
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [project, saveToServer]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080B10] flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-sm font-medium">Loading ClipForge Studio...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#080B10] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Project Not Found</h2>
          <p className="text-xs text-slate-400 max-w-sm">{error || 'This project could not be loaded.'}</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#080B10] text-slate-100 overflow-hidden">
      {/* Top Navigation */}
      <TopNav onOpenExport={() => setIsExportOpen(true)} />

      {/* Main Studio Body (3 columns: Left Sidebar, Preview Player, Right Properties) */}
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        <PreviewPlayer />
        <RightProperties />
      </div>

      {/* Bottom Multi-Track Timeline */}
      <Timeline />

      {/* Export MP4 Dialog */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
