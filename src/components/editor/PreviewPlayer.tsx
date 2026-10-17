'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX, Move, ZoomIn } from 'lucide-react';
import SafeZoneGuide from './SafeZoneGuide';

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
    safeZoneVisible,
    updateRegionCrop,
    zoomRegion,
  } = useEditorStore();

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    regionId: string;
    mouseX: number;
    mouseY: number;
    cropX: number;
    cropY: number;
    regionWidthPx: number;
    regionHeightPx: number;
  } | null>(null);

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
            if (region.id === selectedRegionId) {
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
  }, [project, selectedRegionId]);

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

  // 4. Interactive Click-and-Drag Pan on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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
      setIsDragging(true);
      dragStartRef.current = {
        regionId: clickedRegion.id,
        mouseX: e.clientX,
        mouseY: e.clientY,
        cropX: clickedRegion.crop.x,
        cropY: clickedRegion.crop.y,
        regionWidthPx: rect.width * clickedRegion.targetBounds.width,
        regionHeightPx: rect.height * clickedRegion.targetBounds.height,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;

    const drag = dragStartRef.current;
    const deltaPxX = e.clientX - drag.mouseX;
    const deltaPxY = e.clientY - drag.mouseY;

    // Convert pixel delta to normalized crop delta with 1:1 proportional cursor tracking
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
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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

  const ratioClasses: Record<string, string> = {
    '9:16': 'aspect-[9/16] max-h-[72vh]',
    '1:1': 'aspect-square max-h-[72vh]',
    '16:9': 'aspect-video max-w-2xl max-h-[72vh]',
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-slate-950/50 select-none overflow-hidden">
      {/* Video Canvas Container */}
      <div className="flex-1 flex items-center justify-center w-full relative">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 ${
            ratioClasses[project.canvas.aspectRatio] || 'aspect-[9/16]'
          } w-auto h-full max-h-[70vh] flex flex-col cursor-grab active:cursor-grabbing`}
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
                {region.id === selectedRegionId && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                )}
              </div>
            ))}
          </div>

          {/* Interactive Dragging Overlay Banner */}
          {isDragging && (
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-30">
              <span className="px-3 py-1 rounded-full bg-blue-600/90 text-white font-bold text-xs shadow-lg backdrop-blur flex items-center gap-1.5 animate-in fade-in">
                <Move className="w-3.5 h-3.5" />
                <span>Panning Region...</span>
              </span>
            </div>
          )}

          {/* Intro Hook Text (First 1-3 seconds) */}
          {project.introHook?.enabled && currentTime <= (project.introHook.duration || 2.5) && (
            <div className="absolute top-1/4 inset-x-4 z-30 flex justify-center pointer-events-none animate-in zoom-in-95 duration-200">
              <div
                style={{
                  color: project.introHook.color || '#FFE600',
                  fontSize: `${Math.round(project.introHook.fontSize * 0.45)}px`,
                }}
                className="font-black text-center uppercase tracking-wider drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] px-4 py-2 bg-black/60 rounded-xl border border-white/10"
              >
                {project.introHook.text}
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

          {/* Subtitles Overlay */}
          {activeSubtitle && (
            <div
              style={{
                position: 'absolute',
                left: '6%',
                right: '6%',
                ...(project.subtitleStyle.position === 'top'
                  ? { top: `${15 + (project.subtitleStyle.verticalOffset || 0) / 10}%` }
                  : project.subtitleStyle.position === 'middle'
                  ? { top: `${45 + (project.subtitleStyle.verticalOffset || 0) / 10}%` }
                  : { bottom: `${22 - (project.subtitleStyle.verticalOffset || 0) / 10}%` }),
              }}
              className="z-30 text-center pointer-events-none flex flex-wrap justify-center items-center select-none"
            >
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
                {/* Karaoke active word rendering */}
                {activeSubtitle.words &&
                activeSubtitle.words.length > 0 &&
                project.subtitleStyle.animation === 'karaoke_highlight' ? (
                  activeSubtitle.words.map((w, idx) => {
                    const isActive = currentTime >= w.start && currentTime <= w.end;
                    return (
                      <span
                        key={idx}
                        style={{
                          color: isActive
                            ? project.subtitleStyle.highlightColor || '#FFE600'
                            : project.subtitleStyle.primaryColor || '#FFFFFF',
                          transform: isActive ? 'scale(1.1)' : 'scale(1)',
                          display: 'inline-block',
                          margin: '0 4px',
                          transition: 'color 0.1s, transform 0.1s',
                        }}
                      >
                        {w.word}
                      </span>
                    );
                  })
                ) : (
                  activeSubtitle.text
                )}
              </span>
            </div>
          )}

          {/* Safe Zone Guide (TikTok / Reels boundaries) */}
          <SafeZoneGuide visible={safeZoneVisible} />
        </div>
      </div>

      {/* Playhead Controls & Time Display */}
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3 mt-3 flex items-center justify-between gap-4 backdrop-blur shadow-xl">
        <div className="flex items-center gap-2">
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

        {/* Audio Mute & Volume */}
        <div className="flex items-center gap-2">
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
