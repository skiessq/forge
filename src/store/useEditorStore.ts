import { create } from 'zustand';
import { Project, AspectRatio, LayoutTemplateId, CropRect, SubtitleStyle, IntroHookConfig, TransitionType } from '@/lib/types';
import { CANVAS_PRESETS, getLayoutTemplate } from '@/lib/constants';

interface EditorState {
  project: Project | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;

  // Playback & Timeline
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  zoom: number; // px per second

  // Selection
  selectedTrackId: string | null;
  selectedClipId: string | null;
  selectedRegionId: string | null;
  selectedSubtitleId: string | null;
  selectedOverlayType: 'region' | 'subtitle' | 'hook' | null;
  safeZoneVisible: boolean;
  isTimelineVisible: boolean;
  snappingEnabled: boolean;

  layoutScope: 'clip' | 'all';
  setLayoutScope: (scope: 'clip' | 'all') => void;

  // History for Undo/Redo (at least 50 steps)
  history: Project[];
  historyIndex: number;

  // Actions
  setProject: (project: Project) => void;
  updateProject: (fn: (current: Project) => Project, pushHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setSafeZoneVisible: (visible: boolean) => void;
  setIsTimelineVisible: (visible: boolean) => void;
  toggleTimeline: () => void;
  setSnappingEnabled: (enabled: boolean) => void;
  toggleSnapping: () => void;
  setSelectedRegionId: (id: string | null) => void;
  setSelectedSubtitleId: (id: string | null) => void;
  setSelectedClipId: (id: string | null) => void;
  setSelectedOverlayType: (type: 'region' | 'subtitle' | 'hook' | null) => void;

  setCanvasAspectRatio: (ratio: AspectRatio) => void;
  setLayoutTemplate: (templateId: LayoutTemplateId, targetClipId?: string | null) => void;
  setSplitRatio: (ratio: number) => void;
  setSecondaryMedia: (
    mediaPath: string | null,
    mediaType?: 'video' | 'image' | 'gif',
    probe?: { width: number; height: number; duration?: number }
  ) => void;
  updateRegionCrop: (regionId: string, crop: Partial<CropRect>) => void;
  zoomRegion: (regionId: string, zoomFactor: number) => void;
  resetRegionCrop: (regionId: string) => void;
  setTransition: (fromClipId: string, toClipId: string, type: TransitionType, duration?: number) => void;
  removeTransition: (fromClipId: string, toClipId: string) => void;
  updateSubtitleStyle: (style: Partial<SubtitleStyle>) => void;
  updateIntroHook: (hook: Partial<IntroHookConfig>) => void;

  saveToServer: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  isLoading: false,
  isSaving: false,
  lastSavedAt: null,

  currentTime: 0,
  duration: 10,
  isPlaying: false,
  zoom: 50, // 50px per second default

  selectedTrackId: null,
  selectedClipId: null,
  selectedRegionId: null,
  selectedSubtitleId: null,
  selectedOverlayType: null,
  safeZoneVisible: true,
  isTimelineVisible: true,
  snappingEnabled: true,
  layoutScope: 'clip',
  setLayoutScope: (layoutScope) => set({ layoutScope }),

  history: [],
  historyIndex: -1,

  setProject: (project) => {
    const dur = project.source.probe?.duration || 10;
    set({
      project,
      duration: dur,
      currentTime: 0,
      selectedRegionId: project.layout.regions[0]?.id || null,
      history: [JSON.parse(JSON.stringify(project))],
      historyIndex: 0,
    });
  },

  updateProject: (fn, pushHistory = true) => {
    const { project, history, historyIndex } = get();
    if (!project) return;

    const next = fn(JSON.parse(JSON.stringify(project)));
    next.updatedAt = new Date().toISOString();

    if (pushHistory) {
      const truncatedHistory = history.slice(0, historyIndex + 1);
      const nextHistory = [...truncatedHistory, JSON.parse(JSON.stringify(next))];
      // Limit to 50 undo steps
      if (nextHistory.length > 50) nextHistory.shift();

      set({
        project: next,
        history: nextHistory,
        historyIndex: nextHistory.length - 1,
      });
    } else {
      set({ project: next });
    }
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      set({
        project: JSON.parse(JSON.stringify(prev)),
        historyIndex: historyIndex - 1,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      set({
        project: JSON.parse(JSON.stringify(next)),
        historyIndex: historyIndex + 1,
      });
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  setCurrentTime: (time) => {
    const dur = get().duration;
    const clamped = Math.max(0, Math.min(dur, time));
    set({ currentTime: clamped });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(200, zoom)) }),
  setSafeZoneVisible: (safeZoneVisible) => set({ safeZoneVisible }),
  setIsTimelineVisible: (isTimelineVisible) => set({ isTimelineVisible }),
  toggleTimeline: () => set((state) => ({ isTimelineVisible: !state.isTimelineVisible })),
  setSnappingEnabled: (snappingEnabled) => set({ snappingEnabled }),
  toggleSnapping: () => set((state) => ({ snappingEnabled: !state.snappingEnabled })),
  setSelectedRegionId: (id) => set({ selectedRegionId: id, selectedOverlayType: id ? 'region' : null }),
  setSelectedSubtitleId: (id) => set({ selectedSubtitleId: id, selectedOverlayType: id ? 'subtitle' : null }),
  setSelectedClipId: (id) => set({ selectedClipId: id, layoutScope: id ? 'clip' : get().layoutScope }),
  setSelectedOverlayType: (selectedOverlayType) => set({ selectedOverlayType }),

  setCanvasAspectRatio: (ratio) => {
    const preset = CANVAS_PRESETS[ratio];
    if (!preset) return;
    get().updateProject((draft) => {
      draft.canvas = { ...preset };
      return draft;
    });
  },

  setLayoutTemplate: (templateId, targetClipId) => {
    get().updateProject((draft) => {
      const { selectedClipId, layoutScope, currentTime } = get();
      const vTrack = draft.tracks.find((t) => t.type === 'video');
      const clips = vTrack?.clips || [];
      const hasMultipleClips = clips.length > 1;

      // Preserve existing secondary media if any
      const existingSecondaryPath =
        draft.layout?.secondaryMediaPath ||
        clips.find((c) => c.layoutOverride?.secondaryMediaPath)?.layoutOverride?.secondaryMediaPath;
      const existingSecondaryType =
        draft.layout?.secondaryMediaType ||
        clips.find((c) => c.layoutOverride?.secondaryMediaType)?.layoutOverride?.secondaryMediaType ||
        'video';
      const existingSecondaryProbe =
        draft.layout?.secondaryMediaProbe ||
        clips.find((c) => c.layoutOverride?.secondaryMediaProbe)?.layoutOverride?.secondaryMediaProbe;

      const applySecondaryPreservation = (lay: any) => {
        if (
          (templateId === 'media_top_game_bottom' || templateId === 'media_bottom_game_top') &&
          existingSecondaryPath
        ) {
          lay.secondaryMediaPath = existingSecondaryPath;
          lay.secondaryMediaType = existingSecondaryType;
          lay.secondaryMediaProbe = existingSecondaryProbe;
        }
      };

      // 1. Single clip on timeline -> Always update canonical draft.layout and clip override
      if (!hasMultipleClips) {
        const ratio = clips[0]?.layoutOverride?.splitRatio || draft.layout.splitRatio || 0.5;
        const newLayout = getLayoutTemplate(templateId, ratio);
        applySecondaryPreservation(newLayout);
        draft.layout = newLayout;
        if (clips[0]) {
          clips[0].layoutOverride = JSON.parse(JSON.stringify(newLayout));
        }
        return draft;
      }

      // 2. Multi-clip timeline with specific clip targeting
      const effectiveClipId = targetClipId !== undefined
        ? targetClipId
        : (layoutScope === 'clip'
            ? (selectedClipId || clips.find((c) => currentTime >= c.start && currentTime < c.start + c.duration)?.id || clips[0]?.id)
            : null);

      if (effectiveClipId && layoutScope === 'clip') {
        const targetClip = clips.find((c) => c.id === effectiveClipId);
        if (targetClip) {
          const ratio = targetClip.layoutOverride?.splitRatio || draft.layout.splitRatio || 0.5;
          const newLayout = getLayoutTemplate(templateId, ratio);
          applySecondaryPreservation(newLayout);
          targetClip.layoutOverride = newLayout;
          // Sync secondary media info to draft.layout fallback
          if (newLayout.secondaryMediaPath && !draft.layout.secondaryMediaPath) {
            draft.layout.secondaryMediaPath = newLayout.secondaryMediaPath;
            draft.layout.secondaryMediaType = newLayout.secondaryMediaType;
            draft.layout.secondaryMediaProbe = newLayout.secondaryMediaProbe;
          }
          return draft;
        }
      }

      // 3. Multi-clip timeline applying to all clips
      const newLayout = getLayoutTemplate(templateId, draft.layout.splitRatio || 0.5);
      applySecondaryPreservation(newLayout);
      draft.layout = newLayout;
      clips.forEach((c) => {
        c.layoutOverride = JSON.parse(JSON.stringify(newLayout));
      });
      return draft;
    });

    const activeClip = get().project?.tracks.find((t) => t.type === 'video')?.clips.find((c) => c.id === get().selectedClipId);
    const firstRegion = (activeClip?.layoutOverride || get().project?.layout)?.regions[0]?.id || null;
    set({ selectedRegionId: firstRegion });
  },

  setSplitRatio: (ratio) => {
    const clamped = Math.max(0.2, Math.min(0.8, ratio));
    get().updateProject((draft) => {
      const { selectedClipId, layoutScope, currentTime } = get();
      const vTrack = draft.tracks.find((t) => t.type === 'video');
      const clips = vTrack?.clips || [];
      const hasMultipleClips = clips.length > 1;

      const effectiveClipId = hasMultipleClips && layoutScope === 'clip'
        ? (selectedClipId || clips.find((c) => currentTime >= c.start && currentTime < c.start + c.duration)?.id)
        : null;

      const updateLayoutRatio = (lay: any) => {
        lay.splitRatio = clamped;
        if (lay.regions && lay.regions.length >= 2) {
          lay.regions[0].targetBounds.height = clamped;
          lay.regions[1].targetBounds.y = clamped;
          lay.regions[1].targetBounds.height = 1 - clamped;

          const canvasW = draft.canvas.width;
          const canvasH = draft.canvas.height;
          const srcW = draft.source.probe?.width || 1920;
          const srcH = draft.source.probe?.height || 1080;
          const srcAspect = srcW / srcH;

          // Automatically update crop aspect ratios to eliminate stretching
          for (let i = 0; i < 2; i++) {
            const reg = lay.regions[i];
            const targetAspect = (canvasW * reg.targetBounds.width) / Math.max(1, canvasH * reg.targetBounds.height);
            const currentW = reg.crop.width;
            const centerX = reg.crop.x + currentW / 2;
            const centerY = reg.crop.y + reg.crop.height / 2;

            const newH = (currentW * srcAspect) / targetAspect;
            reg.crop.height = parseFloat(newH.toFixed(3));
            reg.crop.y = parseFloat((centerY - newH / 2).toFixed(3));
          }
        }
      };

      if (!hasMultipleClips) {
        updateLayoutRatio(draft.layout);
        if (clips[0]?.layoutOverride) {
          updateLayoutRatio(clips[0].layoutOverride);
        }
        return draft;
      }

      if (effectiveClipId && layoutScope === 'clip') {
        const targetClip = clips.find((c) => c.id === effectiveClipId);
        if (targetClip) {
          if (!targetClip.layoutOverride) {
            targetClip.layoutOverride = JSON.parse(JSON.stringify(draft.layout));
          }
          updateLayoutRatio(targetClip.layoutOverride);
          return draft;
        }
      }

      updateLayoutRatio(draft.layout);
      if (layoutScope === 'all') {
        clips.forEach((c) => {
          if (c.layoutOverride) updateLayoutRatio(c.layoutOverride);
        });
      }
      return draft;
    });
  },

  setSecondaryMedia: (mediaPath, mediaType, probe) => {
    get().updateProject((draft) => {
      const { selectedClipId, layoutScope, currentTime } = get();
      const vTrack = draft.tracks.find((t) => t.type === 'video');
      const clips = vTrack?.clips || [];
      const hasMultipleClips = clips.length > 1;

      const effectiveClipId = hasMultipleClips && layoutScope === 'clip'
        ? (selectedClipId || clips.find((c) => currentTime >= c.start && currentTime < c.start + c.duration)?.id)
        : null;

      const updateLayoutSecondary = (lay: any) => {
        lay.secondaryMediaPath = mediaPath || undefined;
        lay.secondaryMediaType = mediaType || undefined;
        lay.secondaryMediaProbe = probe || undefined;

        if (mediaPath && lay.regions) {
          const secReg = lay.regions.find((r: any) => r.sourceType === 'secondary_media');
          if (secReg) {
            const canvasW = draft.canvas.width;
            const canvasH = draft.canvas.height;
            const targetAspect = (canvasW * secReg.targetBounds.width) / Math.max(1, canvasH * secReg.targetBounds.height);
            const sW = probe?.width || 1920;
            const sH = probe?.height || 1080;
            const sAspect = sW / sH;

            let w = 1.0;
            let h = (w * sAspect) / targetAspect;
            if (secReg.fit === 'cover' && h < 1.0) {
              h = 1.0;
              w = (h * targetAspect) / sAspect;
            }
            secReg.crop = {
              x: parseFloat(((1 - w) / 2).toFixed(3)),
              y: parseFloat(((1 - h) / 2).toFixed(3)),
              width: parseFloat(w.toFixed(3)),
              height: parseFloat(h.toFixed(3)),
            };
          }
        }
      };

      if (!hasMultipleClips) {
        updateLayoutSecondary(draft.layout);
        if (clips[0]) {
          if (!clips[0].layoutOverride) {
            clips[0].layoutOverride = JSON.parse(JSON.stringify(draft.layout));
          } else {
            updateLayoutSecondary(clips[0].layoutOverride);
          }
        }
        return draft;
      }

      if (effectiveClipId && layoutScope === 'clip') {
        const targetClip = clips.find((c) => c.id === effectiveClipId);
        if (targetClip) {
          if (!targetClip.layoutOverride) {
            targetClip.layoutOverride = JSON.parse(JSON.stringify(draft.layout));
          }
          updateLayoutSecondary(targetClip.layoutOverride);
          // Keep draft.layout in sync as default fallback
          updateLayoutSecondary(draft.layout);
          return draft;
        }
      }

      updateLayoutSecondary(draft.layout);
      if (layoutScope === 'all') {
        clips.forEach((c) => {
          if (c.layoutOverride) updateLayoutSecondary(c.layoutOverride);
        });
      }
      return draft;
    });
  },

  updateRegionCrop: (regionId, cropUpdate) => {
    get().updateProject((draft) => {
      const selectedClipId = get().selectedClipId;
      const curTime = get().currentTime;
      const vTrack = draft.tracks.find((t) => t.type === 'video');
      const targetClip = vTrack?.clips.find((c) =>
        selectedClipId ? c.id === selectedClipId : curTime >= c.start && curTime < c.start + c.duration
      );

      const newCrop = {
        x: cropUpdate.x !== undefined ? Math.max(-2, Math.min(2, cropUpdate.x)) : undefined,
        y: cropUpdate.y !== undefined ? Math.max(-2, Math.min(2, cropUpdate.y)) : undefined,
        width: cropUpdate.width !== undefined ? Math.max(0.02, Math.min(3, cropUpdate.width)) : undefined,
        height: cropUpdate.height !== undefined ? Math.max(0.02, Math.min(3, cropUpdate.height)) : undefined,
      };

      // 1. If multiple clips exist, save to target clip's layoutOverride
      if (targetClip && vTrack && vTrack.clips.length > 1) {
        if (!targetClip.layoutOverride) {
          targetClip.layoutOverride = JSON.parse(JSON.stringify(draft.layout));
        }
        const clipRegion = targetClip.layoutOverride?.regions.find((r) => r.id === regionId);
        if (clipRegion) {
          clipRegion.crop = {
            x: newCrop.x !== undefined ? newCrop.x : clipRegion.crop.x,
            y: newCrop.y !== undefined ? newCrop.y : clipRegion.crop.y,
            width: newCrop.width !== undefined ? newCrop.width : clipRegion.crop.width,
            height: newCrop.height !== undefined ? newCrop.height : clipRegion.crop.height,
          };
        }
      }

      // 2. Also keep global project layout in sync
      const region = draft.layout.regions.find((r) => r.id === regionId);
      if (region) {
        region.crop = {
          x: newCrop.x !== undefined ? newCrop.x : region.crop.x,
          y: newCrop.y !== undefined ? newCrop.y : region.crop.y,
          width: newCrop.width !== undefined ? newCrop.width : region.crop.width,
          height: newCrop.height !== undefined ? newCrop.height : region.crop.height,
        };
      }
      return draft;
    }, false); // don't flood undo history on continuous dragging
  },

  zoomRegion: (regionId, zoomFactor) => {
    get().updateProject((draft) => {
      const selectedClipId = get().selectedClipId;
      const curTime = get().currentTime;
      const vTrack = draft.tracks.find((t) => t.type === 'video');
      const targetClip = vTrack?.clips.find((c) =>
        selectedClipId ? c.id === selectedClipId : curTime >= c.start && curTime < c.start + c.duration
      );

      const applyZoom = (reg: any) => {
        const canvasW = draft.canvas.width;
        const canvasH = draft.canvas.height;
        const targetAspect = (canvasW * reg.targetBounds.width) / Math.max(1, canvasH * reg.targetBounds.height);
        const isSecondary = reg.sourceType === 'secondary_media';
        const srcW = isSecondary
          ? (draft.layout.secondaryMediaProbe?.width || 1920)
          : (draft.source.probe?.width || 1920);
        const srcH = isSecondary
          ? (draft.layout.secondaryMediaProbe?.height || 1080)
          : (draft.source.probe?.height || 1080);
        const srcAspect = srcW / srcH;

        const currentW = reg.crop.width;
        const newW = Math.max(0.05, Math.min(2.5, currentW / zoomFactor));
        const newH = (newW * srcAspect) / targetAspect;

        // Keep center anchored
        const centerX = reg.crop.x + currentW / 2;
        const centerY = reg.crop.y + reg.crop.height / 2;
        reg.crop = {
          x: parseFloat((centerX - newW / 2).toFixed(3)),
          y: parseFloat((centerY - newH / 2).toFixed(3)),
          width: parseFloat(newW.toFixed(3)),
          height: parseFloat(newH.toFixed(3)),
        };
      };

      if (targetClip && vTrack && vTrack.clips.length > 1) {
        if (!targetClip.layoutOverride) {
          targetClip.layoutOverride = JSON.parse(JSON.stringify(draft.layout));
        }
        const clipRegion = targetClip.layoutOverride?.regions.find((r) => r.id === regionId);
        if (clipRegion) applyZoom(clipRegion);
      }

      const region = draft.layout.regions.find((r) => r.id === regionId);
      if (region) applyZoom(region);

      return draft;
    }, false);
  },

  resetRegionCrop: (regionId) => {
    get().updateProject((draft) => {
      const selectedClipId = get().selectedClipId;
      const curTime = get().currentTime;
      const vTrack = draft.tracks.find((t) => t.type === 'video');
      const targetClip = vTrack?.clips.find((c) =>
        selectedClipId ? c.id === selectedClipId : curTime >= c.start && curTime < c.start + c.duration
      );

      const applyReset = (reg: any) => {
        const canvasW = draft.canvas.width;
        const canvasH = draft.canvas.height;
        const targetAspect = (canvasW * reg.targetBounds.width) / Math.max(1, canvasH * reg.targetBounds.height);
        const isSecondary = reg.sourceType === 'secondary_media';
        const srcW = isSecondary
          ? (draft.layout.secondaryMediaProbe?.width || 1920)
          : (draft.source.probe?.width || 1920);
        const srcH = isSecondary
          ? (draft.layout.secondaryMediaProbe?.height || 1080)
          : (draft.source.probe?.height || 1080);
        const srcAspect = srcW / srcH;

        let w = 1.0;
        let h = (w * srcAspect) / targetAspect;
        if (h > 1.0) {
          h = 1.0;
          w = (h * targetAspect) / srcAspect;
        }

        reg.crop = {
          x: parseFloat(((1 - w) / 2).toFixed(3)),
          y: parseFloat(((1 - h) / 2).toFixed(3)),
          width: parseFloat(w.toFixed(3)),
          height: parseFloat(h.toFixed(3)),
        };
      };

      if (targetClip && vTrack && vTrack.clips.length > 1) {
        if (!targetClip.layoutOverride) {
          targetClip.layoutOverride = JSON.parse(JSON.stringify(draft.layout));
        }
        const clipRegion = targetClip.layoutOverride?.regions.find((r) => r.id === regionId);
        if (clipRegion) applyReset(clipRegion);
      }

      const region = draft.layout.regions.find((r) => r.id === regionId);
      if (region) applyReset(region);

      return draft;
    }, true);
  },

  setTransition: (fromClipId, toClipId, type, duration = 0.5) => {
    get().updateProject((draft) => {
      if (!draft.transitions) draft.transitions = [];
      draft.transitions = draft.transitions.filter(
        (t) => !(t.fromClipId === fromClipId && t.toClipId === toClipId)
      );

      if (type !== 'cut') {
        draft.transitions.push({
          id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          fromClipId,
          toClipId,
          type,
          duration: Math.max(0.1, Math.min(2.0, duration)),
        });
      }
      return draft;
    });
  },

  removeTransition: (fromClipId, toClipId) => {
    get().updateProject((draft) => {
      if (!draft.transitions) return draft;
      draft.transitions = draft.transitions.filter(
        (t) => !(t.fromClipId === fromClipId && t.toClipId === toClipId)
      );
      return draft;
    });
  },

  updateSubtitleStyle: (style) => {
    get().updateProject((draft) => {
      draft.subtitleStyle = {
        ...draft.subtitleStyle,
        ...style,
      };
      return draft;
    }, false);
  },

  updateIntroHook: (hook) => {
    get().updateProject((draft) => {
      if (!draft.introHook) {
        draft.introHook = {
          enabled: true,
          text: 'WATCH TILL THE END! 🔥',
          duration: 2.5,
          fontSize: 56,
          color: '#FFE600',
          ...hook,
        };
      } else {
        draft.introHook = {
          ...draft.introHook,
          ...hook,
        };
      }
      return draft;
    }, false);
  },

  saveToServer: async () => {
    const { project } = get();
    if (!project) return;
    set({ isSaving: true });
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (res.ok) {
        set({ lastSavedAt: new Date().toLocaleTimeString() });
      }
    } catch (e) {
      console.error('Failed to auto-save project:', e);
    } finally {
      set({ isSaving: false });
    }
  },
}));
