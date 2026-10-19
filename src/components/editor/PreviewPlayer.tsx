'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Move,
  GripHorizontal,
  PanelBottomClose,
  PanelBottomOpen,
  UploadCloud,
} from 'lucide-react';
import SafeZoneGuide from './SafeZoneGuide';
import { formatHookLines } from '@/lib/utils/hookText';

interface SnapGuideInfo {
  type: 'horizontal' | 'vertical';
  percent: number;
  label: string;
}

type DragState =
  | {
      mode: 'region';
      regionId: string;
      mouseX: number;
      mouseY: number;
      cropX: number;
      cropY: number;
      regionWidthPx: number;
      regionHeightPx: number;
      effectiveCropH: number;
      startAtTop: boolean;
      startAtBottom: boolean;
      startAtLeft: boolean;
      startAtRight: boolean;
      startAtCenterX: boolean;
      startAtCenterY: boolean;
      unlockedTop: boolean;
      unlockedBottom: boolean;
      unlockedLeft: boolean;
      unlockedRight: boolean;
    }
  | {
      mode: 'subtitle';
      mouseX: number;
      mouseY: number;
      initH: number;
      initV: number;
      startAtCenterH: boolean;
      unlockedCenterH: boolean;
    }
  | {
      mode: 'hook';
      mouseX: number;
      mouseY: number;
      initNormX: number;
      initNormY: number;
      containerWidth: number;
      containerHeight: number;
      startAtCenterH: boolean;
      unlockedCenterH: boolean;
    };

export default function PreviewPlayer() {
  const {
    project,
    currentTime,
    duration,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    selectedRegionId,
    setSelectedRegionId,
    selectedOverlayType,
    setSelectedOverlayType,
    selectedClipId,
    safeZoneVisible,
    isTimelineVisible,
    toggleTimeline,
    snappingEnabled,
    toggleSnapping,
    updateRegionCrop,
    zoomRegion,
    updateSubtitleStyle,
    updateIntroHook,
    setSecondaryMedia,
  } = useEditorStore();

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryImageRef = useRef<HTMLImageElement | null>(null);
  const secondaryFileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingSecondary, setIsUploadingSecondary] = useState(false);
  const [dragMode, setDragMode] = useState<'region' | 'subtitle' | 'hook' | null>(null);
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuideInfo[]>([]);
  const dragStartRef = useRef<DragState | null>(null);
  const isSelfUpdatingRef = useRef(false);
  const rafMoveRef = useRef<number | null>(null);

  const handleSecondaryUpload = async (file: File) => {
    if (!file || !project) return;
    setIsUploadingSecondary(true);
    try {
      const formData = new FormData();
      formData.append('projectId', project.id);
      formData.append('file', file);
      const res = await fetch('/api/media/upload-secondary', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to upload secondary media');
      }
      setSecondaryMedia(data.secondaryMediaPath, data.secondaryMediaType, data.secondaryMediaProbe);
    } catch (err) {
      console.error('Secondary media upload error:', err);
    } finally {
      setIsUploadingSecondary(false);
      if (secondaryFileInputRef.current) {
        secondaryFileInputRef.current.value = '';
      }
    }
  };

  const videoTrack = project?.tracks?.find((t) => t.type === 'video');
  const clips = videoTrack?.clips || [];
  const hasMultipleClips = clips.length > 1;

  // Real-time clip tracking during playback, selection priority when paused
  const playingClip = clips.find(
    (c) => currentTime >= c.start && currentTime < c.start + c.duration
  ) || clips[0];

  const activeClip = isPlaying
    ? playingClip
    : (selectedClipId ? clips.find((c) => c.id === selectedClipId) || playingClip : playingClip);

  const effectiveLayout = activeClip?.layoutOverride || project?.layout;

  const secondaryPath = effectiveLayout?.secondaryMediaPath || project?.layout?.secondaryMediaPath;
  const secondaryMediaType = effectiveLayout?.secondaryMediaType || project?.layout?.secondaryMediaType;
  const secondaryMediaProbe = effectiveLayout?.secondaryMediaProbe || project?.layout?.secondaryMediaProbe;

  const getMediaTimeFromTimeline = useCallback(
    (t: number) => {
      if (!videoTrack || !videoTrack.clips.length) return t;
      const clip = videoTrack.clips.find((c) => t >= c.start && t < c.start + c.duration) || videoTrack.clips[0];
      return clip.sourceStart + Math.max(0, t - clip.start);
    },
    [videoTrack]
  );

  const getTimelineTimeFromMedia = useCallback(
    (mediaT: number) => {
      if (!videoTrack || !videoTrack.clips.length) return mediaT;
      const clip = videoTrack.clips.find(
        (c) => mediaT >= c.sourceStart && mediaT <= c.sourceStart + c.duration
      ) || videoTrack.clips[0];
      return clip.start + Math.max(0, mediaT - clip.sourceStart);
    },
    [videoTrack]
  );

  if (!project || !effectiveLayout) return null;

  const videoSrc = `/api/media/serve?path=${encodeURIComponent(project.source.path)}`;
  const secondarySrc = secondaryPath
    ? `/api/media/serve?path=${encodeURIComponent(secondaryPath)}`
    : null;

  const canvasWidth = project.canvas.width;
  const canvasHeight = project.canvas.height;

  // Track dynamic container width for pixel-perfect 1:1 proportional font scaling matching exported 1080p ASS video
  const [containerWidth, setContainerWidth] = useState<number>(360);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 50) setContainerWidth(w);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const previewScale = (containerWidth || 360) / (canvasWidth || 1080);
  const canvasScale = (canvasWidth || 1080) / 1080;

  // 1:1 Synchronized subtitle sizing between preview and export
  const exportSubtitleFontSize = Math.round((project.subtitleStyle.fontSize || 54) * 2.25 * canvasScale);
  const previewSubtitleFontSize = Math.max(14, Math.round(exportSubtitleFontSize * previewScale));
  const exportSubtitleOutlineWidth = Math.max(2, Math.round((project.subtitleStyle.outlineWidth ?? 4) * 0.9 * canvasScale));
  const previewSubtitleOutlineWidth = Math.max(1, Math.round(exportSubtitleOutlineWidth * previewScale));

  // 1:1 Synchronized intro hook sizing between preview and export
  const exportHookFontSize = Math.round((project.introHook?.fontSize || 42) * 2.35 * canvasScale);
  const previewHookFontSize = Math.max(12, Math.round(exportHookFontSize * previewScale));
  const exportHookOutlineWidth = Math.max(2, Math.round((project.introHook?.outlineWidth ?? 4) * 0.9 * canvasScale));
  const previewHookOutlineWidth = Math.max(1, Math.round(exportHookOutlineWidth * previewScale));

  // 1. Play / Pause Synchronization
  useEffect(() => {
    const v1 = primaryVideoRef.current;
    const v2 = secondaryVideoRef.current;
    if (!v1) return;

    if (isPlaying) {
      v1.play().catch(() => {});
      if (v2) v2.play().catch(() => {});
    } else {
      v1.pause();
      if (v2) v2.pause();
    }
  }, [isPlaying]);

  // 2. High-Performance Canvas Rendering Loop (Single Video Decoding, 60 FPS)
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const video = primaryVideoRef.current;
      if (!canvas || !video) {
        animId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Fill canvas background
      ctx.fillStyle = '#06080D';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (video.readyState >= 2 && video.videoWidth > 0) {
        const vW = video.videoWidth;
        const vH = video.videoHeight;

        // Render blurred background if layout is blurred_background_fit
        if (effectiveLayout.templateId === 'blurred_background_fit') {
          ctx.save();
          ctx.filter = 'blur(28px) brightness(0.65)';
          // Draw video covering whole canvas
          const scale = Math.max(canvas.width / vW, canvas.height / vH);
          const bgW = vW * scale;
          const bgH = vH * scale;
          const bgX = (canvas.width - bgW) / 2;
          const bgY = (canvas.height - bgH) / 2;
          ctx.drawImage(video, bgX, bgY, bgW, bgH);
          ctx.restore();

          // Draw crisp centered video in foreground
          const targetW = canvas.width * 0.94;
          const targetH = targetW * (vH / vW);
          const fgX = (canvas.width - targetW) / 2;
          const fgY = (canvas.height - targetH) / 2;

          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 30;
          ctx.drawImage(video, fgX, fgY, targetW, targetH);
          ctx.restore();
        } else {
          // Render layout regions with effective layout (supporting per-clip splits & crops)
          for (const region of effectiveLayout.regions) {
            const bounds = region.targetBounds;
            const dx = bounds.x * canvas.width;
            const dy = bounds.y * canvas.height;
            const dw = bounds.width * canvas.width;
            const dh = bounds.height * canvas.height;

            ctx.save();

            // Clip rounded corners if region has borderRadius
            if (region.borderRadius && region.borderRadius > 0) {
              const r = region.borderRadius * (canvas.width / 400);
              ctx.beginPath();
              ctx.roundRect(dx, dy, dw, dh, r);
              ctx.clip();
            }

            // Fill base region background with dark card color
            ctx.fillStyle = '#090D16';
            ctx.fillRect(dx, dy, dw, dh);

            if (region.sourceType === 'secondary_media') {
              let sourceElement: CanvasImageSource | null = null;
              let sW = 1920;
              let sH = 1080;

              if (
                secondaryVideoRef.current &&
                (secondaryMediaType === 'video' || !secondaryMediaType)
              ) {
                const v2 = secondaryVideoRef.current;
                if (v2.readyState >= 2 && v2.videoWidth > 0) {
                  sourceElement = v2;
                  sW = v2.videoWidth;
                  sH = v2.videoHeight;
                }
              } else if (
                secondaryImageRef.current &&
                (secondaryMediaType === 'image' || secondaryMediaType === 'gif')
              ) {
                const img = secondaryImageRef.current;
                if (img.complete && img.naturalWidth > 0) {
                  sourceElement = img;
                  sW = img.naturalWidth;
                  sH = img.naturalHeight;
                }
              }

              if (sourceElement) {
                // Secondary media cropped, zoomed, and positioned with LOCKED aspect ratio (ZERO STRETCHING)
                const targetAspect = dw / dh;
                const crop = region.crop || { x: 0, y: 0, width: 1, height: 1 };
                const sw = Math.max(10, crop.width * sW);
                const sh = sw / targetAspect;
                const sx = crop.x * sW;
                const sy = crop.y * sH;

                const visibleSx = Math.max(0, Math.min(sW, sx));
                const visibleSy = Math.max(0, Math.min(sH, sy));
                const visibleEx = Math.max(0, Math.min(sW, sx + sw));
                const visibleEy = Math.max(0, Math.min(sH, sy + sh));
                const visibleSw = visibleEx - visibleSx;
                const visibleSh = visibleEy - visibleSy;

                if (visibleSw > 0 && visibleSh > 0 && sw > 0 && sh > 0) {
                  const scale = dw / sw;
                  const renderDx = dx + (visibleSx - sx) * scale;
                  const renderDy = dy + (visibleSy - sy) * scale;
                  const renderDw = visibleSw * scale;
                  const renderDh = visibleSh * scale;

                  ctx.drawImage(sourceElement, visibleSx, visibleSy, visibleSw, visibleSh, renderDx, renderDy, renderDw, renderDh);
                }
              } else if (!secondaryPath) {
                ctx.save();
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 8]);
                ctx.strokeRect(dx + 16, dy + 16, dw - 32, dh - 32);

                ctx.fillStyle = 'rgba(241, 245, 249, 0.9)';
                ctx.font = 'bold 24px Montserrat, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('📁 Secondary Media Slot', dx + dw / 2, dy + dh / 2 - 16);

                ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
                ctx.font = '15px Montserrat, sans-serif';
                ctx.fillText('Click or drop media to attach', dx + dw / 2, dy + dh / 2 + 16);
                ctx.restore();
              }
            } else {
              // Primary video cropped and scaled with locked aspect ratio (ZERO STRETCHING)
              const targetAspect = dw / dh;
              const crop = region.crop;
              const sw = Math.max(10, crop.width * vW);
              // Strictly lock source crop aspect ratio to target bounds aspect ratio
              const sh = sw / targetAspect;
              const sx = crop.x * vW;
              const sy = crop.y * vH;

              // Calculate visible intersection with source video
              const visibleSx = Math.max(0, Math.min(vW, sx));
              const visibleSy = Math.max(0, Math.min(vH, sy));
              const visibleEx = Math.max(0, Math.min(vW, sx + sw));
              const visibleEy = Math.max(0, Math.min(vH, sy + sh));
              const visibleSw = visibleEx - visibleSx;
              const visibleSh = visibleEy - visibleSy;

              if (visibleSw > 0 && visibleSh > 0 && sw > 0 && sh > 0) {
                // Uniform scale factor: scaleX === scaleY strictly
                const scale = dw / sw;
                const renderDx = dx + (visibleSx - sx) * scale;
                const renderDy = dy + (visibleSy - sy) * scale;
                const renderDw = visibleSw * scale;
                const renderDh = visibleSh * scale;

                ctx.drawImage(video, visibleSx, visibleSy, visibleSw, visibleSh, renderDx, renderDy, renderDw, renderDh);
              }
            }

            // Region border if specified
            if (region.borderWidth && region.borderWidth > 0 && region.borderColor) {
              ctx.strokeStyle = region.borderColor;
              ctx.lineWidth = region.borderWidth * (canvas.width / 400);
              ctx.strokeRect(dx, dy, dw, dh);
            }

            // Highlight border for currently selected region
            if (region.id === selectedRegionId && !selectedOverlayType) {
              ctx.strokeStyle = '#3B82F6';
              ctx.lineWidth = 4;
              ctx.setLineDash([8, 6]);
              ctx.strokeRect(dx + 2, dy + 2, dw - 4, dh - 4);
              ctx.setLineDash([]);
            }

            ctx.restore();
          }

          // Render divider line for split layouts
          if (effectiveLayout.dividerWidth > 0 && effectiveLayout.regions.length >= 2) {
            const divY = (effectiveLayout.splitRatio || 0.5) * canvas.height;
            const divH = Math.max(2, Math.round(effectiveLayout.dividerWidth * 2 * (canvas.height / 1920)));
            ctx.fillStyle = effectiveLayout.dividerColor || '#3B82F6';
            ctx.fillRect(0, divY - divH / 2, canvas.width, divH);
          }
        }
      }

      // High-precision 60 FPS playhead tracking during playback
      if (isPlaying && video && !video.paused) {
        const curMedia = video.currentTime;
        const curTimeline = getTimelineTimeFromMedia(curMedia);

        if (curTimeline >= duration) {
          video.pause();
          setIsPlaying(false);
          const startMedia = getMediaTimeFromTimeline(0);
          video.currentTime = startMedia;
          setCurrentTime(0);
        } else {
          // If split clips have a non-contiguous jump, jump video.currentTime
          if (activeClip && curMedia >= activeClip.sourceStart + activeClip.duration) {
            const nextClip = videoTrack?.clips?.find((c) => c.start >= activeClip.start + activeClip.duration);
            if (nextClip) {
              video.currentTime = nextClip.sourceStart;
            }
          }
          isSelfUpdatingRef.current = true;
          setCurrentTime(curTimeline);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    project,
    effectiveLayout,
    selectedRegionId,
    selectedOverlayType,
    isPlaying,
    activeClip,
    duration,
    getMediaTimeFromTimeline,
    getTimelineTimeFromMedia,
    setIsPlaying,
    setCurrentTime,
    videoTrack,
  ]);

  // Sync initial video position to timeline start
  useEffect(() => {
    const v1 = primaryVideoRef.current;
    if (v1 && !isPlaying) {
      const target = getMediaTimeFromTimeline(0);
      if (Math.abs(v1.currentTime - target) > 0.05) {
        v1.currentTime = target;
      }
    }
  }, [project?.id, getMediaTimeFromTimeline]);

  // Direct video playhead seek synchronization when currentTime changes (timeline click/scrub)
  useEffect(() => {
    const v1 = primaryVideoRef.current;
    if (!v1 || isDragging) return;

    if (isSelfUpdatingRef.current) {
      isSelfUpdatingRef.current = false;
      return;
    }

    const targetMediaTime = getMediaTimeFromTimeline(currentTime);
    if (Math.abs(v1.currentTime - targetMediaTime) > 0.05) {
      v1.currentTime = targetMediaTime;
    }
    if (secondaryVideoRef.current) {
      secondaryVideoRef.current.currentTime = currentTime;
    }
  }, [currentTime, getMediaTimeFromTimeline, isDragging]);

  // 3. Playhead Seeking and Throttled Time Updates
  const handleTimeUpdate = () => {
    const v1 = primaryVideoRef.current;
    if (v1 && !isDragging && !isPlaying) {
      const curTimeline = getTimelineTimeFromMedia(v1.currentTime);
      setCurrentTime(curTimeline);
    }
  };

  const handleSeek = (newTime: number) => {
    const v1 = primaryVideoRef.current;
    const v2 = secondaryVideoRef.current;
    const targetMedia = getMediaTimeFromTimeline(newTime);
    if (v1) {
      v1.currentTime = targetMedia;
    }
    if (v2) {
      v2.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const stepFrame = (frames: number) => {
    const fps = project.source.probe?.fps || 30;
    const delta = frames / fps;
    handleSeek(Math.max(0, Math.min(duration, currentTime + delta)));
  };

  // 4. Interactive Canvas Region Dragging with Smart Barrier Snapping
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickXNorm = (e.clientX - rect.left) / rect.width;
    const clickYNorm = (e.clientY - rect.top) / rect.height;

    // Find region under cursor in effective layout
    const clickedRegion = effectiveLayout.regions.find((r) => {
      const b = r.targetBounds;
      return (
        clickXNorm >= b.x &&
        clickXNorm <= b.x + b.width &&
        clickYNorm >= b.y &&
        clickYNorm <= b.y + b.height
      );
    });

    if (clickedRegion) {
      setSelectedRegionId(clickedRegion.id);
      setSelectedOverlayType(null);

      // If clicked region is secondary_media slot and no media is uploaded yet
      if (clickedRegion.sourceType === 'secondary_media' && !secondaryPath) {
        secondaryFileInputRef.current?.click();
        return;
      }

      setIsDragging(true);
      setDragMode('region');

      const isSec = clickedRegion.sourceType === 'secondary_media';
      const secW =
        secondaryVideoRef.current?.videoWidth ||
        secondaryImageRef.current?.naturalWidth ||
        secondaryMediaProbe?.width ||
        1920;
      const secH =
        secondaryVideoRef.current?.videoHeight ||
        secondaryImageRef.current?.naturalHeight ||
        secondaryMediaProbe?.height ||
        1080;
      const vW = isSec ? secW : (primaryVideoRef.current?.videoWidth || 1920);
      const vH = isSec ? secH : (primaryVideoRef.current?.videoHeight || 1080);
      const regionWidthPx = rect.width * clickedRegion.targetBounds.width;
      const regionHeightPx = rect.height * clickedRegion.targetBounds.height;
      const targetAspect = regionWidthPx / Math.max(1, regionHeightPx);
      const effectiveCropH = (clickedRegion.crop.width * (vW / vH)) / targetAspect;

      // Detect if user starts the drag already sitting at or past a barrier:
      // If they start on the barrier, "if i do it again it then should go past the barrier" takes effect!
      const isAtTop = Math.abs(clickedRegion.crop.y - 0) < 0.006 || clickedRegion.crop.y < 0;
      const bottomBarrier = 1 - effectiveCropH;
      const isAtBottom = Math.abs(clickedRegion.crop.y - bottomBarrier) < 0.006 || clickedRegion.crop.y > bottomBarrier;
      const isAtLeft = Math.abs(clickedRegion.crop.x - 0) < 0.006 || clickedRegion.crop.x < 0;
      const rightBarrier = 1 - clickedRegion.crop.width;
      const isAtRight = Math.abs(clickedRegion.crop.x - rightBarrier) < 0.006 || clickedRegion.crop.x > rightBarrier;
      const centerBarrierX = (1 - clickedRegion.crop.width) / 2;
      const isAtCenterX = Math.abs(clickedRegion.crop.x - centerBarrierX) < 0.006;
      const centerBarrierY = (1 - effectiveCropH) / 2;
      const isAtCenterY = Math.abs(clickedRegion.crop.y - centerBarrierY) < 0.006;

      dragStartRef.current = {
        mode: 'region',
        regionId: clickedRegion.id,
        mouseX: e.clientX,
        mouseY: e.clientY,
        cropX: clickedRegion.crop.x,
        cropY: clickedRegion.crop.y,
        regionWidthPx,
        regionHeightPx,
        effectiveCropH,
        startAtTop: isAtTop,
        startAtBottom: isAtBottom,
        startAtLeft: isAtLeft,
        startAtRight: isAtRight,
        startAtCenterX: isAtCenterX,
        startAtCenterY: isAtCenterY,
        unlockedTop: false,
        unlockedBottom: false,
        unlockedLeft: false,
        unlockedRight: false,
      };
    } else {
      setSelectedOverlayType(null);
    }
  };

  // 5. Interactive Subtitle Dragging with Center Magnetic Snap
  const handleSubtitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOverlayType('subtitle');
    setIsDragging(true);
    setDragMode('subtitle');
    const initH = project.subtitleStyle.horizontalOffset || 0;
    const isAtCenterH = Math.abs(initH) <= 3;
    dragStartRef.current = {
      mode: 'subtitle',
      mouseX: e.clientX,
      mouseY: e.clientY,
      initH,
      initV: project.subtitleStyle.verticalOffset || 0,
      startAtCenterH: isAtCenterH,
      unlockedCenterH: false,
    };
  };

  // 6. Interactive Intro Hook Dragging with Center Magnetic Snap
  const handleHookMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOverlayType('hook');
    setIsDragging(true);
    setDragMode('hook');
    const container = containerRef.current;
    const rect = container ? container.getBoundingClientRect() : { width: 400, height: 700 };
    const initNormX = project.introHook?.positionX ?? 0.5;
    const isAtCenterH = Math.abs(initNormX - 0.5) <= 0.01;
    dragStartRef.current = {
      mode: 'hook',
      mouseX: e.clientX,
      mouseY: e.clientY,
      initNormX,
      initNormY: project.introHook?.positionY ?? 0.22,
      containerWidth: rect.width,
      containerHeight: rect.height,
      startAtCenterH: isAtCenterH,
      unlockedCenterH: false,
    };
  };

  // Unified MouseMove handler with RAF throttling, soft snapping, and effectiveLayout
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const shiftKey = e.shiftKey;

    if (rafMoveRef.current) return;
    rafMoveRef.current = requestAnimationFrame(() => {
      rafMoveRef.current = null;
      if (!dragStartRef.current) return;
      const drag = dragStartRef.current;
      const isSnapping = snappingEnabled && !shiftKey;

      if (drag.mode === 'subtitle') {
        const deltaX = clientX - drag.mouseX;
        const deltaY = clientY - drag.mouseY;
        const vDir = project.subtitleStyle.position === 'top' ? 1 : -1;
        let rawH = drag.initH + deltaX;
        let rawV = drag.initV + deltaY * vDir;

        const guides: SnapGuideInfo[] = [];

        if (isSnapping) {
          // Soft Horizontal Center Magnet
          if (drag.startAtCenterH) {
            if (Math.abs(rawH) > 12) drag.startAtCenterH = false;
          } else if (!drag.unlockedCenterH && Math.abs(rawH) <= 8) {
            rawH = 0;
            guides.push({
              type: 'vertical',
              percent: 50,
              label: 'Captions Centered',
            });
          } else if (Math.abs(rawH) > 20) {
            drag.unlockedCenterH = true;
          }

          if (Math.abs(rawV) <= 6) {
            rawV = 0;
          }
        }

        setActiveSnapGuides(guides);
        updateSubtitleStyle({
          horizontalOffset: Math.max(-150, Math.min(150, Math.round(rawH))),
          verticalOffset: Math.max(-150, Math.min(150, Math.round(rawV))),
        });
        return;
      }

      if (drag.mode === 'hook') {
        const deltaX = clientX - drag.mouseX;
        const deltaY = clientY - drag.mouseY;
        const cW = drag.containerWidth || 400;
        const cH = drag.containerHeight || 700;
        let rawX = drag.initNormX + deltaX / cW;
        let rawY = drag.initNormY + deltaY / cH;

        const guides: SnapGuideInfo[] = [];

        if (isSnapping) {
          if (drag.startAtCenterH) {
            if (Math.abs(rawX - 0.5) > 0.04) drag.startAtCenterH = false;
          } else if (!drag.unlockedCenterH && Math.abs(rawX - 0.5) <= 0.025) {
            rawX = 0.5;
            guides.push({
              type: 'vertical',
              percent: 50,
              label: 'Hook Centered',
            });
          } else if (Math.abs(rawX - 0.5) > 0.06) {
            drag.unlockedCenterH = true;
          }

          if (Math.abs(rawY - 0.22) <= 0.02) {
            rawY = 0.22;
            guides.push({
              type: 'horizontal',
              percent: 22,
              label: 'Top Safe Zone Guide',
            });
          }
        }

        setActiveSnapGuides(guides);
        updateIntroHook({
          positionX: parseFloat(Math.max(0.08, Math.min(0.92, rawX)).toFixed(3)),
          positionY: parseFloat(Math.max(0.06, Math.min(0.94, rawY)).toFixed(3)),
        });
        return;
      }

      if (drag.mode === 'region') {
        const deltaPxX = clientX - drag.mouseX;
        const deltaPxY = clientY - drag.mouseY;

        const currentRegion = effectiveLayout.regions.find((r) => r.id === drag.regionId);
        if (!currentRegion) return;

      const isSec = currentRegion.sourceType === 'secondary_media';
      const secW =
        secondaryVideoRef.current?.videoWidth ||
        secondaryImageRef.current?.naturalWidth ||
        secondaryMediaProbe?.width ||
        1920;
      const secH =
        secondaryVideoRef.current?.videoHeight ||
        secondaryImageRef.current?.naturalHeight ||
        secondaryMediaProbe?.height ||
        1080;
      const vW = isSec ? secW : (primaryVideoRef.current?.videoWidth || 1920);
      const vH = isSec ? secH : (primaryVideoRef.current?.videoHeight || 1080);
      const targetAspect = drag.regionWidthPx / Math.max(1, drag.regionHeightPx);
      const effectiveCropHNorm = (currentRegion.crop.width * (vW / vH)) / targetAspect;

      const cropFactorX = currentRegion.crop.width / Math.max(1, drag.regionWidthPx);
      const cropFactorY = effectiveCropHNorm / Math.max(1, drag.regionHeightPx);

      // Raw target crop coordinates based directly on mouse movement
      const rawCropX = drag.cropX - deltaPxX * cropFactorX;
      const rawCropY = drag.cropY - deltaPxY * cropFactorY;

      let newCropX = rawCropX;
      let newCropY = rawCropY;
      const guides: SnapGuideInfo[] = [];

      if (isSnapping) {
        // Snap zone in normalized crop coordinates (~25-35px screen distance)
        const SNAP_ZONE = 0.038;
        // Breakaway pull threshold for continuous single drag
        const BREAKAWAY = 0.075;

        // --- Y AXIS BARRIER SNAPPING ---
        const bottomBarrier = 1.0 - effectiveCropHNorm;
        const centerBarrierY = (1.0 - effectiveCropHNorm) / 2;

        // 1. Top Barrier (y = 0)
        if (drag.startAtTop) {
          // USER STARTED DRAG AT TOP BARRIER:
          // "if i do it again it then should go past the barrier" -> PASS THROUGH FREELY!
          if (rawCropY > SNAP_ZONE * 1.5) {
            // If they pulled downwards back inside the video, re-arm snapping
            drag.startAtTop = false;
          }
          newCropY = rawCropY;
        } else if (!drag.unlockedTop && rawCropY <= SNAP_ZONE && rawCropY >= -BREAKAWAY) {
          // Snapping tightly to top barrier!
          newCropY = 0;
          guides.push({
            type: 'horizontal',
            percent: currentRegion.targetBounds.y * 100,
            label: 'Top Barrier (Snapped)',
          });
        } else if (rawCropY < -BREAKAWAY) {
          // User pulled strongly past barrier in single continuous drag
          drag.unlockedTop = true;
          newCropY = rawCropY + BREAKAWAY;
        } else if (!drag.startAtCenterY && Math.abs(rawCropY - centerBarrierY) <= SNAP_ZONE * 0.75) {
          // Center Y Alignment
          newCropY = centerBarrierY;
          guides.push({
            type: 'horizontal',
            percent: (currentRegion.targetBounds.y + currentRegion.targetBounds.height / 2) * 100,
            label: 'Center Y (Snapped)',
          });
        } else if (drag.startAtBottom) {
          // Started at bottom barrier -> pass through
          if (rawCropY < bottomBarrier - SNAP_ZONE * 1.5) {
            drag.startAtBottom = false;
          }
          newCropY = rawCropY;
        } else if (
          !drag.unlockedBottom &&
          (Math.abs(rawCropY - bottomBarrier) <= SNAP_ZONE ||
            (rawCropY > bottomBarrier && rawCropY <= bottomBarrier + BREAKAWAY))
        ) {
          // Snapping tightly to bottom barrier!
          newCropY = bottomBarrier;
          guides.push({
            type: 'horizontal',
            percent: (currentRegion.targetBounds.y + currentRegion.targetBounds.height) * 100,
            label: 'Bottom Barrier (Snapped)',
          });
        } else if (rawCropY > bottomBarrier + BREAKAWAY) {
          drag.unlockedBottom = true;
          newCropY = rawCropY - BREAKAWAY;
        }

        // --- X AXIS BARRIER SNAPPING ---
        const rightBarrier = 1.0 - currentRegion.crop.width;
        const centerBarrierX = (1.0 - currentRegion.crop.width) / 2;

        // 2. Left Barrier (x = 0)
        if (drag.startAtLeft) {
          if (rawCropX > SNAP_ZONE * 1.5) {
            drag.startAtLeft = false;
          }
          newCropX = rawCropX;
        } else if (!drag.unlockedLeft && rawCropX <= SNAP_ZONE && rawCropX >= -BREAKAWAY) {
          newCropX = 0;
          guides.push({
            type: 'vertical',
            percent: currentRegion.targetBounds.x * 100,
            label: 'Left Barrier (Snapped)',
          });
        } else if (rawCropX < -BREAKAWAY) {
          drag.unlockedLeft = true;
          newCropX = rawCropX + BREAKAWAY;
        } else if (!drag.startAtCenterX && Math.abs(rawCropX - centerBarrierX) <= SNAP_ZONE * 0.75) {
          // Center X Alignment
          newCropX = centerBarrierX;
          guides.push({
            type: 'vertical',
            percent: (currentRegion.targetBounds.x + currentRegion.targetBounds.width / 2) * 100,
            label: 'Center X (Snapped)',
          });
        } else if (drag.startAtRight) {
          if (rawCropX < rightBarrier - SNAP_ZONE * 1.5) {
            drag.startAtRight = false;
          }
          newCropX = rawCropX;
        } else if (
          !drag.unlockedRight &&
          (Math.abs(rawCropX - rightBarrier) <= SNAP_ZONE ||
            (rawCropX > rightBarrier && rawCropX <= rightBarrier + BREAKAWAY))
        ) {
          // Snapping tightly to right barrier!
          newCropX = rightBarrier;
          guides.push({
            type: 'vertical',
            percent: (currentRegion.targetBounds.x + currentRegion.targetBounds.width) * 100,
            label: 'Right Barrier (Snapped)',
          });
        } else if (rawCropX > rightBarrier + BREAKAWAY) {
          drag.unlockedRight = true;
          newCropX = rawCropX - BREAKAWAY;
        }
      }

      setActiveSnapGuides(guides);

      updateRegionCrop(drag.regionId, {
        x: parseFloat(newCropX.toFixed(3)),
        y: parseFloat(newCropY.toFixed(3)),
      });
    }
    });
  };

  const handleMouseUp = () => {
    if (rafMoveRef.current) {
      cancelAnimationFrame(rafMoveRef.current);
      rafMoveRef.current = null;
    }
    setActiveSnapGuides([]);
    setIsDragging(false);
    setDragMode(null);
    dragStartRef.current = null;
  };

  // Mouse wheel zooms region in/out
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cursorXNorm = (e.clientX - rect.left) / rect.width;
    const cursorYNorm = (e.clientY - rect.top) / rect.height;

    const targetRegion =
      effectiveLayout.regions.find((r) => {
        const b = r.targetBounds;
        return (
          cursorXNorm >= b.x &&
          cursorXNorm <= b.x + b.width &&
          cursorYNorm >= b.y &&
          cursorYNorm <= b.y + b.height
        );
      }) ||
      effectiveLayout.regions.find((r) => r.id === selectedRegionId) ||
      effectiveLayout.regions[0];

    if (!targetRegion) return;

    if (selectedRegionId !== targetRegion.id) {
      setSelectedRegionId(targetRegion.id);
    }

    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoomRegion(targetRegion.id, factor);
  };

  // Active Subtitle for current playhead
  const activeSubtitle = project.subtitles.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // Helper for Intro Hook Transition Classes (Entrance & Exit)
  const getHookTransitionClass = (transition?: string, isLeaving = false) => {
    const t = transition || 'bounce_drop';
    if (t === 'static') {
      return isLeaving ? 'anim-hook-exit-static' : 'anim-hook-static';
    }
    return isLeaving ? `anim-hook-exit-${t}` : `anim-hook-${t}`;
  };

  // Helper for rendering Intro Hook Headline with optional highlight punch, emoji isolation, and multi-line control
  const renderHookText = (
    text: string,
    defaultColor: string,
    highlightColor?: string,
    wordsPerLine?: number
  ) => {
    const lines = formatHookLines(text, wordsPerLine);
    const EMOJI_REGEX = /(\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic})*[\uFE0E\uFE0F]?)/u;
    const IS_EMOJI = /^\p{Extended_Pictographic}/u;

    const renderTextAndEmojis = (str: string, color: string, keyPrefix: string) => {
      const parts = str.split(EMOJI_REGEX);
      return parts.map((part, i) => {
        if (!part) return null;
        if (IS_EMOJI.test(part)) {
          return (
            <span
              key={`${keyPrefix}-emoji-${i}`}
              style={{
                display: 'inline-block',
                WebkitTextStroke: '0px transparent',
                textShadow: 'none',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))',
                fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
                textTransform: 'none',
                verticalAlign: 'baseline',
                margin: '0 0.12em',
              }}
            >
              {part}
            </span>
          );
        }
        return (
          <span key={`${keyPrefix}-txt-${i}`} style={{ color }}>
            {part}
          </span>
        );
      });
    };

    return lines.map((line, lineIdx) => {
      let content: React.ReactNode = null;
      if (highlightColor && highlightColor !== defaultColor && line.includes('*')) {
        const parts = line.split('*');
        content = parts.map((part, i) => (
          <React.Fragment key={i}>
            {renderTextAndEmojis(part, i % 2 === 1 ? highlightColor : defaultColor, `part-${i}`)}
          </React.Fragment>
        ));
      } else if (highlightColor && highlightColor !== defaultColor && !text.includes('*') && lineIdx === 0) {
        const words = line.split(' ');
        if (words.length > 1) {
          content = (
            <>
              {renderTextAndEmojis(words[0] + ' ', highlightColor, 'first-w')}
              {renderTextAndEmojis(words.slice(1).join(' '), defaultColor, 'rest-w')}
            </>
          );
        } else {
          content = renderTextAndEmojis(line, defaultColor, `l-${lineIdx}`);
        }
      } else {
        content = renderTextAndEmojis(line, defaultColor, `l-${lineIdx}`);
      }

      return (
        <div
          key={lineIdx}
          style={{
            whiteSpace: wordsPerLine === -1 ? 'nowrap' : 'normal',
            lineHeight: 1.15,
          }}
        >
          {content}
        </div>
      );
    });
  };

  const dynamicMaxHeight = isTimelineVisible ? 'max-h-[68vh]' : 'max-h-[86vh]';

  const ratioClasses: Record<string, string> = {
    '9:16': `aspect-[9/16] ${dynamicMaxHeight}`,
    '1:1': `aspect-square ${dynamicMaxHeight}`,
    '16:9': `aspect-video max-w-4xl ${dynamicMaxHeight}`,
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-3 sm:p-4 bg-slate-950/60 select-none overflow-hidden transition-all duration-300">
      {/* Video Canvas Container */}
      <div className="flex-1 flex items-center justify-center w-full relative">
        <div
          ref={containerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleSecondaryUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 ${
            ratioClasses[project.canvas.aspectRatio] || `aspect-[9/16] ${dynamicMaxHeight}`
          } w-auto h-full flex flex-col cursor-grab active:cursor-grabbing transition-all duration-300`}
        >
          {/* Master Video (Single hardware-accelerated decode stream) */}
          <video
            ref={primaryVideoRef}
            src={videoSrc}
            playsInline
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          {/* Secondary media video (if any) */}
          {secondarySrc && (secondaryMediaType === 'video' || !secondaryMediaType) && (
            <video
              ref={secondaryVideoRef}
              src={secondarySrc}
              muted
              loop
              playsInline
              className="hidden"
            />
          )}

          {/* Secondary media image / GIF (if any) */}
          {secondarySrc && (secondaryMediaType === 'image' || secondaryMediaType === 'gif') && (
            <img
              ref={secondaryImageRef}
              src={secondarySrc}
              alt="Secondary Media"
              className="hidden"
            />
          )}

          {/* Hidden File Input for quick preview upload */}
          <input
            ref={secondaryFileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska,image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleSecondaryUpload(e.target.files[0]);
            }}
          />

          {/* High-Performance Hardware-Accelerated 60 FPS Canvas */}
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Region Label Indicators & Interactive Secondary Media Drop/Upload Box */}
          <div className="absolute inset-0 pointer-events-none">
            {effectiveLayout.regions.map((region) => (
              <React.Fragment key={region.id}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${region.targetBounds.x * 100}%`,
                    top: `${region.targetBounds.y * 100}%`,
                  }}
                  className="m-2.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur border border-white/10 text-[10px] text-white/90 font-medium flex items-center gap-1.5 shadow"
                >
                  <span>{region.label}</span>
                  {region.id === selectedRegionId && !selectedOverlayType && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </div>

                {/* If secondary media slot is empty, show interactive upload button right in the preview */}
                {region.sourceType === 'secondary_media' && !secondaryPath && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${region.targetBounds.x * 100}%`,
                      top: `${region.targetBounds.y * 100}%`,
                      width: `${region.targetBounds.width * 100}%`,
                      height: `${region.targetBounds.height * 100}%`,
                    }}
                    className="flex flex-col items-center justify-center p-4 pointer-events-auto"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRegionId(region.id);
                        secondaryFileInputRef.current?.click();
                      }}
                      disabled={isUploadingSecondary}
                      className="px-4 py-2.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white font-semibold text-xs shadow-xl shadow-blue-600/30 backdrop-blur border border-blue-400/30 flex items-center gap-2 transition hover:scale-105 active:scale-95 group cursor-pointer"
                    >
                      {isUploadingSecondary ? (
                        <>
                          <RotateCcw className="w-4 h-4 animate-spin" />
                          <span>Uploading Media...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                          <span>Upload Media (Video / GIF / Image)</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-slate-400 mt-2 bg-black/60 px-2.5 py-1 rounded backdrop-blur">
                      or drag & drop file anywhere here
                    </span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Magnetic Snap Guidelines */}
          {activeSnapGuides.map((guide, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                ...(guide.type === 'horizontal'
                  ? {
                      top: `${Math.max(0, Math.min(100, guide.percent))}%`,
                      left: 0,
                      right: 0,
                      height: '2px',
                    }
                  : {
                      left: `${Math.max(0, Math.min(100, guide.percent))}%`,
                      top: 0,
                      bottom: 0,
                      width: '2px',
                    }),
              }}
              className="z-40 pointer-events-none bg-cyan-400 shadow-[0_0_10px_#00F0FF,0_0_20px_#00F0FF] flex items-center justify-center animate-pulse"
            >
              <div
                className={`px-2 py-0.5 rounded-full bg-slate-950/95 border border-cyan-400 text-cyan-300 font-bold text-[10px] shadow-2xl tracking-wider uppercase flex items-center gap-1 ${
                  guide.type === 'horizontal' ? '-translate-y-3.5' : '-translate-x-3.5'
                }`}
              >
                <span className="text-xs">🧲</span>
                <span>{guide.label}</span>
              </div>
            </div>
          ))}

          {/* Active Dragging Feedback Banners */}
          {isDragging && dragMode === 'region' && (
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-40">
              <span
                className={`px-3 py-1 rounded-full font-bold text-xs shadow-lg backdrop-blur flex items-center gap-1.5 animate-in fade-in ${
                  activeSnapGuides.length > 0
                    ? 'bg-cyan-600/95 text-white ring-2 ring-cyan-300 shadow-cyan-500/30'
                    : 'bg-blue-600/90 text-white'
                }`}
              >
                {activeSnapGuides.length > 0 ? (
                  <>
                    <span>🧲</span>
                    <span>{activeSnapGuides[0].label} (Drag again to go past)</span>
                  </>
                ) : (
                  <>
                    <Move className="w-3.5 h-3.5" />
                    <span>Panning Region...</span>
                  </>
                )}
              </span>
            </div>
          )}

          {isDragging && dragMode === 'subtitle' && (
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-40">
              <span
                className={`px-3 py-1 rounded-full font-bold text-xs shadow-lg backdrop-blur flex items-center gap-1.5 animate-in fade-in ${
                  activeSnapGuides.length > 0
                    ? 'bg-cyan-600/95 text-white ring-2 ring-cyan-300'
                    : 'bg-cyan-600/90 text-white'
                }`}
              >
                {activeSnapGuides.length > 0 ? (
                  <>
                    <span>🧲</span>
                    <span>{activeSnapGuides[0].label}</span>
                  </>
                ) : (
                  <>
                    <Move className="w-3.5 h-3.5" />
                    <span>
                      Captions ({project.subtitleStyle.horizontalOffset || 0}px,{' '}
                      {project.subtitleStyle.verticalOffset || 0}px)
                    </span>
                  </>
                )}
              </span>
            </div>
          )}

          {isDragging && dragMode === 'hook' && (
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-40">
              <span
                className={`px-3 py-1 rounded-full font-bold text-xs shadow-lg backdrop-blur flex items-center gap-1.5 animate-in fade-in ${
                  activeSnapGuides.length > 0
                    ? 'bg-amber-600/95 text-white ring-2 ring-amber-300'
                    : 'bg-amber-600/90 text-white'
                }`}
              >
                {activeSnapGuides.length > 0 ? (
                  <>
                    <span>🧲</span>
                    <span>{activeSnapGuides[0].label}</span>
                  </>
                ) : (
                  <>
                    <Move className="w-3.5 h-3.5" />
                    <span>
                      Hook ({Math.round((project.introHook?.positionX ?? 0.5) * 100)}%,{' '}
                      {Math.round((project.introHook?.positionY ?? 0.22) * 100)}%)
                    </span>
                  </>
                )}
              </span>
            </div>
          )}

          {/* Intro Hook Text with Direct Dragging & Entrance/Exit Transitions */}
          {project.introHook?.enabled && (() => {
            const projectDur = videoTrack?.clips?.reduce((acc, c) => acc + c.duration, 0) || project.source.probe?.duration || 30;
            const hookDur = project.introHook.stayWholeVideo ? projectDur : (project.introHook.duration || 2.5);
            if (currentTime > hookDur) return null;
            const isLeaving = !project.introHook.stayWholeVideo && currentTime >= hookDur - (project.introHook.transition === 'static' ? 0.2 : 0.38);
            return (
              <div
                key={isLeaving ? 'hook-exit' : 'hook-enter'}
                onMouseDown={handleHookMouseDown}
                style={{
                  position: 'absolute',
                  left: `${(project.introHook.positionX ?? 0.5) * 100}%`,
                  top: `${(project.introHook.positionY ?? 0.22) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`z-30 select-none cursor-move group transition-all duration-75 ${
                  project.introHook.wordsPerLine === -1 ? 'max-w-none' : 'max-w-[95%]'
                } ${
                  selectedOverlayType === 'hook'
                    ? 'ring-2 ring-amber-400 ring-dashed rounded-2xl bg-amber-950/20 shadow-xl'
                    : 'hover:ring-1 hover:ring-amber-400/60 rounded-2xl'
                } ${getHookTransitionClass(project.introHook.transition, isLeaving)}`}
              >
                {/* Drag Handle Badge */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="px-2 py-0.5 rounded-md bg-amber-950/90 border border-amber-500/50 text-[10px] text-amber-300 font-bold tracking-wider uppercase flex items-center gap-1 shadow-lg whitespace-nowrap">
                    <GripHorizontal className="w-3 h-3" />
                    <span>Drag Hook</span>
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: `"${project.subtitleStyle.fontFamily || project.introHook.fontFamily || 'Montserrat'}", "Segoe UI Emoji", "Apple Color Emoji", sans-serif`,
                    fontWeight: (!project.subtitleStyle.fontFamily || project.subtitleStyle.fontFamily === 'Montserrat') ? 900 : 700,
                    color: project.introHook.color || '#FFFFFF',
                    fontSize: `${previewHookFontSize}px`,
                    backgroundColor: 'transparent',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    WebkitTextStroke: `${previewHookOutlineWidth}px ${
                      project.introHook.outlineColor ?? '#000000'
                    }`,
                    paintOrder: 'stroke fill',
                    textShadow:
                      '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 4px 14px rgba(0,0,0,0.95)',
                  }}
                  className="text-center uppercase tracking-normal"
                >
                  {renderHookText(
                    project.introHook.text,
                    project.introHook.color || '#FFFFFF',
                    project.introHook.highlightColor || project.subtitleStyle.highlightColor || '#FFE600',
                    project.introHook.wordsPerLine
                  )}
                </div>
              </div>
            );
          })()}

          {/* Watermark Overlay */}
          {project.watermark?.enabled && (
            <div
              style={{
                position: 'absolute',
                opacity: project.watermark.opacity || 0.8,
                ...(project.watermark.position === 'top-left' && { top: '16px', left: '16px' }),
                ...(project.watermark.position === 'top-right' && { top: '16px', right: '16px' }),
                ...(project.watermark.position === 'bottom-left' && { bottom: '24px', left: '16px' }),
                ...(project.watermark.position === 'bottom-right' && { bottom: '24px', right: '16px' }),
              }}
              className="z-30 pointer-events-none"
            >
              <span className="px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px] font-black tracking-widest border border-white/20 uppercase shadow">
                CLIPFORGE
              </span>
            </div>
          )}

          {/* Subtitles Overlay with Direct Dragging & Individual Word Colors */}
          {activeSubtitle && (
            <div
              onMouseDown={handleSubtitleMouseDown}
              style={{
                position: 'absolute',
                left: '6%',
                right: '6%',
                transform: `translateX(${project.subtitleStyle.horizontalOffset || 0}px)`,
                ...(project.subtitleStyle.position === 'top'
                  ? { top: `${15 + (project.subtitleStyle.verticalOffset || 0) / 10}%` }
                  : project.subtitleStyle.position === 'middle'
                  ? { top: `${45 + (project.subtitleStyle.verticalOffset || 0) / 10}%` }
                  : { bottom: `${22 - (project.subtitleStyle.verticalOffset || 0) / 10}%` }),
              }}
              className={`z-30 text-center flex flex-wrap justify-center items-center select-none cursor-move group transition-all duration-75 ${
                selectedOverlayType === 'subtitle'
                  ? 'ring-2 ring-cyan-400 ring-dashed rounded-xl bg-cyan-950/20 shadow-xl'
                  : 'hover:ring-1 hover:ring-cyan-400/60 rounded-xl'
              }`}
            >
              {/* Drag Handle Badge */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-500/50 text-[10px] text-cyan-300 font-bold tracking-wider uppercase flex items-center gap-1 shadow-lg whitespace-nowrap">
                  <GripHorizontal className="w-3 h-3" />
                  <span>Drag Captions</span>
                </span>
              </div>

              <span
                style={{
                  fontFamily: `"${project.subtitleStyle.fontFamily || 'Montserrat'}", sans-serif`,
                  fontWeight: (!project.subtitleStyle.fontFamily || project.subtitleStyle.fontFamily === 'Montserrat') ? 800 : 700,
                  fontSize: `${previewSubtitleFontSize}px`,
                  color: project.subtitleStyle.primaryColor || '#FFFFFF',
                  WebkitTextStroke: `${previewSubtitleOutlineWidth}px ${
                    project.subtitleStyle.outlineColor || '#000000'
                  }`,
                  paintOrder: 'stroke fill',
                  textTransform: project.subtitleStyle.textTransform || 'none',
                  backgroundColor: project.subtitleStyle.backgroundColor || undefined,
                  padding: project.subtitleStyle.backgroundPadding
                    ? `${project.subtitleStyle.backgroundPadding * 0.4}px`
                    : undefined,
                  borderRadius: project.subtitleStyle.backgroundBorderRadius
                    ? `${project.subtitleStyle.backgroundBorderRadius * 0.4}px`
                    : undefined,
                  lineHeight: project.subtitleStyle.lineSpacing || 1.2,
                }}
                className="tracking-normal drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
              >
                {activeSubtitle.words && activeSubtitle.words.length > 0 ? (
                  activeSubtitle.words.map((w, idx) => {
                    const nextWord = activeSubtitle.words![idx + 1];
                    const wordEnd = nextWord ? nextWord.start : w.end;
                    const isActive = currentTime >= w.start && currentTime < wordEnd;
                    const isHighlightAnim =
                      project.subtitleStyle.animation === 'karaoke_highlight' ||
                      project.subtitleStyle.animation === 'pop_in' ||
                      project.subtitleStyle.animation === 'bounce_word' ||
                      project.subtitleStyle.animation === 'neon_glow';

                    const wordColor =
                      w.color ||
                      (isActive && isHighlightAnim
                        ? project.subtitleStyle.highlightColor || '#FFE600'
                        : project.subtitleStyle.primaryColor || '#FFFFFF');

                    let wordTransform = '';
                    let wordShadow = '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 4px 10px rgba(0,0,0,0.9)';

                    if (project.subtitleStyle.animation === 'bounce_word' && isActive) {
                      wordTransform = 'translateY(-6px) scale(1.15)';
                    } else if (project.subtitleStyle.animation === 'karaoke_highlight' && isActive) {
                      wordTransform = 'scale(1.12)';
                    } else if (project.subtitleStyle.animation === 'pop_in' && isActive) {
                      wordTransform = 'scale(1.08)';
                    }

                    if (project.subtitleStyle.animation === 'neon_glow' && isActive) {
                      wordShadow = `0 0 14px ${wordColor}, 0 0 28px ${wordColor}`;
                    }

                    if (project.subtitleStyle.animation === 'typewriter' && w.start > currentTime) {
                      return null;
                    }

                    return (
                      <span
                        key={idx}
                        style={{
                          color: wordColor,
                          transform: wordTransform,
                          textShadow: wordShadow,
                          WebkitTextStroke: `${previewSubtitleOutlineWidth}px ${
                            project.subtitleStyle.outlineColor || '#000000'
                          }`,
                          paintOrder: 'stroke fill',
                          display: 'inline-block',
                          margin: '0 4px',
                          transition: 'transform 0.08s ease, color 0.08s ease',
                        }}
                      >
                        {w.word}
                      </span>
                    );
                  })
                ) : (
                  <span
                    style={{
                      WebkitTextStroke: `${previewSubtitleOutlineWidth}px ${
                        project.subtitleStyle.outlineColor || '#000000'
                      }`,
                      paintOrder: 'stroke fill',
                      textShadow: '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 4px 10px rgba(0,0,0,0.9)',
                    }}
                  >
                    {activeSubtitle.text}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Floating Quick Positioning Toolbar for Captions */}
          {activeSubtitle && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 inset-x-3 z-40 flex items-center justify-center pointer-events-auto transition-all"
            >
              <div className="bg-slate-950/95 border border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-2xl backdrop-blur-md flex items-center gap-1.5 text-xs text-white">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pr-1 border-r border-slate-800 hidden sm:inline">
                  Position
                </span>

                {/* Preset buttons: Top, Mid, Bottom */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateSubtitleStyle({ position: 'top', verticalOffset: 0, horizontalOffset: 0 })
                    }
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition ${
                      project.subtitleStyle.position === 'top'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSubtitleStyle({ position: 'middle', verticalOffset: 0, horizontalOffset: 0 })
                    }
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition ${
                      project.subtitleStyle.position === 'middle'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    Mid
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSubtitleStyle({ position: 'bottom', verticalOffset: 0, horizontalOffset: 0 })
                    }
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition ${
                      project.subtitleStyle.position === 'bottom'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    Bottom
                  </button>
                </div>

                <div className="h-3 w-px bg-slate-800 mx-0.5" />

                {/* Nudge buttons: Up, Down, Center */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Nudge Up 10px"
                    onClick={() =>
                      updateSubtitleStyle({
                        verticalOffset: Math.min(150, (project.subtitleStyle.verticalOffset || 0) + 10),
                      })
                    }
                    className="px-1.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition active:scale-95"
                  >
                    ▲ Up
                  </button>
                  <button
                    type="button"
                    title="Nudge Down 10px"
                    onClick={() =>
                      updateSubtitleStyle({
                        verticalOffset: Math.max(-150, (project.subtitleStyle.verticalOffset || 0) - 10),
                      })
                    }
                    className="px-1.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition active:scale-95"
                  >
                    ▼ Down
                  </button>
                  <button
                    type="button"
                    title="Center Captions Horizontally"
                    onClick={() => updateSubtitleStyle({ horizontalOffset: 0 })}
                    className="px-1.5 py-0.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold transition active:scale-95"
                  >
                    🎯 Center
                  </button>
                </div>

                <div className="h-3 w-px bg-slate-800 mx-0.5" />

                {/* Font Size +/- */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Decrease Font Size"
                    onClick={() =>
                      updateSubtitleStyle({
                        fontSize: Math.max(30, (project.subtitleStyle.fontSize || 54) - 4),
                      })
                    }
                    className="px-1.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition active:scale-95"
                  >
                    A-
                  </button>
                  <span className="text-[10px] font-mono text-slate-400">
                    {project.subtitleStyle.fontSize || 54}
                  </span>
                  <button
                    type="button"
                    title="Increase Font Size"
                    onClick={() =>
                      updateSubtitleStyle({
                        fontSize: Math.min(84, (project.subtitleStyle.fontSize || 54) + 4),
                      })
                    }
                    className="px-1.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition active:scale-95"
                  >
                    A+
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Safe Zone Guide (TikTok / Reels boundaries) */}
          <SafeZoneGuide visible={safeZoneVisible} />
        </div>
      </div>

      {/* Playhead Controls, Time Display & Timeline / Snap Toolbar */}
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 mt-2.5 flex items-center justify-between gap-3 backdrop-blur shadow-xl">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Skip Back 1 frame */}
          <button
            onClick={() => stepFrame(-1)}
            title="Step Back 1 Frame"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 transition active:scale-95"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
          </button>

          {/* Skip Forward 1 frame */}
          <button
            onClick={() => stepFrame(1)}
            title="Step Forward 1 Frame"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Restart from beginning */}
          <button
            onClick={() => handleSeek(0)}
            title="Restart from beginning"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Timecodes */}
        <div className="font-mono text-xs text-slate-300 flex items-center gap-1.5">
          <span className="text-white font-bold">{(currentTime ?? 0).toFixed(2)}s</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{(duration ?? 0).toFixed(2)}s</span>
        </div>

        {/* Snapping, Timeline Toggle & Audio Controls */}
        <div className="flex items-center gap-2">
          {/* Magnetic Snapping Toggle */}
          <button
            onClick={toggleSnapping}
            title={snappingEnabled ? 'Magnetic Snapping: Active (Hold Shift to bypass)' : 'Magnetic Snapping: Inactive'}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              snappingEnabled
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30 shadow-md shadow-cyan-500/10'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-xs">🧲</span>
            <span className="hidden sm:inline">{snappingEnabled ? 'Snap: ON' : 'Snap: OFF'}</span>
          </button>

          {/* Hide / Show Timeline Button */}
          <button
            onClick={toggleTimeline}
            title={isTimelineVisible ? 'Hide Timeline (T) - Maximize Preview' : 'Show Timeline (T)'}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              isTimelineVisible
                ? 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800'
                : 'bg-blue-600/25 border-blue-500/50 text-blue-400 hover:bg-blue-600/35 shadow-lg shadow-blue-500/10'
            }`}
          >
            {isTimelineVisible ? (
              <>
                <PanelBottomClose className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Hide Timeline</span>
              </>
            ) : (
              <>
                <PanelBottomOpen className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Show Timeline</span>
              </>
            )}
          </button>

          {/* Audio Mute & Volume */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title={isMuted ? 'Unmute' : 'Mute preview'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
          </button>
        </div>
      </div>
    </div>
  );
}
