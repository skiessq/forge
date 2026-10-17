'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Scissors,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  RotateCw,
  Search,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Zap,
  ShieldAlert,
  Loader2,
  Check,
  ChevronRight,
  ArrowRight,
  Sliders,
  Cpu,
  Cloud,
  FileText,
  Volume2,
  Eye,
  Bookmark,
  X,
  HelpCircle,
  HardDrive,
  Film,
  FolderOpen,
  UploadCloud,
} from 'lucide-react';
import {
  Candidate,
  HighlightConfig,
  HighlightJobResult,
  ContentType,
  ScoringEngineType,
} from '@/lib/highlight/types';
import { ProjectTemplate } from '@/lib/storage/templates';
import Link from 'next/link';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  sourcePath?: string;
  sourceDuration?: number;
  onProjectsCreated?: (newProjectIds: string[]) => void;
}

export default function AutoHighlightModal({
  isOpen,
  onClose,
  projectId = '',
  sourcePath = '',
  sourceDuration = 60,
  onProjectsCreated,
}: Props) {
  // Navigation / Phase State
  const [phase, setPhase] = useState<'config' | 'running' | 'review'>('config');

  // Active Project & Video Source State
  const [activeProjectId, setActiveProjectId] = useState<string>(projectId || '');
  const [activeSourcePath, setActiveSourcePath] = useState<string>(sourcePath || '');
  const [activeSourceDuration, setActiveSourceDuration] = useState<number>(sourceDuration || 60);
  const [activeProjectName, setActiveProjectName] = useState<string>('');

  // Source selection UI state
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [showSourcePicker, setShowSourcePicker] = useState<boolean>(!projectId && !sourcePath);
  const [sourceMode, setSourceMode] = useState<'local_path' | 'upload' | 'workspace'>('local_path');

  // Local Path Input State (Recommended for 2.8GB files)
  const [localFilePathInput, setLocalFilePathInput] = useState('');
  const [isImportingLocal, setIsImportingLocal] = useState(false);
  const [localImportError, setLocalImportError] = useState<string | null>(null);

  // File Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sync props when changed
  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
    if (sourcePath) setActiveSourcePath(sourcePath);
    if (sourceDuration) setActiveSourceDuration(sourceDuration);
    if (projectId || sourcePath) setShowSourcePicker(false);
  }, [projectId, sourcePath, sourceDuration]);

  // Load available projects and templates on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/projects')
        .then((r) => r.json())
        .then((d) => {
          const projs = d.projects || [];
          setAvailableProjects(projs);
          if (activeProjectId) {
            const current = projs.find((p: any) => p.id === activeProjectId);
            if (current) {
              setActiveProjectName(current.name);
              if (!activeSourcePath && current.source?.path) {
                setActiveSourcePath(current.source.path);
                setActiveSourceDuration(current.source.probe?.duration || 60);
              }
            }
          } else if (projs.length > 0 && !activeSourcePath) {
            setActiveProjectId(projs[0].id);
            setActiveSourcePath(projs[0].source?.path || '');
            setActiveSourceDuration(projs[0].source?.probe?.duration || 60);
            setActiveProjectName(projs[0].name || '');
          }
        })
        .catch(console.error);
    }
  }, [isOpen, activeProjectId]);

  // Handle local file path 0s import
  const handleImportLocal = async () => {
    const trimmed = localFilePathInput.trim();
    if (!trimmed) {
      setLocalImportError('Please enter the full Windows path to your video file.');
      return;
    }
    setIsImportingLocal(true);
    setLocalImportError(null);
    try {
      const res = await fetch('/api/media/import-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to import local file');
      }
      const proj = data.project;
      setActiveProjectId(proj.id);
      setActiveSourcePath(proj.source.path);
      setActiveSourceDuration(proj.source.probe?.duration || 60);
      setActiveProjectName(proj.name);
      setShowSourcePicker(false);
      setAvailableProjects((prev) => [proj, ...prev.filter((p) => p.id !== proj.id)]);
      if (onProjectsCreated) onProjectsCreated([proj.id]);
    } catch (err: any) {
      setLocalImportError(err.message);
    } finally {
      setIsImportingLocal(false);
    }
  };

  // Handle direct file upload with streaming
  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a video file to upload.');
      return;
    }
    setIsUploadingFile(true);
    setUploadProgress(10);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('name', uploadFile.name.replace(/\.[^/.]+$/, ''));

    try {
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 400);

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
      const proj = data.project;
      setActiveProjectId(proj.id);
      setActiveSourcePath(proj.source.path);
      setActiveSourceDuration(proj.source.probe?.duration || 60);
      setActiveProjectName(proj.name);
      setShowSourcePicker(false);
      setAvailableProjects((prev) => [proj, ...prev.filter((p) => p.id !== proj.id)]);
      if (onProjectsCreated) onProjectsCreated([proj.id]);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const formatDurationDisplay = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  // Configuration Inputs
  const [campaignBrief, setCampaignBrief] = useState('');
  const [minLength, setMinLength] = useState(20);
  const [maxLength, setMaxLength] = useState(60);
  const [targetCount, setTargetCount] = useState(15);
  const [contentType, setContentType] = useState<ContentType>('streamer_gameplay');
  const [scoringEngine, setScoringEngine] = useState<ScoringEngineType>('local');
  const [whisperModel, setWhisperModel] = useState<string>('large-v3-turbo');
  const [ollamaHost, setOllamaHost] = useState('http://127.0.0.1:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [avoidKeywordsInput, setAvoidKeywordsInput] = useState('gambling, politics, slur, hate');
  const [avoidKeywords, setAvoidKeywords] = useState<string[]>(['gambling', 'politics', 'slur']);

  // Connection Test State
  const [testStatus, setTestStatus] = useState<{ connected?: boolean; message?: string } | null>(null);
  const [isTestingConn, setIsTestingConn] = useState(false);

  // Background Job & Progress State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobStage, setJobStage] = useState<string>('Initializing...');
  const [jobEta, setJobEta] = useState<number | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review State
  const [highlightResult, setHighlightResult] = useState<HighlightJobResult | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [savedTemplates, setSavedTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Player & Trimmer State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Send to Editor State
  const [isApplying, setIsApplying] = useState(false);
  const [appliedProjects, setAppliedProjects] = useState<{ id: string; name: string }[] | null>(null);

  // Feedback Modal State
  const [feedbackSummary, setFeedbackSummary] = useState<any>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Load Templates & Feedback on Open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/templates')
        .then((r) => r.json())
        .then((d) => {
          const tpls = d.templates || [];
          setSavedTemplates(tpls);
          if (tpls.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(tpls[0].id);
          }
        })
        .catch(console.error);

      fetch('/api/highlight/feedback')
        .then((r) => r.json())
        .then((d) => setFeedbackSummary(d.summary))
        .catch(console.error);
    }
  }, [isOpen]);

  // Handle Avoid Keywords parsing
  const handleUpdateAvoidKeywords = (val: string) => {
    setAvoidKeywordsInput(val);
    const split = val
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    setAvoidKeywords(split);
  };

  // Test Connection
  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/highlight/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: scoringEngine,
          ollamaHost,
          ollamaModel,
          geminiApiKey,
        }),
      });
      const data = await res.json();
      setTestStatus(data);
    } catch (e: any) {
      setTestStatus({ connected: false, message: e.message });
    } finally {
      setIsTestingConn(false);
    }
  };

  // Launch Pipeline Job
  const handleStartHighlight = async () => {
    if (!activeProjectId) {
      setErrorMsg('Please select or insert a video file to highlight.');
      setShowSourcePicker(true);
      return;
    }

    setErrorMsg(null);
    setPhase('running');
    setJobProgress(2);
    setJobStage('Launching Auto-Highlight job...');

    const config: HighlightConfig = {
      campaignBrief: campaignBrief.trim() || undefined,
      minLength,
      maxLength,
      targetCount,
      contentType,
      scoringEngine,
      ollamaHost,
      ollamaModel,
      geminiApiKey: geminiApiKey.trim() || undefined,
      avoidKeywords,
      whisperModel,
    };

    try {
      const res = await fetch('/api/highlight/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, config }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to start highlight run');

      setActiveJobId(data.jobId);
    } catch (e: any) {
      setErrorMsg(e.message);
      setPhase('config');
    }
  };

  // Poll Job Status
  useEffect(() => {
    if (phase !== 'running' || !activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/highlight/status?jobId=${activeJobId}`);
        const data = await res.json();
        if (data.job) {
          setJobProgress(data.job.progress || 0);
          setJobStage(data.job.stage || 'Processing...');
          setJobEta(data.job.etaSeconds);

          if (data.job.status === 'completed' && data.result) {
            clearInterval(interval);
            setHighlightResult(data.result);
            setCandidates(data.result.candidates || []);
            setSelectedIndex(0);
            setPhase('review');
          } else if (data.job.status === 'failed') {
            clearInterval(interval);
            setErrorMsg(data.job.error || 'Auto-Highlight job failed');
            setPhase('config');
          } else if (data.job.status === 'cancelled') {
            clearInterval(interval);
            setPhase('config');
          }
        }
      } catch (err) {
        console.error('Error polling highlight job:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, activeJobId]);

  // Cancel Job
  const handleCancelJob = async () => {
    if (!activeJobId) return;
    try {
      await fetch('/api/highlight/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJobId }),
      });
      setPhase('config');
    } catch (e) {
      console.error(e);
    }
  };

  // Active Candidate
  const activeCandidate = candidates[selectedIndex];

  // Video Time sync to selected candidate
  useEffect(() => {
    if (videoRef.current && activeCandidate) {
      videoRef.current.currentTime = activeCandidate.start;
      setCurrentTime(activeCandidate.start);
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [selectedIndex, activeCandidate?.start]);

  // Video Loop within candidate start..end
  const handleTimeUpdate = () => {
    if (!videoRef.current || !activeCandidate) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    if (t >= activeCandidate.end) {
      videoRef.current.currentTime = activeCandidate.start;
    }
  };

  // Keyboard Navigation: A (Approve), R (Reject), Arrow keys, Space
  useEffect(() => {
    if (!isOpen || phase !== 'review') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleSetStatus(selectedIndex, 'approved');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleSetStatus(selectedIndex, 'rejected');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(candidates.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, phase, selectedIndex, candidates.length]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Approve / Reject status update
  const handleSetStatus = (idx: number, status: 'approved' | 'rejected' | 'pending') => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, status: c.status === status ? 'pending' : status } : c))
    );
  };

  // Feedback rating (Good/Bad)
  const handleRating = async (cand: Candidate, rating: 'good' | 'bad') => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === cand.id ? { ...c, userRating: c.userRating === rating ? undefined : rating } : c))
    );

    try {
      await fetch('/api/highlight/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: cand.id,
          rating,
          score: cand.score,
          title: cand.title,
          reason: cand.reason,
          rawScores: cand.rawScores,
          duration: cand.duration,
          projectId,
        }),
      });
      // Refresh summary
      const res = await fetch('/api/highlight/feedback');
      const d = await res.json();
      setFeedbackSummary(d.summary);
    } catch (e) {
      console.error('Failed to save feedback:', e);
    }
  };

  // Regenerate Title
  const handleRegenerateTitle = async (cand: Candidate) => {
    try {
      const res = await fetch('/api/highlight/regenerate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: cand,
          config: { campaignBrief, contentType, scoringEngine, ollamaHost, ollamaModel, geminiApiKey },
        }),
      });
      const data = await res.json();
      if (data.title) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === cand.id ? { ...c, title: data.title, reason: data.reason || c.reason } : c))
        );
      }
    } catch (e) {
      console.error('Failed to regenerate title:', e);
    }
  };

  // Edge-Trim Controls update
  const handleTrimChange = (field: 'start' | 'end', value: number) => {
    if (!activeCandidate) return;
    const clamped = Math.max(0, Math.round(value * 100) / 100);

    setCandidates((prev) =>
      prev.map((c, i) => {
        if (i !== selectedIndex) return c;
        const newStart = field === 'start' ? Math.min(clamped, c.end - 5) : c.start;
        const newEnd = field === 'end' ? Math.max(clamped, c.start + 5) : c.end;
        return {
          ...c,
          start: newStart,
          end: newEnd,
          duration: Math.round((newEnd - newStart) * 100) / 100,
        };
      })
    );

    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  // Send Approved to Editor
  const handleSendToEditor = async () => {
    const approved = candidates.filter((c) => c.status === 'approved');
    if (approved.length === 0) {
      alert('Please approve at least one candidate clip first (or press "A" on your keyboard).');
      return;
    }

    setIsApplying(true);
    try {
      const res = await fetch('/api/highlight/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProjectId: activeProjectId,
          templateId: selectedTemplateId || undefined,
          approvedCandidates: approved,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to dispatch clips to editor');

      setAppliedProjects(data.projects || []);
      if (onProjectsCreated && data.projects) {
        onProjectsCreated(data.projects.map((p: any) => p.id));
      }
    } catch (e: any) {
      alert(`Error creating projects: ${e.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Helper to render live viral subtitle preview
  const renderLiveSubtitle = (cand?: Candidate, time?: number) => {
    if (!cand) return null;
    if (!cand.words || cand.words.length === 0) {
      return <span>{cand.title}</span>;
    }
    const curTime = time || 0;
    const activeWordIdx = cand.words.findIndex((w) => curTime >= w.start && curTime <= w.end);
    const centerIdx = activeWordIdx >= 0 ? activeWordIdx : 0;
    const windowStart = Math.max(0, centerIdx - 2);
    const windowEnd = Math.min(cand.words.length, windowStart + 4);
    const visibleWords = cand.words.slice(windowStart, windowEnd);

    return (
      <div className="flex flex-wrap justify-center items-center gap-1.5">
        {visibleWords.map((w, i) => {
          const isAct = curTime >= w.start && curTime <= w.end;
          return (
            <span
              key={i}
              style={{
                color: isAct ? '#FFE600' : '#FFFFFF',
                transform: isAct ? 'scale(1.12)' : 'none',
                WebkitTextStroke: '3.5px #000000',
                paintOrder: 'stroke fill',
                textShadow: '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0 4px 10px rgba(0,0,0,0.9)',
                transition: 'transform 0.08s ease, color 0.08s ease',
              }}
              className="inline-block font-black tracking-normal"
            >
              {w.word}
            </span>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none text-slate-100">
      <div className="w-full max-w-6xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        {/* TOP BAR */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white tracking-tight">Auto-Highlight AI</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  LONG VIDEO TO VIRAL SHORTS
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Chunked Whisper AI transcription • Local energy signals • Sentence-boundary windows • LLM scoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {feedbackSummary && feedbackSummary.total > 0 && (
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 border border-slate-700 transition"
              >
                <ThumbsUp className="w-3 h-3 text-emerald-400" />
                <span>AI Tuning ({feedbackSummary.goodCount}👍 / {feedbackSummary.badCount}👎)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ERROR NOTIFICATION BANNER */}
        {errorMsg && (
          <div className="px-6 py-2 bg-red-950/80 border-b border-red-800/80 text-red-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="hover:text-white">✕</button>
          </div>
        )}

        {/* SCREEN 1: CONFIGURATION */}
        {phase === 'config' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TARGET VIDEO SOURCE BANNER & SELECTOR */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Source Video To Highlight
                  </span>
                  {activeSourcePath && !showSourcePicker && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ✓ Ready ({formatDurationDisplay(activeSourceDuration)})
                    </span>
                  )}
                </div>

                {activeSourcePath && (
                  <button
                    onClick={() => setShowSourcePicker(!showSourcePicker)}
                    className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 border border-slate-700 transition"
                  >
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{showSourcePicker ? 'Keep Current Video' : 'Change Video / Insert 2.8GB File'}</span>
                  </button>
                )}
              </div>

              {/* ACTIVE VIDEO SUMMARY CARD */}
              {!showSourcePicker && activeSourcePath ? (
                <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="space-y-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {activeProjectName || 'Source Video'}
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[11px] text-indigo-400 font-mono">
                        {formatDurationDisplay(activeSourceDuration)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate font-mono">
                      {activeSourcePath}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSourcePicker(true)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 font-medium transition"
                  >
                    Select Another Video
                  </button>
                </div>
              ) : (
                /* EXPANDED VIDEO SOURCE SELECTOR / INSERTION TABS */
                <div className="space-y-4 pt-1">
                  {/* Selector Tabs */}
                  <div className="flex border-b border-slate-800 gap-2 pb-2">
                    <button
                      onClick={() => { setSourceMode('local_path'); setLocalImportError(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                        sourceMode === 'local_path'
                          ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                      <span>Instant Local File Path (2.8GB+ Fast)</span>
                    </button>

                    <button
                      onClick={() => { setSourceMode('upload'); setUploadError(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                        sourceMode === 'upload'
                          ? 'bg-blue-600/15 border border-blue-500/40 text-blue-300'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
                      <span>Browse / Upload Video File</span>
                    </button>

                    {availableProjects.length > 0 && (
                      <button
                        onClick={() => setSourceMode('workspace')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                          sourceMode === 'workspace'
                            ? 'bg-indigo-600/15 border border-indigo-500/40 text-indigo-300'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Existing Projects ({availableProjects.length})</span>
                      </button>
                    )}
                  </div>

                  {/* TAB 1: INSTANT LOCAL PATH (FOR 2.8GB FILES) */}
                  {sourceMode === 'local_path' && (
                    <div className="space-y-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-200">
                            Instant 0-Second Transfer for Large Files (2.8GB+)
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Instead of waiting for a slow multi-gigabyte browser upload, paste the local path to your video file on your computer. ClipForge reads it directly from your disk with zero delay!
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. C:\Users\tiago\Videos\stream_vod.mp4 or D:\recordings\gameplay.mp4"
                          value={localFilePathInput}
                          onChange={(e) => setLocalFilePathInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleImportLocal()}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                        />
                        <button
                          onClick={handleImportLocal}
                          disabled={isImportingLocal || !localFilePathInput.trim()}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shrink-0 shadow-md shadow-amber-500/10"
                        >
                          {isImportingLocal ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Probing Video...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Load Video</span>
                            </>
                          )}
                        </button>
                      </div>

                      {localImportError && (
                        <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                          <span>{localImportError}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: BROWSE / UPLOAD */}
                  {sourceMode === 'upload' && (
                    <form onSubmit={handleUploadFile} className="space-y-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-blue-500/80 rounded-xl p-6 cursor-pointer bg-slate-900/40 hover:bg-slate-900/60 transition group">
                        <input
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                          className="hidden"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        />
                        <UploadCloud className="w-8 h-8 text-blue-400 mb-2 group-hover:scale-110 transition" />
                        <span className="text-xs font-semibold text-slate-300">
                          {uploadFile ? uploadFile.name : 'Click to browse or drop your video file here'}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          {uploadFile
                            ? `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB selected`
                            : 'MP4, MOV, MKV, WebM supported'}
                        </span>
                      </label>

                      {uploadFile && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="submit"
                            disabled={isUploadingFile}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md shadow-blue-600/20"
                          >
                            {isUploadingFile ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Uploading ({uploadProgress}%)...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>Upload & Select for Highlighting</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {isUploadingFile && (
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}

                      {uploadError && (
                        <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                          <span>{uploadError}</span>
                        </div>
                      )}
                    </form>
                  )}

                  {/* TAB 3: WORKSPACE PROJECTS */}
                  {sourceMode === 'workspace' && (
                    <div className="space-y-2 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {availableProjects.map((p) => {
                          const isCur = p.id === activeProjectId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setActiveProjectId(p.id);
                                setActiveSourcePath(p.source?.path || '');
                                setActiveSourceDuration(p.source?.probe?.duration || 60);
                                setActiveProjectName(p.name);
                                setShowSourcePicker(false);
                              }}
                              className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                                isCur
                                  ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className="text-xs font-semibold truncate text-white">{p.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono truncate">
                                  {p.source?.originalFileName || p.id}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono text-indigo-400 shrink-0">
                                {formatDurationDisplay(p.source?.probe?.duration || 0)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Rules & Campaign Brief */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Campaign Brief & Viral Tone (Optional)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Paste campaign guidelines or desired tone (e.g., 'Focus on intense 1v3 clutching plays and funny streamer reactions. Avoid slow looting or inventory menus. Keep tone hype and competitive.')"
                    value={campaignBrief}
                    onChange={(e) => setCampaignBrief(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    The scoring LLM evaluates every window against this brief to compute the <code className="text-indigo-400">brief_fit</code> score.
                  </p>
                </div>

                {/* Content Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Content Type (Tunes Scoring Weights)
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'streamer_gameplay', label: '🎮 Gameplay & Streamer', desc: 'Prioritizes hype spikes, shock & clutch payoffs' },
                      { id: 'talking_podcast', label: '🎙️ Podcast & Interview', desc: 'Prioritizes narrative clarity & standalone sense' },
                      { id: 'other', label: '⚡ Dynamic / Other', desc: 'Balanced virality & retention weights' },
                    ].map((ct) => (
                      <button
                        key={ct.id}
                        onClick={() => setContentType(ct.id as ContentType)}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          contentType === ct.id
                            ? 'bg-indigo-600/15 border-indigo-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-semibold text-xs text-white">{ct.label}</span>
                        <span className="text-[10px] text-slate-400 mt-1 leading-snug">{ct.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Avoid Keywords */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Disqualifying Avoid-Keywords (Pre-Filter)
                  </label>
                  <input
                    type="text"
                    value={avoidKeywordsInput}
                    onChange={(e) => handleUpdateAvoidKeywords(e.target.value)}
                    placeholder="comma separated, e.g. gambling, casino, politics, offensive"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {avoidKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/60 border border-red-800/80 text-red-300 flex items-center gap-1"
                      >
                        <span>✕ {kw}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Engine, Model, Length & Candidates */}
              <div className="space-y-5">
                {/* Speech AI Model (RTX 5050 CUDA Accelerated) */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Speech AI Model (Faster-Whisper)</span>
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      <span>RTX 5050 GPU Accelerated</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: 'large-v3-turbo',
                        label: 'Large-v3-Turbo',
                        badge: 'Recommended',
                        desc: 'OpenAI flagship accuracy • 4x faster with Tensor cores',
                      },
                      {
                        id: 'small',
                        label: 'Small',
                        badge: 'Balanced',
                        desc: 'Fast • Low VRAM • Good accuracy',
                      },
                      {
                        id: 'base',
                        label: 'Base',
                        badge: 'Fastest',
                        desc: 'Maximum speed • Basic accuracy',
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setWhisperModel(m.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          whisperModel === m.id
                            ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm'
                            : 'bg-slate-950/70 border-slate-800/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs text-white">{m.label}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              m.id === 'large-v3-turbo'
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {m.badge}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 leading-snug">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scoring Engine Selection */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      AI Scoring Engine
                    </label>
                    <span className="text-[10px] text-slate-500">Dual Local & API Engine</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setScoringEngine('local'); setTestStatus(null); }}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                        scoringEngine === 'local'
                          ? 'bg-blue-600/15 border-blue-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Cpu className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="font-semibold text-xs text-white">Local Ollama</div>
                        <div className="text-[10px] text-slate-400">RTX GPU / Private & Free</div>
                      </div>
                    </button>

                    <button
                      onClick={() => { setScoringEngine('api'); setTestStatus(null); }}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                        scoringEngine === 'api'
                          ? 'bg-purple-600/15 border-purple-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Cloud className="w-4 h-4 text-purple-400" />
                      <div>
                        <div className="font-semibold text-xs text-white">Google Gemini API</div>
                        <div className="text-[10px] text-slate-400">High speed cloud API</div>
                      </div>
                    </button>
                  </div>

                  {/* Engine Details */}
                  {scoringEngine === 'local' ? (
                    <div className="space-y-2 pt-1 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-400">Ollama Host URL</label>
                          <input
                            type="text"
                            value={ollamaHost}
                            onChange={(e) => setOllamaHost(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400">Model Name</label>
                          <input
                            type="text"
                            value={ollamaModel}
                            onChange={(e) => setOllamaModel(e.target.value)}
                            placeholder="e.g. llama3.2, mistral"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1 text-xs">
                      <div>
                        <label className="text-[11px] text-slate-400">Gemini API Key (or in .env)</label>
                        <input
                          type="password"
                          value={geminiApiKey}
                          onChange={(e) => setGeminiApiKey(e.target.value)}
                          placeholder="AIzaSy... (leave blank to read GEMINI_API_KEY from .env)"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={handleTestConnection}
                      disabled={isTestingConn}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition flex items-center gap-1.5"
                    >
                      {isTestingConn && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
                      <span>Test Engine Connection</span>
                    </button>

                    {testStatus && (
                      <span
                        className={`text-[11px] ${
                          testStatus.connected ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {testStatus.message}
                      </span>
                    )}
                  </div>
                </div>

                {/* Length & Target Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Clip Length Range (Sec)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Min:</span>
                        <input
                          type="number"
                          value={minLength}
                          onChange={(e) => setMinLength(Math.max(10, parseInt(e.target.value) || 20))}
                          className="w-12 bg-transparent text-right font-bold text-white focus:outline-none"
                        />
                        <span className="text-slate-500">s</span>
                      </div>
                      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Max:</span>
                        <input
                          type="number"
                          value={maxLength}
                          onChange={(e) => setMaxLength(Math.min(180, parseInt(e.target.value) || 60))}
                          className="w-12 bg-transparent text-right font-bold text-white focus:outline-none"
                        />
                        <span className="text-slate-500">s</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Candidate Count
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 15, 20].map((num) => (
                        <button
                          key={num}
                          onClick={() => setTargetCount(num)}
                          className={`py-2 rounded-xl text-xs font-bold border transition ${
                            targetCount === num
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {num} clips
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Launch Action Footer */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>100% Resumable & Cached (Source Hash SHA-256)</span>
              </div>

              <button
                onClick={handleStartHighlight}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 via-indigo-600 to-blue-600 hover:from-amber-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Run Auto-Highlight Pipeline</span>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: PIPELINE PROGRESS */}
        {phase === 'running' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8 max-w-xl mx-auto w-full text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-400 p-1 animate-pulse">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
              </div>
            </div>

            <div className="space-y-2 w-full">
              <h3 className="text-xl font-extrabold text-white">Extracting Best Highlights</h3>
              <p className="text-xs text-slate-400 min-h-[30px]">{jobStage}</p>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${jobProgress}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>{jobProgress}% completed</span>
                <span>{jobEta ? `ETA ~${jobEta}s remaining` : 'Calculating...'}</span>
              </div>
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="grid grid-cols-5 gap-2 w-full pt-4">
              {[
                { label: 'Transcribe', minPct: 5 },
                { label: 'Signals', minPct: 48 },
                { label: 'Windows', minPct: 62 },
                { label: 'Scoring', minPct: 70 },
                { label: 'Refine', minPct: 94 },
              ].map((st, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg border text-center transition ${
                    jobProgress >= st.minPct
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-900/40 border-slate-800 text-slate-600'
                  }`}
                >
                  <div className="text-[10px] font-bold">Stage {i + 1}</div>
                  <div className="text-[9px] truncate">{st.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={handleCancelJob}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs rounded-xl transition"
            >
              Cancel Analysis
            </button>
          </div>
        )}

        {/* SCREEN 3: CANDIDATE REVIEW & TRIM UI */}
        {phase === 'review' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Summary Banner */}
            <div className="px-6 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Considered <b>{highlightResult?.stats.totalWindowsConsidered || 0}</b> windows →{' '}
                    <b>{highlightResult?.stats.survivedPreFilter || 0}</b> pre-filtered →{' '}
                    <b className="text-amber-400">{candidates.length}</b> viral candidates
                  </span>
                </div>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  Engine: <b className="text-slate-200">{highlightResult?.stats.llmEngineUsed || scoringEngine}</b>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  Time: <b>{Math.round((highlightResult?.stats.elapsedMs || 0) / 1000)}s</b>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-medium">Cost: $0.00</span>
              </div>

              <div className="text-[11px] text-slate-400">
                Keyboard: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">A</kbd> Approve |{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">R</kbd> Reject |{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Space</kbd> Play
              </div>
            </div>

            {/* Main Split: Candidate List (Left) vs Player & Trimmer (Right) */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Candidate List */}
              <div className="w-[420px] border-r border-slate-800 overflow-y-auto p-3 space-y-2.5 bg-slate-950/40">
                {candidates.map((cand, idx) => {
                  const isSelected = idx === selectedIndex;
                  const isApproved = cand.status === 'approved';
                  const isRejected = cand.status === 'rejected';

                  // Score badge color
                  let scoreColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  if (cand.score >= 85) scoreColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  else if (cand.score >= 70) scoreColor = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';

                  return (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedIndex(idx)}
                      className={`p-3 rounded-xl border transition cursor-pointer relative ${
                        isSelected
                          ? 'bg-slate-900 border-indigo-500 shadow-md shadow-indigo-500/10'
                          : isApproved
                          ? 'bg-emerald-950/20 border-emerald-800/40 opacity-90'
                          : isRejected
                          ? 'bg-slate-950/40 border-slate-900 opacity-40 line-through'
                          : 'bg-slate-900/40 border-slate-850 hover:bg-slate-900/80 hover:border-slate-800'
                      }`}
                    >
                      {/* Row 1: Rank, Score Badge, Duration, Actions */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-400">#{cand.rank}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}>
                            {cand.score}/100
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatTime(cand.start)} - {formatTime(cand.end)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                            {Math.round(cand.duration)}s
                          </span>
                        </div>

                        {/* Status Pills / Quick Toggle */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            title="Approve (A)"
                            onClick={() => handleSetStatus(idx, 'approved')}
                            className={`p-1 rounded transition ${
                              isApproved ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-emerald-400'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Reject (R)"
                            onClick={() => handleSetStatus(idx, 'rejected')}
                            className={`p-1 rounded transition ${
                              isRejected ? 'bg-red-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-red-400'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Suggested Hook Title */}
                      <h4 className="font-bold text-xs text-white leading-snug line-clamp-2">
                        {cand.title}
                      </h4>

                      {/* Row 3: Reason */}
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {cand.reason}
                      </p>

                      {/* Row 4: Risk Flags & Feedback Thumbs */}
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-1">
                          {cand.riskFlags && cand.riskFlags.length > 0 ? (
                            cand.riskFlags.map((rf, rIdx) => (
                              <span
                                key={rIdx}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              >
                                ⚠ {rf}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] text-slate-500">No risk flags</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            title="Regenerate Title"
                            onClick={() => handleRegenerateTitle(cand)}
                            className="p-1 text-slate-500 hover:text-indigo-400 transition"
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                          <button
                            title="Mark as Good Output"
                            onClick={() => handleRating(cand, 'good')}
                            className={`p-1 transition ${
                              cand.userRating === 'good' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button
                            title="Mark as Bad Output"
                            onClick={() => handleRating(cand, 'bad')}
                            className={`p-1 transition ${
                              cand.userRating === 'bad' ? 'text-red-400' : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Embedded Preview Player & Precision Edge Trimmer */}
              <div className="flex-1 flex flex-col bg-slate-900/30 overflow-y-auto p-6 space-y-5">
                {activeCandidate ? (
                  <>
                    {/* Header of Active Candidate */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-400">CANDIDATE #{activeCandidate.rank}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-300 font-mono">
                            {formatTime(activeCandidate.start)} to {formatTime(activeCandidate.end)}
                          </span>
                        </div>
                        <h2 className="text-base font-extrabold text-white mt-0.5">{activeCandidate.title}</h2>
                      </div>

                      {/* Approve / Reject buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSetStatus(selectedIndex, 'approved')}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                            activeCandidate.status === 'approved'
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>{activeCandidate.status === 'approved' ? 'Approved' : 'Approve (A)'}</span>
                        </button>

                        <button
                          onClick={() => handleSetStatus(selectedIndex, 'rejected')}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                            activeCandidate.status === 'rejected'
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <X className="w-4 h-4" />
                          <span>{activeCandidate.status === 'rejected' ? 'Rejected' : 'Reject (R)'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Video Player Display */}
                    <div className="relative aspect-video max-h-[340px] bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center">
                      <video
                        ref={videoRef}
                        src={`/api/media?path=${encodeURIComponent(activeSourcePath || '')}`}
                        onTimeUpdate={handleTimeUpdate}
                        className="w-full h-full object-contain"
                      />

                      {/* Play / Pause Overlay Button */}
                      <button
                        onClick={togglePlay}
                        className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition group"
                      >
                        <div className="w-12 h-12 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 flex items-center justify-center text-white group-hover:scale-110 transition shadow-lg">
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </div>
                      </button>

                      {/* Live Karaoke Subtitle Preview Overlay */}
                      <div className="absolute bottom-4 inset-x-6 text-center pointer-events-none select-none">
                        <div
                          style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: '17px',
                          }}
                          className="inline-block px-4 py-1.5 rounded-xl font-black drop-shadow-xl"
                        >
                          {renderLiveSubtitle(activeCandidate, currentTime)}
                        </div>
                      </div>
                    </div>

                    {/* Edge-Trimmer & Precision Boundaries */}
                    <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Scissors className="w-4 h-4 text-indigo-400 -rotate-45" />
                          <span>Interactive Edge-Trim & Snapped Boundaries</span>
                        </span>
                        <span className="text-amber-400 font-mono font-bold">
                          Length: {Math.round(activeCandidate.duration * 10) / 10}s
                        </span>
                      </div>

                      {/* Timestamp Sliders / Inputs */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Clip Start (Seconds)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={activeCandidate.start}
                              onChange={(e) => handleTrimChange('start', parseFloat(e.target.value) || 0)}
                              className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                            />
                            <span className="text-xs text-slate-400 font-mono">{formatTime(activeCandidate.start)}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] text-slate-400">Clip End (Seconds)</label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleTrimChange('end', Math.max(activeCandidate.start + 5, activeCandidate.end - 2))}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                                title="Trim 2 seconds"
                              >
                                -2s
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTrimChange('end', activeCandidate.end + 2)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                                title="Extend 2 seconds"
                              >
                                +2s
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTrimChange('end', activeCandidate.end + 5)}
                                className="px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold"
                                title="Extend 5 seconds to include speaker reply"
                              >
                                +5s (Keep Talking)
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={activeCandidate.end}
                              onChange={(e) => handleTrimChange('end', parseFloat(e.target.value) || 0)}
                              className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                            />
                            <span className="text-xs text-slate-400 font-mono">{formatTime(activeCandidate.end)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Timeline Drag Bar */}
                      <div className="pt-2">
                        <div className="relative w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                          <div
                            className="absolute top-0 bottom-0 bg-indigo-500/70 border-x-2 border-indigo-300"
                            style={{
                              left: `${(activeCandidate.start / (sourceDuration || 100)) * 100}%`,
                              width: `${(activeCandidate.duration / (sourceDuration || 100)) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                          <span>0:00</span>
                          <span>Entire Source ({formatTime(sourceDuration || 0)})</span>
                        </div>
                      </div>
                    </div>

                    {/* Transcript Highlight View */}
                    <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Segment Transcript (Word-level Whisper)
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {activeCandidate.text}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                    Select a candidate from the left list to preview and trim.
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM BAR: Send Approved to Editor */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white">Apply Saved Template:</span>
                </div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Default (Current Project Layout & Style)</option>
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <div className="text-xs text-slate-400 ml-2">
                  Approved:{' '}
                  <b className="text-emerald-400">{candidates.filter((c) => c.status === 'approved').length}</b> of{' '}
                  {candidates.length}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setPhase('config')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
                >
                  Settings
                </button>

                <button
                  onClick={handleSendToEditor}
                  disabled={isApplying || candidates.filter((c) => c.status === 'approved').length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition active:scale-95"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Projects...</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4 -rotate-45" />
                      <span>
                        Send Approved to Editor (
                        {candidates.filter((c) => c.status === 'approved').length})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: SUCCESS CREATED PROJECTS */}
        {appliedProjects && (
          <div className="absolute inset-0 z-60 bg-black/85 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-white">Projects Dispatched to Editor!</h3>
                <p className="text-xs text-slate-400">
                  Successfully created {appliedProjects.length} ready-to-export projects with pre-filled subtitles and template framing.
                </p>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 text-left py-2">
                {appliedProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/editor/${p.id}`}
                    className="block p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-xs text-white truncate flex items-center justify-between group transition"
                  >
                    <span className="truncate">{p.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-1 transition" />
                  </Link>
                ))}
              </div>

              <button
                onClick={() => {
                  setAppliedProjects(null);
                  onClose();
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
              >
                Back to Workspace
              </button>
            </div>
          </div>
        )}

        {/* MODAL: FEEDBACK TUNING INSIGHTS */}
        {showFeedbackModal && feedbackSummary && (
          <div className="absolute inset-0 z-60 bg-black/85 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">Scoring Weight Tuning Report</h3>
                </div>
                <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Good Candidates</div>
                    <div className="text-base font-bold text-emerald-400">{feedbackSummary.goodCount}</div>
                    <div className="text-[10px] text-slate-500">Avg Score: {feedbackSummary.goodAvgScore}</div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Bad Candidates</div>
                    <div className="text-base font-bold text-red-400">{feedbackSummary.badCount}</div>
                    <div className="text-[10px] text-slate-500">Avg Score: {feedbackSummary.badAvgScore}</div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="font-semibold text-slate-300 text-[11px]">AI Recommendations:</div>
                  {feedbackSummary.insights.map((ins: string, i: number) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
                      💡 {ins}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowFeedbackModal(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function getCurrentWord(candidate: Candidate, time: number): string | null {
  if (!candidate.words || candidate.words.length === 0) return null;
  const match = candidate.words.find((w) => time >= w.start && time <= w.end);
  return match ? match.word : null;
}
