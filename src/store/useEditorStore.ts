import { create } from 'zustand';
import { Project, AspectRatio, LayoutTemplateId, CropRect } from '@/lib/types';
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
  safeZoneVisible: boolean;

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
  setSelectedRegionId: (id: string | null) => void;
  setSelectedSubtitleId: (id: string | null) => void;
  setSelectedClipId: (id: string | null) => void;

  setCanvasAspectRatio: (ratio: AspectRatio) => void;
  setLayoutTemplate: (templateId: LayoutTemplateId) => void;
  setSplitRatio: (ratio: number) => void;
  updateRegionCrop: (regionId: string, crop: Partial<CropRect>) => void;
  zoomRegion: (regionId: string, zoomFactor: number) => void;
  resetRegionCrop: (regionId: string) => void;

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
  safeZoneVisible: true,

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
  setSelectedRegionId: (id) => set({ selectedRegionId: id }),
  setSelectedSubtitleId: (id) => set({ selectedSubtitleId: id }),
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  setCanvasAspectRatio: (ratio) => {
    const preset = CANVAS_PRESETS[ratio];
    if (!preset) return;
    get().updateProject((draft) => {
      draft.canvas = { ...preset };
      return draft;
    });
  },

  setLayoutTemplate: (templateId) => {
    get().updateProject((draft) => {
      draft.layout = getLayoutTemplate(templateId, draft.layout.splitRatio || 0.5);
      return draft;
    });
    const firstRegion = get().project?.layout.regions[0]?.id || null;
    set({ selectedRegionId: firstRegion });
  },

  setSplitRatio: (ratio) => {
    const clamped = Math.max(0.2, Math.min(0.8, ratio));
    get().updateProject((draft) => {
      draft.layout.splitRatio = clamped;
      if (draft.layout.regions.length >= 2) {
        draft.layout.regions[0].targetBounds.height = clamped;
        draft.layout.regions[1].targetBounds.y = clamped;
        draft.layout.regions[1].targetBounds.height = 1 - clamped;

        const canvasW = draft.canvas.width;
        const canvasH = draft.canvas.height;
        const srcW = draft.source.probe?.width || 1920;
        const srcH = draft.source.probe?.height || 1080;
        const srcAspect = srcW / srcH;

        // Automatically update crop aspect ratios to eliminate stretching
        for (let i = 0; i < 2; i++) {
          const reg = draft.layout.regions[i];
          const targetAspect = (canvasW * reg.targetBounds.width) / Math.max(1, canvasH * reg.targetBounds.height);
          const currentW = reg.crop.width;
          const centerX = reg.crop.x + currentW / 2;
          const centerY = reg.crop.y + reg.crop.height / 2;

          const newH = (currentW * srcAspect) / targetAspect;
          reg.crop.height = parseFloat(newH.toFixed(3));
          reg.crop.y = parseFloat((centerY - newH / 2).toFixed(3));
        }
      }
      return draft;
    });
  },

  updateRegionCrop: (regionId, cropUpdate) => {
    get().updateProject((draft) => {
      const region = draft.layout.regions.find((r) => r.id === regionId);
      if (region) {
        region.crop = {
          x: cropUpdate.x !== undefined ? Math.max(-2, Math.min(2, cropUpdate.x)) : region.crop.x,
          y: cropUpdate.y !== undefined ? Math.max(-2, Math.min(2, cropUpdate.y)) : region.crop.y,
          width: cropUpdate.width !== undefined ? Math.max(0.02, Math.min(3, cropUpdate.width)) : region.crop.width,
          height: cropUpdate.height !== undefined ? Math.max(0.02, Math.min(3, cropUpdate.height)) : region.crop.height,
        };
      }
      return draft;
    }, false); // don't flood undo history on continuous dragging
  },

  zoomRegion: (regionId, zoomFactor) => {
    get().updateProject((draft) => {
      const region = draft.layout.regions.find((r) => r.id === regionId);
      if (region) {
        const canvasW = draft.canvas.width;
        const canvasH = draft.canvas.height;
        const targetAspect = (canvasW * region.targetBounds.width) / Math.max(1, canvasH * region.targetBounds.height);
        const srcW = draft.source.probe?.width || 1920;
        const srcH = draft.source.probe?.height || 1080;
        const srcAspect = srcW / srcH;

        const currentW = region.crop.width;
        const newW = Math.max(0.05, Math.min(2.5, currentW / zoomFactor));
        const newH = (newW * srcAspect) / targetAspect;

        // Keep center anchored
        const centerX = region.crop.x + currentW / 2;
        const centerY = region.crop.y + region.crop.height / 2;
        region.crop = {
          x: parseFloat((centerX - newW / 2).toFixed(3)),
          y: parseFloat((centerY - newH / 2).toFixed(3)),
          width: parseFloat(newW.toFixed(3)),
          height: parseFloat(newH.toFixed(3)),
        };
      }
      return draft;
    }, false);
  },

  resetRegionCrop: (regionId) => {
    get().updateProject((draft) => {
      const region = draft.layout.regions.find((r) => r.id === regionId);
      if (region) {
        const canvasW = draft.canvas.width;
        const canvasH = draft.canvas.height;
        const targetAspect = (canvasW * region.targetBounds.width) / Math.max(1, canvasH * region.targetBounds.height);
        const srcW = draft.source.probe?.width || 1920;
        const srcH = draft.source.probe?.height || 1080;
        const srcAspect = srcW / srcH;

        let w = 1.0;
        let h = (w * srcAspect) / targetAspect;
        if (h > 1.0) {
          h = 1.0;
          w = (h * targetAspect) / srcAspect;
        }

        region.crop = {
          x: parseFloat(((1 - w) / 2).toFixed(3)),
          y: parseFloat(((1 - h) / 2).toFixed(3)),
          width: parseFloat(w.toFixed(3)),
          height: parseFloat(h.toFixed(3)),
        };
      }
      return draft;
    }, true);
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
