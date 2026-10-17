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
} from 'lucide-react';
import SafeZoneGuide from './SafeZoneGuide';

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
    }
  | {
      mode: 'subtitle';
      mouseX: number;
      mouseY: number;
      initH: number;
      initV: number;
    }
  | {
      mode: 'hook';
      mouseX: number;
      mouseY: number;
      initNormX: number;
      initNormY: number;
      containerWidth: number;
      containerHeight: number;
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
    safeZoneVisible,
    isTimelineVisible,
    toggleTimeline,
    updateRegionCrop,
    zoomRegion,
    updateSubtitleStyle,
    updateIntroHook,
  } = useEditorStore();

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'region' | 'subtitle' | 'hook' | null>(null);
  const dragStartRef = useRef<DragState | null>(null);

  if (!project) return null;

  const videoSrc = `/api/media/serve?path=${encodeURIComponent(project.source.path)}`;
  const secondarySrc = project.layout.secondaryMediaPath
    ? `/api/media/serve?path=${encodeURIComponent(project.layout.secondaryMediaPath)}`
    : null;

  const canvasWidth = project.canvas.width;
  const canvasHeight = project.canvas.height;

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
        if (project.layout.templateId === 'blurred_background_fit') {
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
          // Render layout regions
          for (const region of project.layout.regions) {
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

            if (region.sourceType === 'secondary_media' && secondaryVideoRef.current) {
              const v2 = secondaryVideoRef.current;
              if (v2.readyState >= 2) {
                ctx.drawImage(v2, dx, dy, dw, dh);
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
          if (project.layout.dividerWidth > 0 && project.layout.regions.length >= 2) {
            const divY = (project.layout.splitRatio || 0.5) * canvas.height;
            const divH = project.layout.dividerWidth * (canvas.height / 1920) * 1.5;
            ctx.fillStyle = project.layout.dividerColor || '#3B82F6';
            ctx.fillRect(0, divY - divH / 2, canvas.width, divH);
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [project, selectedRegionId, selectedOverlayType]);

  // 3. Playhead Seeking and Throttled Time Updates
  const handleTimeUpdate = () => {
    const v1 = primaryVideoRef.current;
    if (v1 && !isDragging) {
      setCurrentTime(v1.currentTime);
    }
  };

  const handleSeek = (newTime: number) => {
    const v1 = primaryVideoRef.current;
    const v2 = secondaryVideoRef.current;
    if (v1) {
      v1.currentTime = newTime;
      setCurrentTime(newTime);
    }
    if (v2) {
      v2.currentTime = newTime;
    }
  };

  const stepFrame = (frames: number) => {
    const fps = project.source.probe?.fps || 30;
    const delta = frames / fps;
    handleSeek(Math.max(0, Math.min(duration, currentTime + delta)));
  };

  // 4. Interactive Canvas Region Dragging
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickXNorm = (e.clientX - rect.left) / rect.width;
    const clickYNorm = (e.clientY - rect.top) / rect.height;

    // Find region under cursor
    const clickedRegion = project.layout.regions.find((r) => {
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
      setIsDragging(true);
      setDragMode('region');
      dragStartRef.current = {
        mode: 'region',
        regionId: clickedRegion.id,
        mouseX: e.clientX,
        mouseY: e.clientY,
        cropX: clickedRegion.crop.x,
        cropY: clickedRegion.crop.y,
        regionWidthPx: rect.width * clickedRegion.targetBounds.width,
        regionHeightPx: rect.height * clickedRegion.targetBounds.height,
      };
    } else {
      setSelectedOverlayType(null);
    }
  };

  // 5. Interactive Subtitle Dragging
  const handleSubtitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOverlayType('subtitle');
    setIsDragging(true);
    setDragMode('subtitle');
    dragStartRef.current = {
      mode: 'subtitle',
      mouseX: e.clientX,
      mouseY: e.clientY,
      initH: project.subtitleStyle.horizontalOffset || 0,
      initV: project.subtitleStyle.verticalOffset || 0,
    };
  };

  // 6. Interactive Intro Hook Dragging
  const handleHookMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOverlayType('hook');
    setIsDragging(true);
    setDragMode('hook');
    const container = containerRef.current;
    const rect = container ? container.getBoundingClientRect() : { width: 400, height: 700 };
    dragStartRef.current = {
      mode: 'hook',
      mouseX: e.clientX,
      mouseY: e.clientY,
      initNormX: project.introHook?.positionX ?? 0.5,
      initNormY: project.introHook?.positionY ?? 0.22,
      containerWidth: rect.width,
      containerHeight: rect.height,
    };
  };

  // Unified MouseMove handler for region, subtitle, and hook dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const drag = dragStartRef.current;

    if (drag.mode === 'subtitle') {
      const deltaX = e.clientX - drag.mouseX;
      const deltaY = e.clientY - drag.mouseY;
      // Invert vertical offset based on position direction
      const vDir = project.subtitleStyle.position === 'top' ? 1 : -1;
      const newH = Math.max(-150, Math.min(150, drag.initH + deltaX));
      const newV = Math.max(-150, Math.min(150, drag.initV + deltaY * vDir));
      updateSubtitleStyle({
        horizontalOffset: Math.round(newH),
        verticalOffset: Math.round(newV),
      });
      return;
    }

    if (drag.mode === 'hook') {
      const deltaX = e.clientX - drag.mouseX;
      const deltaY = e.clientY - drag.mouseY;
      const cW = drag.containerWidth || 400;
      const cH = drag.containerHeight || 700;
      const newX = Math.max(0.08, Math.min(0.92, drag.initNormX + deltaX / cW));
      const newY = Math.max(0.06, Math.min(0.94, drag.initNormY + deltaY / cH));
      updateIntroHook({
        positionX: parseFloat(newX.toFixed(3)),
        positionY: parseFloat(newY.toFixed(3)),
      });
      return;
    }

    if (drag.mode === 'region') {
      const deltaPxX = e.clientX - drag.mouseX;
      const deltaPxY = e.clientY - drag.mouseY;

      const currentRegion = project.layout.regions.find((r) => r.id === drag.regionId);
      if (!currentRegion) return;

      const vW = primaryVideoRef.current?.videoWidth || 1920;
      const vH = primaryVideoRef.current?.videoHeight || 1080;
      const targetAspect = drag.regionWidthPx / Math.max(1, drag.regionHeightPx);
      const effectiveCropHNorm = (currentRegion.crop.width * (vW / vH)) / targetAspect;

      const cropFactorX = currentRegion.crop.width / Math.max(1, drag.regionWidthPx);
      const cropFactorY = effectiveCropHNorm / Math.max(1, drag.regionHeightPx);

      const newCropX = parseFloat((drag.cropX - deltaPxX * cropFactorX).toFixed(3));
      const newCropY = parseFloat((drag.cropY - deltaPxY * cropFactorY).toFixed(3));

      updateRegionCrop(drag.regionId, {
        x: newCropX,
        y: newCropY,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
    dragStartRef.current = null;
  };

  // Mouse wheel zooms region in/out
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !selectedRegionId) return;

    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoomRegion(selectedRegionId, factor);
  };

  // Active Subtitle for current playhead
  const activeSubtitle = project.subtitles.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // Helper for Intro Hook Transition Classes
  const getHookTransitionClass = (transition?: string) => {
    switch (transition) {
      case 'zoom_pop':
        return 'anim-hook-zoom_pop';
      case 'slide_down':
        return 'anim-hook-slide_down';
      case 'glitch':
        return 'anim-hook-glitch';
      case 'fade_zoom':
        return 'anim-hook-fade_zoom';
      case 'pop_in':
        return 'anim-hook-pop_in';
      case 'bounce_drop':
      default:
        return 'anim-hook-bounce_drop';
    }
  };

  // Helper for rendering Intro Hook Headline with optional highlight punch
  const renderHookText = (text: string, defaultColor: string, highlightColor?: string) => {
    if (!highlightColor || highlightColor === defaultColor) return text;
    if (text.includes('*')) {
      const parts = text.split('*');
      return parts.map((part, i) => (
        <span key={i} style={{ color: i % 2 === 1 ? highlightColor : defaultColor }}>
          {part}
        </span>
      ));
    }
    const words = text.split(' ');
    if (words.length <= 1) return text;
    return (
      <>
        <span style={{ color: highlightColor }}>{words[0]} </span>
        <span>{words.slice(1).join(' ')}</span>
      </>
    );
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
          {secondarySrc && project.layout.secondaryMediaType === 'video' && (
            <video
              ref={secondaryVideoRef}
              src={secondarySrc}
              muted
              loop
              playsInline
              className="hidden"
            />
          )}

          {/* High-Performance Hardware-Accelerated 60 FPS Canvas */}
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Region Label Indicators */}
          <div className="absolute inset-0 pointer-events-none">
            {project.layout.regions.map((region) => (
              <div
                key={region.id}
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
            ))}
          </div>

          {/* Active Dragging Feedback Banners */}
          {isDragging && dragMode === 'region' && (
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-40">
              <span className="px-3 py-1 rounded-full bg-blue-600/90 text-white font-bold text-xs shadow-lg backdrop-blur flex items-center gap-1.5 animate-in fade-in">
                <Move className="w-3.5 h-3.5" />
                <span>Panning Region...</span>
              </span>
            </div>
          )}

          {isDragging && dragMode === 'subtitle' && (
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-40">
              <span className="px-3 py-1 rounded-full bg-cyan-600/90 text-white font-bold text-xs shadow-lg backdrop-blur flex items-center gap-1.5 animate-in fade-in">
                <Move className="w-3.5 h-3.5" />
                <span>
                  Positioning Captions ({project.subtitleStyle.horizontalOffset || 0}px,{' '}
                  {project.subtitleStyle.verticalOffset || 0}px)
                </span>
              </span>
            </div>
          )}

          {isDragging && dragMode === 'hook' && (
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-40">
              <span className="px-3 py-1 rounded-full bg-amber-600/90 text-white font-bold text-xs shadow-lg backdrop-blur flex items-center gap-1.5 animate-in fade-in">
                <Move className="w-3.5 h-3.5" />
                <span>
                  Positioning Hook ({Math.round((project.introHook?.positionX ?? 0.5) * 100)}%,{' '}
                  {Math.round((project.introHook?.positionY ?? 0.22) * 100)}%)
                </span>
              </span>
            </div>
          )}

          {/* Intro Hook Text (First 1-5 seconds) with Direct Dragging */}
          {project.introHook?.enabled && currentTime <= (project.introHook.duration || 2.5) && (
            <div
              onMouseDown={handleHookMouseDown}
              style={{
                position: 'absolute',
                left: `${(project.introHook.positionX ?? 0.5) * 100}%`,
                top: `${(project.introHook.positionY ?? 0.22) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`z-30 select-none cursor-move group transition-all duration-75 max-w-[90%] ${
                selectedOverlayType === 'hook'
                  ? 'ring-2 ring-amber-400 ring-dashed rounded-2xl bg-amber-950/20 shadow-xl'
                  : 'hover:ring-1 hover:ring-amber-400/60 rounded-2xl'
              } ${getHookTransitionClass(project.introHook.transition)}`}
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
                  fontFamily: project.introHook.fontFamily || 'Montserrat',
                  color: project.introHook.color || '#FFE600',
                  fontSize: `${Math.round((project.introHook.fontSize || 56) * 0.44)}px`,
                  backgroundColor: project.introHook.backgroundColor || 'rgba(0, 0, 0, 0.75)',
                  padding: `${(project.introHook.backgroundPadding ?? 12) * 0.4}px ${
                    (project.introHook.backgroundPadding ?? 16) * 0.6
                  }px`,
                  borderRadius: `${(project.introHook.borderRadius ?? 16) * 0.5}px`,
                  WebkitTextStroke: `${project.introHook.outlineWidth ?? 2}px ${
                    project.introHook.outlineColor ?? '#000000'
                  }`,
                }}
                className="font-black text-center uppercase tracking-wider drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
              >
                {renderHookText(
                  project.introHook.text,
                  project.introHook.color || '#FFE600',
                  project.introHook.highlightColor
                )}
              </div>
            </div>
          )}

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
                  fontFamily: project.subtitleStyle.fontFamily || 'Montserrat',
                  fontSize: `${Math.round((project.subtitleStyle.fontSize || 50) * 0.42)}px`,
                  color: project.subtitleStyle.primaryColor || '#FFFFFF',
                  WebkitTextStroke: `${project.subtitleStyle.outlineWidth || 3}px ${
                    project.subtitleStyle.outlineColor || '#000000'
                  }`,
                  textTransform: project.subtitleStyle.textTransform || 'uppercase',
                  backgroundColor: project.subtitleStyle.backgroundColor || undefined,
                  padding: project.subtitleStyle.backgroundPadding
                    ? `${project.subtitleStyle.backgroundPadding * 0.4}px`
                    : undefined,
                  borderRadius: project.subtitleStyle.backgroundBorderRadius
                    ? `${project.subtitleStyle.backgroundBorderRadius * 0.4}px`
                    : undefined,
                  lineHeight: project.subtitleStyle.lineSpacing || 1.2,
                }}
                className="font-extrabold tracking-wide drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
              >
                {activeSubtitle.words && activeSubtitle.words.length > 0 ? (
                  activeSubtitle.words.map((w, idx) => {
                    const isActive = currentTime >= w.start && currentTime <= w.end;
                    // Individual word custom color takes priority, followed by karaoke highlight, followed by base color
                    const wordColor =
                      w.color ||
                      (isActive && project.subtitleStyle.animation === 'karaoke_highlight'
                        ? project.subtitleStyle.highlightColor || '#FFE600'
                        : project.subtitleStyle.primaryColor || '#FFFFFF');

                    let wordTransform = '';
                    let wordShadow = '';

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
                          textShadow: wordShadow || undefined,
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
                  <span>{activeSubtitle.text}</span>
                )}
              </span>
            </div>
          )}

          {/* Safe Zone Guide (TikTok / Reels boundaries) */}
          <SafeZoneGuide visible={safeZoneVisible} />
        </div>
      </div>

      {/* Playhead Controls, Time Display & Timeline Toggle Bar */}
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
          <span className="text-white font-bold">{currentTime.toFixed(2)}s</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{duration.toFixed(2)}s</span>
        </div>

        {/* Timeline Toggle & Audio Controls */}
        <div className="flex items-center gap-2">
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
