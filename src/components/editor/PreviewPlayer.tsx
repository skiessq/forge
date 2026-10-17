'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import SafeZoneGuide from './SafeZoneGuide';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Crop as CropIcon,
} from 'lucide-react';
import { LayoutRegion, SubtitleItem } from '@/lib/types';

export default function PreviewPlayer() {
  const {
    project,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    duration,
    safeZoneVisible,
    selectedRegionId,
    setSelectedRegionId,
    updateRegionCrop,
  } = useEditorStore();

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCropDragging, setIsCropDragging] = useState(false);

  if (!project) return null;

  const videoSrc = `/api/media/serve?path=${encodeURIComponent(project.source.path)}`;
  const secondarySrc = project.layout.secondaryMediaPath
    ? `/api/media/serve?path=${encodeURIComponent(project.layout.secondaryMediaPath)}`
    : null;

  // Synchronize play/pause
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

  // Synchronize time seeking
  const handleTimeUpdate = () => {
    const v1 = primaryVideoRef.current;
    if (v1 && !isCropDragging) {
      setCurrentTime(v1.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    const v1 = primaryVideoRef.current;
    const v2 = secondaryVideoRef.current;
    setCurrentTime(time);
    if (v1) v1.currentTime = time;
    if (v2) v2.currentTime = time % (v2.duration || 1);
  };

  // Step 1 frame forward or backward (1/30s)
  const stepFrame = (frames: number) => {
    const fps = project.canvas.fps || 30;
    const nextTime = Math.max(0, Math.min(duration, currentTime + frames / fps));
    handleSeek(nextTime);
  };

  // Find active subtitle for current time
  const activeSubtitle = project.subtitles.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // Canvas aspect ratio styles
  const ratioClasses: Record<string, string> = {
    '9:16': 'aspect-[9/16] max-h-[72vh]',
    '1:1': 'aspect-square max-h-[72vh]',
    '16:9': 'aspect-video max-w-2xl max-h-[72vh]',
  };

  const selectedRegion = project.layout.regions.find((r) => r.id === selectedRegionId);

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-slate-950/50 select-none overflow-hidden">
      {/* Video Canvas Container */}
      <div className="flex-1 flex items-center justify-center w-full relative">
        <div
          ref={containerRef}
          className={`relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 ${
            ratioClasses[project.canvas.aspectRatio] || 'aspect-[9/16]'
          } w-auto h-full max-h-[70vh] flex flex-col`}
        >
          {/* Main Primary Hidden Video for audio and sync */}
          <video
            ref={primaryVideoRef}
            src={videoSrc}
            playsInline
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          {/* Render Layout Regions */}
          <div className="relative w-full h-full overflow-hidden bg-black">
            {project.layout.regions.map((region) => {
              const bounds = region.targetBounds;
              const isSelected = region.id === selectedRegionId;
              const isSecondary = region.sourceType === 'secondary_media';

              return (
                <div
                  key={region.id}
                  onClick={() => setSelectedRegionId(region.id)}
                  style={{
                    position: 'absolute',
                    left: `${bounds.x * 100}%`,
                    top: `${bounds.y * 100}%`,
                    width: `${bounds.width * 100}%`,
                    height: `${bounds.height * 100}%`,
                    borderRadius: region.borderRadius ? `${region.borderRadius}px` : undefined,
                    borderWidth: region.borderWidth ? `${region.borderWidth}px` : undefined,
                    borderColor: region.borderColor || undefined,
                    overflow: 'hidden',
                  }}
                  className={`cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-black z-20' : 'z-10'
                  }`}
                >
                  {/* Blurred Background Mode */}
                  {region.blurBackground ? (
                    <div className="w-full h-full relative overflow-hidden">
                      <video
                        src={videoSrc}
                        muted
                        playsInline
                        ref={(el) => {
                          if (el && primaryVideoRef.current) {
                            el.currentTime = primaryVideoRef.current.currentTime;
                          }
                        }}
                        className="w-full h-full object-cover scale-125 blur-xl opacity-60"
                      />
                    </div>
                  ) : isSecondary && secondarySrc ? (
                    // Secondary media (Image, Video, GIF)
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                      {project.layout.secondaryMediaType === 'video' ? (
                        <video
                          ref={secondaryVideoRef}
                          src={secondarySrc}
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img src={secondarySrc} alt="Overlay" className="w-full h-full object-contain" />
                      )}
                    </div>
                  ) : (
                    // Primary Video cropped & rendered
                    <div className="w-full h-full relative overflow-hidden bg-slate-950">
                      <div
                        style={{
                          position: 'absolute',
                          left: `-${(region.crop.x / region.crop.width) * 100}%`,
                          top: `-${(region.crop.y / region.crop.height) * 100}%`,
                          width: `${(1 / region.crop.width) * 100}%`,
                          height: `${(1 / region.crop.height) * 100}%`,
                        }}
                      >
                        <video
                          src={videoSrc}
                          muted
                          playsInline
                          ref={(el) => {
                            if (el && primaryVideoRef.current) {
                              el.currentTime = primaryVideoRef.current.currentTime;
                              if (isPlaying && el.paused) el.play().catch(() => {});
                              if (!isPlaying && !el.paused) el.pause();
                            }
                          }}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Region Label Tag */}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-[10px] text-white/90 font-medium pointer-events-none">
                    {region.label}
                  </div>
                </div>
              );
            })}

            {/* Divider Line for Split Layouts */}
            {project.layout.dividerWidth > 0 && project.layout.regions.length >= 2 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${(project.layout.splitRatio || 0.5) * 100}%`,
                  height: `${project.layout.dividerWidth}px`,
                  backgroundColor: project.layout.dividerColor || '#3B82F6',
                  transform: 'translateY(-50%)',
                }}
                className="z-20 pointer-events-none shadow-md"
              />
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
                className={`absolute z-30 pointer-events-none p-3 ${
                  project.watermark.position === 'top-left'
                    ? 'top-2 left-2'
                    : project.watermark.position === 'top-right'
                    ? 'top-2 right-2'
                    : project.watermark.position === 'bottom-left'
                    ? 'bottom-8 left-2'
                    : 'bottom-8 right-2'
                }`}
                style={{ opacity: project.watermark.opacity || 0.8 }}
              >
                <div className="px-2 py-1 rounded bg-black/70 border border-white/20 text-white font-black text-xs tracking-wider">
                  CLIPFORGE
                </div>
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
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
