import path from 'path';
import fs from 'fs';
import { Project, ExportSettings, LayoutRegion, TransitionType, TransitionConfig } from '../types';
import { formatHookLines } from '../utils/hookText';
import { probeMedia } from './probe';

export interface FFmpegCommandPlan {
  command: string;
  args: string[];
  outputPath: string;
}

// Helper to ensure dimensions are even (FFmpeg H.264 requirement)
export function makeEven(val: number): number {
  const round = Math.round(val);
  return round % 2 === 0 ? round : round + 1;
}

export function buildFFmpegExportCommand(
  project: Project,
  customSettings?: Partial<ExportSettings>
): FFmpegCommandPlan {
  const settings: ExportSettings = {
    ...project.exportSettings,
    ...customSettings,
  };

  const canvasWidth = project.canvas.width;
  const canvasHeight = project.canvas.height;
  const fps = settings.fps === 'source' ? project.source.probe?.fps || 30 : settings.fps;

  // Determine output directory and file
  const projectDir = path.dirname(project.source.path);
  const exportsDir = path.join(projectDir, 'exports');
  const sanitizedName = (settings.outputFileName || 'short.mp4').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const outputPath = path.join(exportsDir, sanitizedName);

  const inputs: string[] = [];
  const filterChains: string[] = [];

  // Helper to accurately get the 0-based input index of the next input added to inputs
  function getNextInputIndex(): number {
    let count = 0;
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i] === '-i') count++;
    }
    return count;
  }

  // Primary source input (index 0)
  inputs.push('-i', project.source.path);

  // Check if timeline video track has trims or splits
  const allTracks = project.tracks || (project as any).timeline?.tracks || [];
  const videoTrack = allTracks.find((t) => t.type === 'video');
  const clips = videoTrack?.clips || [];

  // Check if secondary media is used in global layout or in any clip override
  let secondaryInputIndex = -1;
  const secondaryPath =
    project.layout.secondaryMediaPath ||
    clips.find((c) => c.layoutOverride?.secondaryMediaPath)?.layoutOverride?.secondaryMediaPath;
  const secondaryMediaType =
    project.layout.secondaryMediaType ||
    clips.find((c) => c.layoutOverride?.secondaryMediaType)?.layoutOverride?.secondaryMediaType ||
    'video';

  const usesSecondary =
    Boolean(secondaryPath) &&
    (project.layout.templateId === 'media_top_game_bottom' ||
      project.layout.templateId === 'media_bottom_game_top' ||
      clips.some((c) => {
        const tpl = c.layoutOverride?.templateId;
        return tpl === 'media_top_game_bottom' || tpl === 'media_bottom_game_top';
      }));

  if (usesSecondary && secondaryPath && fs.existsSync(secondaryPath)) {
    secondaryInputIndex = getNextInputIndex();
    if (secondaryMediaType === 'video') {
      // Loop secondary video if shorter than clip
      inputs.push('-stream_loop', '-1', '-i', secondaryPath);
    } else {
      // Image or GIF
      inputs.push('-loop', '1', '-i', secondaryPath);
    }
  }
  // Source video dimensions
  const srcW = project.source.probe?.width || 1920;
  const srcH = project.source.probe?.height || 1080;

  function buildCropScaleFilter(
    inputStream: string,
    reg: { crop: { x: number; y: number; width: number; height: number } },
    targetW: number,
    targetH: number,
    outputStream: string,
    customW?: number,
    customH?: number
  ): string {
    const inputW = customW || srcW;
    const inputH = customH || srcH;
    const targetAspect = targetW / targetH;
    const cropW = makeEven(inputW * (reg.crop?.width ?? 1));
    // Strictly lock source crop aspect ratio to target box to guarantee ZERO stretching
    const cropH = makeEven(cropW / targetAspect);
    const cropX = Math.round(inputW * (reg.crop?.x ?? 0));
    const cropY = Math.round(inputH * (reg.crop?.y ?? 0));

    const needsPadding = cropX < 0 || cropY < 0 || cropX + cropW > inputW || cropY + cropH > inputH;

    if (needsPadding) {
      const padW = inputW * 3;
      const padH = inputH * 3;
      const paddedX = cropX + inputW;
      const paddedY = cropY + inputH;
      return `${inputStream}pad=${padW}:${padH}:${inputW}:${inputH}:color=black,crop=${cropW}:${cropH}:${paddedX}:${paddedY},scale=${targetW}:${targetH},setsar=1${outputStream}`;
    }

    return `${inputStream}crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${targetW}:${targetH},setsar=1${outputStream}`;
  }

  function buildLayoutChains(
    baseInput: string,
    layout: typeof project.layout,
    outputNode: string,
    suffix: string
  ): string[] {
    const chains: string[] = [];
    const tpl = layout.templateId;
    const splitRatio = layout.splitRatio || 0.5;

    // Split input into 2 streams ONLY for layouts that consume 2 primary video streams
    const needsDualSplit =
      tpl === 'split_facecam_top' ||
      tpl === 'split_gameplay_top' ||
      tpl === 'blurred_background_fit' ||
      tpl === 'picture_in_picture';

    if (needsDualSplit) {
      chains.push(`${baseInput}split=2[v_split_1_${suffix}][v_split_2_${suffix}]`);
    }

    switch (tpl) {
      case 'gameplay_full': {
        const reg = layout.regions[0] || {
          crop: { x: 0.2, y: 0, width: 0.6, height: 1 },
        };
        chains.push(buildCropScaleFilter(baseInput, reg, canvasWidth, canvasHeight, outputNode));
        break;
      }

      case 'split_facecam_top':
      case 'split_gameplay_top': {
        const regTop = layout.regions[0];
        const regBottom = layout.regions[1];
        const topH = makeEven(canvasHeight * splitRatio);
        const bottomH = makeEven(canvasHeight - topH);

        chains.push(buildCropScaleFilter(`[v_split_1_${suffix}]`, regTop, canvasWidth, topH, `[v_top_${suffix}]`));
        chains.push(buildCropScaleFilter(`[v_split_2_${suffix}]`, regBottom, canvasWidth, bottomH, `[v_bot_${suffix}]`));

        if (layout.dividerWidth > 0) {
          const divH = layout.dividerWidth;
          const color = layout.dividerColor.replace('#', '0x');
          chains.push(
            `[v_top_${suffix}][v_bot_${suffix}]vstack=inputs=2[v_stacked_${suffix}]`,
            `[v_stacked_${suffix}]drawbox=x=0:y=${topH - Math.round(divH / 2)}:w=${canvasWidth}:h=${divH}:color=${color}@1:t=fill${outputNode}`
          );
        } else {
          chains.push(`[v_top_${suffix}][v_bot_${suffix}]vstack=inputs=2${outputNode}`);
        }
        break;
      }

      case 'media_top_game_bottom':
      case 'media_bottom_game_top': {
        const isMediaTop = tpl === 'media_top_game_bottom';
        const topH = makeEven(canvasHeight * splitRatio);
        const bottomH = makeEven(canvasHeight - topH);
        const mediaH = isMediaTop ? topH : bottomH;
        const gameH = isMediaTop ? bottomH : topH;
        const gameReg = isMediaTop ? layout.regions[1] : layout.regions[0];
        const mediaReg = isMediaTop ? layout.regions[0] : layout.regions[1];

        chains.push(buildCropScaleFilter(baseInput, gameReg, canvasWidth, gameH, `[v_game_${suffix}]`));

        if (secondaryInputIndex >= 0) {
          let secW = layout.secondaryMediaProbe?.width;
          let secH = layout.secondaryMediaProbe?.height;
          if ((!secW || !secH) && project.layout.secondaryMediaPath) {
            try {
              const p = probeMedia(project.layout.secondaryMediaPath);
              secW = p.width;
              secH = p.height;
            } catch (err) {
              secW = 1920;
              secH = 1080;
            }
          }
          chains.push(
            buildCropScaleFilter(
              `[${secondaryInputIndex}:v]`,
              mediaReg,
              canvasWidth,
              mediaH,
              `[v_media_${suffix}]`,
              secW || 1920,
              secH || 1080
            )
          );
        } else {
          chains.push(`color=c=0x1E293B:s=${canvasWidth}x${mediaH}:duration=10[v_media_${suffix}]`);
        }

        const topStream = isMediaTop ? `[v_media_${suffix}]` : `[v_game_${suffix}]`;
        const botStream = isMediaTop ? `[v_game_${suffix}]` : `[v_media_${suffix}]`;

        if (layout.dividerWidth > 0) {
          const divH = layout.dividerWidth;
          const color = layout.dividerColor.replace('#', '0x');
          chains.push(
            `${topStream}${botStream}vstack=inputs=2[v_stacked_${suffix}]`,
            `[v_stacked_${suffix}]drawbox=x=0:y=${topH - Math.round(divH / 2)}:w=${canvasWidth}:h=${divH}:color=${color}@1:t=fill${outputNode}`
          );
        } else {
          chains.push(`${topStream}${botStream}vstack=inputs=2${outputNode}`);
        }
        break;
      }

      case 'blurred_background_fit': {
        chains.push(
          `[v_split_1_${suffix}]scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=increase,crop=${canvasWidth}:${canvasHeight},boxblur=25:5[v_blur_bg_${suffix}]`
        );
        const targetW = makeEven(canvasWidth * 0.96);
        chains.push(
          `[v_split_2_${suffix}]scale=${targetW}:-2,setsar=1[v_crisp_fg_${suffix}]`,
          `[v_blur_bg_${suffix}][v_crisp_fg_${suffix}]overlay=(W-w)/2:(H-h)/2${outputNode}`
        );
        break;
      }

      case 'picture_in_picture': {
        const mainReg = layout.regions[0];
        const pipReg = layout.regions[1];
        chains.push(buildCropScaleFilter(`[v_split_1_${suffix}]`, mainReg, canvasWidth, canvasHeight, `[v_base_${suffix}]`));

        const pipBounds = pipReg.targetBounds;
        const pipW = makeEven(canvasWidth * pipBounds.width);
        const pipH = makeEven(canvasHeight * pipBounds.height);
        const pipX = Math.round(canvasWidth * pipBounds.x);
        const pipY = Math.round(canvasHeight * pipBounds.y);

        chains.push(buildCropScaleFilter(`[v_split_2_${suffix}]`, pipReg, pipW, pipH, `[v_pip_raw_${suffix}]`));
        let pipChain = `[v_pip_raw_${suffix}]`;
        if (pipReg.borderWidth && pipReg.borderWidth > 0) {
          pipChain += `drawbox=x=0:y=0:w=${pipW}:h=${pipH}:color=white@1:t=${pipReg.borderWidth},`;
        }
        pipChain += `setsar=1[v_pip_${suffix}]`;
        chains.push(pipChain);
        chains.push(`[v_base_${suffix}][v_pip_${suffix}]overlay=${pipX}:${pipY}${outputNode}`);
        break;
      }

      default: {
        const reg = layout.regions[0] || { crop: { x: 0, y: 0, width: 1, height: 1 } };
        chains.push(buildCropScaleFilter(baseInput, reg, canvasWidth, canvasHeight, outputNode));
        break;
      }
    }

    return chains;
  }

  // Handle video tracks and clips (with per-clip layout overrides & transitions)
  let finalVideoStream = '[v_out]';

  if (clips.length > 1) {
    const renderedClips: string[] = [];
    clips.forEach((c, idx) => {
      const rawClip = `[raw_clip_${idx}]`;
      const renderedClip = `[rendered_clip_${idx}]`;
      filterChains.push(
        `[0:v]trim=start=${(c.sourceStart ?? c.start ?? 0).toFixed(2)}:duration=${(c.duration ?? 0).toFixed(2)},setpts=PTS-STARTPTS${rawClip}`
      );
      const clipLayout = c.layoutOverride || project.layout;
      const chains = buildLayoutChains(rawClip, clipLayout, renderedClip, `seg_${idx}`);
      filterChains.push(...chains);
      renderedClips.push(renderedClip);
    });

    const transitions = project.transitions || [];
    const validTransitions: { fromIndex: number; toIndex: number; type: TransitionType; duration: number }[] = [];

    for (let i = 0; i < clips.length - 1; i++) {
      const fromClip = clips[i];
      const toClip = clips[i + 1];
      const tr = transitions.find(
        (t) => t.fromClipId === fromClip.id && t.toClipId === toClip.id && t.type !== 'cut'
      );
      if (tr) {
        const maxDur = Math.min(fromClip.duration || 1, toClip.duration || 1) * 0.45;
        const dur = Math.max(0.1, Math.min(tr.duration || 0.5, maxDur));
        validTransitions.push({
          fromIndex: i,
          toIndex: i + 1,
          type: tr.type,
          duration: dur,
        });
      }
    }

    if (validTransitions.length === 0) {
      filterChains.push(`${renderedClips.join('')}concat=n=${clips.length}:v=1:a=0[v_out]`);
    } else {
      const getXfadeName = (t: TransitionType): string => {
        switch (t) {
          case 'crossfade': return 'dissolve';
          case 'fade': return 'fadeblack';
          case 'slide_left': return 'slideleft';
          case 'slide_up': return 'slideup';
          case 'zoom': return 'zoomin';
          case 'wipe': return 'wipeleft';
          case 'glitch': return 'pixelize';
          default: return 'fade';
        }
      };

      let currentStream = renderedClips[0];
      let currentDuration = clips[0].duration || 1;

      for (let i = 1; i < clips.length; i++) {
        const nextClipStream = renderedClips[i];
        const nextDuration = clips[i].duration || 1;
        const tr = validTransitions.find((t) => t.fromIndex === i - 1 && t.toIndex === i);
        const outputStream = i === clips.length - 1 ? '[v_out]' : `[v_chain_${i}]`;

        if (tr) {
          const offset = Math.max(0.01, currentDuration - tr.duration).toFixed(2);
          const xfadeName = getXfadeName(tr.type);
          filterChains.push(
            `${currentStream}${nextClipStream}xfade=transition=${xfadeName}:duration=${tr.duration.toFixed(2)}:offset=${offset}${outputStream}`
          );
          currentDuration = currentDuration + nextDuration - tr.duration;
        } else {
          filterChains.push(
            `${currentStream}${nextClipStream}concat=n=2:v=1:a=0${outputStream}`
          );
          currentDuration = currentDuration + nextDuration;
        }
        currentStream = outputStream;
      }
    }
  } else {
    // Single clip
    let baseClipInput = '[0:v]';
    if (clips.length === 1 && ((clips[0].sourceStart ?? clips[0].start ?? 0) > 0 || (clips[0].duration ?? 0) < (project.source.probe?.duration || 10) - 0.1)) {
      filterChains.push(
        `[0:v]trim=start=${(clips[0].sourceStart ?? clips[0].start ?? 0).toFixed(2)}:duration=${(clips[0].duration ?? 0).toFixed(2)},setpts=PTS-STARTPTS[v_trimmed]`
      );
      baseClipInput = '[v_trimmed]';
    }
    const clipLayout = clips[0]?.layoutOverride || project.layout;
    const chains = buildLayoutChains(baseClipInput, clipLayout, '[v_out]', 'main');
    filterChains.push(...chains);
  }

  // Encoder selection with HW Accel support
  let videoEncoder = 'libx264';
  const encoderArgs: string[] = [];

  if (settings.hwAccel === 'nvenc') {
    videoEncoder = 'h264_nvenc';
    encoderArgs.push('-preset', settings.quality === 'fast' ? 'p2' : 'p5', '-cq', '20');
  } else if (settings.hwAccel === 'qsv') {
    videoEncoder = 'h264_qsv';
    encoderArgs.push('-global_quality', '20');
  } else if (settings.hwAccel === 'videotoolbox') {
    videoEncoder = 'h264_videotoolbox';
    encoderArgs.push('-b:v', '6M');
  } else {
    // Software libx264
    videoEncoder = 'libx264';
    const preset = settings.quality === 'fast' ? 'veryfast' : settings.quality === 'balanced' ? 'fast' : 'medium';
    encoderArgs.push('-preset', preset, '-crf', '19');
  }

  // Watermark overlay
  if (project.watermark?.enabled) {
    const wmOpacity = (project.watermark.opacity ?? 0.8).toFixed(2);
    let wmX = 'w-tw-40';
    let wmY = '40';
    if (project.watermark.position === 'top-left') {
      wmX = '40';
      wmY = '40';
    } else if (project.watermark.position === 'bottom-left') {
      wmX = '40';
      wmY = 'h-th-80';
    } else if (project.watermark.position === 'bottom-right') {
      wmX = 'w-tw-40';
      wmY = 'h-th-80';
    }
    filterChains.push(
      `${finalVideoStream}drawtext=text='CLIPFORGE':fontsize=28:fontcolor=white@${wmOpacity}:x=${wmX}:y=${wmY}[v_wm]`
    );
    finalVideoStream = '[v_wm]';
  }

  // Intro Hook rendering with full-color textured emojis, Montserrat Black & outline
  const hasSubtitles = Boolean(project.subtitles && project.subtitles.length > 0);
  const hasIntroHook = Boolean(project.introHook?.enabled && project.introHook.text);
  let hookOverlaid = false;

  if (hasIntroHook) {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'render_hook_overlay.ps1');
    const projectJsonPath = path.join(projectDir, 'project.json');
    const hookOverlayPath = path.join(projectDir, 'hook_overlay.png');
    try {
      fs.writeFileSync(projectJsonPath, JSON.stringify(project, null, 2), 'utf-8');
      require('child_process').execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -projectJsonPath "${projectJsonPath}" -outputPath "${hookOverlayPath}"`,
        { windowsHide: true, stdio: 'pipe' }
      );
    } catch (err) {
      console.error('Error generating hook overlay:', err);
    }

    if (fs.existsSync(hookOverlayPath)) {
      hookOverlaid = true;
      const hookInputIndex = getNextInputIndex();
      inputs.push('-loop', '1', '-i', hookOverlayPath);

      // Read PNG dimensions
      let hookHeight = 202;
      try {
        const fd = fs.openSync(hookOverlayPath, 'r');
        const buf = Buffer.alloc(24);
        fs.readSync(fd, buf, 0, 24, 0);
        fs.closeSync(fd);
        hookHeight = buf.readUInt32BE(20);
      } catch {}

      const totalDuration = clips.length > 0
        ? clips.reduce((acc: number, c: any) => acc + (c.duration || 0), 0)
        : (project.source.probe?.duration || 30);
      const hookDur = project.introHook.stayWholeVideo
        ? totalDuration
        : Math.min(totalDuration, project.introHook.duration || 2.5);

      const targetY = Math.max(20, Math.round(canvasHeight * (project.introHook.positionY ?? 0.22) - hookHeight / 2));
      const tr = project.introHook.transition || 'bounce_drop';

      const isStatic = tr === 'static';
      let yExpr = `${targetY}`;
      if (!isStatic && tr === 'bounce_drop') {
        const startY = targetY - 140;
        yExpr = `if(lte(t,0.4),${startY}+140*(t/0.4),${targetY})`;
      } else if (!isStatic && tr === 'slide_down') {
        const startY = targetY - 120;
        yExpr = `if(lte(t,0.35),${startY}+120*(t/0.35),${targetY})`;
      }

      const fadeInDur = isStatic ? 0 : 0.15;
      const fadeOutDur = isStatic ? 0.15 : 0.35;
      const fadeParts: string[] = [];
      if (!isStatic && fadeInDur > 0) {
        fadeParts.push(`fade=t=in:st=0:d=${fadeInDur}:alpha=1`);
      }
      if (!project.introHook.stayWholeVideo && hookDur > fadeOutDur) {
        const fadeOutSt = Math.max(0, hookDur - fadeOutDur).toFixed(2);
        fadeParts.push(`fade=t=out:st=${fadeOutSt}:d=${fadeOutDur}:alpha=1`);
      }

      const fadeFilter = fadeParts.length > 0 ? `,${fadeParts.join(',')}` : '';

      filterChains.push(
        `[${hookInputIndex}:v]format=rgba${fadeFilter}[v_hook_alpha]`
      );
      filterChains.push(
        `${finalVideoStream}[v_hook_alpha]overlay=x=0:y='${yExpr}':shortest=1:enable='between(t,0,${hookDur.toFixed(2)})'[v_hooked]`
      );
      finalVideoStream = '[v_hooked]';
    }
  }

  // Subtitle burning with libass (pixel-perfect viral fonts, word highlights, 2.25x preview size, NO white halo)
  if (hasSubtitles || (!hookOverlaid && hasIntroHook)) {
    const { generateAssSubtitles } = require('../subtitles/assGenerator');
    const assContent = generateAssSubtitles(project, { includeIntroHook: !hookOverlaid });
    const assPath = path.join(projectDir, 'subtitles.ass');
    fs.writeFileSync(assPath, assContent, 'utf-8');

    // Escape Windows file path for FFmpeg subtitles filter: C\:/path/to/file.ass
    const escapedAssPath = assPath.replace(/\\/g, '/').replace(':', '\\:');
    const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
    const fontsdirOpt = fs.existsSync(fontsDir)
      ? `:fontsdir='${fontsDir.replace(/\\/g, '/').replace(':', '\\:')}'`
      : '';

    filterChains.push(
      `${finalVideoStream}subtitles='${escapedAssPath}'${fontsdirOpt}[v_subbed]`
    );
    finalVideoStream = '[v_subbed]';
  }
  const audioSettings = project.audioSettings || {
    keepOriginalAudio: true,
    sourceAudioTrackIndex: 0,
    normalizeLoudness: false,
    duckGameAudio: false,
    backgroundMusicVolume: 0.25,
  };

  const audioTrackIdx = audioSettings.sourceAudioTrackIndex || 0;
  let audioInputMap = `0:a:${audioTrackIdx}?`;
  let finalAudioStream = `[a_out]`;
  let audioCodec = 'copy';
  let audioCodecArgs: string[] = [];

  // Check if any audio filtering is requested
  const hasBgMusic = Boolean(audioSettings.backgroundMusicPath && fs.existsSync(audioSettings.backgroundMusicPath));
  const hasLoudnorm = Boolean(audioSettings.normalizeLoudness);
  const hasDucking = Boolean(audioSettings.duckGameAudio);

  let bgMusicInputIdx = -1;
  if (hasBgMusic && audioSettings.backgroundMusicPath) {
    bgMusicInputIdx = getNextInputIndex();
    inputs.push('-stream_loop', '-1', '-i', audioSettings.backgroundMusicPath);
  }

  const isTrimmed = clips.length === 1 && (clips[0].sourceStart > 0 || clips[0].duration < (project.source.probe?.duration || 10) - 0.1);
  const isMultiClip = clips.length > 1;

  if (hasBgMusic || hasLoudnorm || hasDucking || isTrimmed || isMultiClip) {
    audioCodec = 'aac';
    audioCodecArgs = ['-b:a', '192k'];

    let currentAudioNode = `[0:a:${audioTrackIdx}]`;

    // Audio trimming & concatenation in lockstep with video tracks
    if (isTrimmed) {
      const c = clips[0];
      filterChains.push(
        `[0:a:${audioTrackIdx}]atrim=start=${(c.sourceStart ?? c.start ?? 0).toFixed(2)}:duration=${(c.duration ?? 0).toFixed(2)},asetpts=PTS-STARTPTS[a_trimmed]`
      );
      currentAudioNode = `[a_trimmed]`;
    } else if (isMultiClip) {
      const segStreams: string[] = [];
      clips.forEach((c, idx) => {
        const segStream = `[seg_a_${idx}]`;
        filterChains.push(
          `[0:a:${audioTrackIdx}]atrim=start=${(c.sourceStart ?? c.start ?? 0).toFixed(2)}:duration=${(c.duration ?? 0).toFixed(2)},asetpts=PTS-STARTPTS${segStream}`
        );
        segStreams.push(segStream);
      });

      const transitions = project.transitions || [];
      const hasAnyTransition = clips.some(
        (c, i) =>
          i < clips.length - 1 &&
          transitions.some((t) => t.fromClipId === c.id && t.toClipId === clips[i + 1].id && t.type !== 'cut')
      );

      if (!hasAnyTransition) {
        filterChains.push(
          `${segStreams.join('')}concat=n=${clips.length}:v=0:a=1[a_concatenated]`
        );
      } else {
        let currentAudio = segStreams[0];
        for (let i = 1; i < clips.length; i++) {
          const nextAudio = segStreams[i];
          const tr = transitions.find(
            (t) => t.fromClipId === clips[i - 1].id && t.toClipId === clips[i].id && t.type !== 'cut'
          );
          const outputAudio = i === clips.length - 1 ? '[a_concatenated]' : `[a_chain_${i}]`;
          if (tr) {
            const maxDur = Math.min(clips[i - 1].duration || 1, clips[i].duration || 1) * 0.45;
            const dur = Math.max(0.1, Math.min(tr.duration || 0.5, maxDur));
            filterChains.push(
              `${currentAudio}${nextAudio}acrossfade=d=${dur.toFixed(2)}:c1=tri:c2=tri${outputAudio}`
            );
          } else {
            filterChains.push(`${currentAudio}${nextAudio}concat=n=2:v=0:a=1${outputAudio}`);
          }
          currentAudio = outputAudio;
        }
      }
      currentAudioNode = `[a_concatenated]`;
    }

    if (hasLoudnorm) {
      filterChains.push(`${currentAudioNode}loudnorm=I=-16:TP=-1.5:LRA=11[a_norm]`);
      currentAudioNode = `[a_norm]`;
    }

    if (hasBgMusic && bgMusicInputIdx >= 0) {
      const bgVol = (audioSettings.backgroundMusicVolume ?? 0.25).toFixed(2);
      filterChains.push(
        `[${bgMusicInputIdx}:a]volume=${bgVol}[a_bg]`,
        `${currentAudioNode}[a_bg]amix=inputs=2:duration=first:dropout_transition=2${finalAudioStream}`
      );
    } else {
      filterChains.push(`${currentAudioNode}anull${finalAudioStream}`);
    }
  }

  // Final arguments assemble
  const args: string[] = [
    '-y',
    ...inputs,
    '-filter_complex', filterChains.join(';'),
    '-map', finalVideoStream,
  ];

  if (hasBgMusic || hasLoudnorm || hasDucking || isTrimmed || isMultiClip) {
    args.push('-map', finalAudioStream, '-c:a', audioCodec, ...audioCodecArgs);
  } else {
    // Default rule: Keep original audio untouched (bitstream copy when possible)
    args.push('-map', audioInputMap, '-c:a', 'copy');
  }

  let totalTransitionsOverlap = 0;
  if (clips.length > 1 && project.transitions) {
    for (let i = 0; i < clips.length - 1; i++) {
      const fromClip = clips[i];
      const toClip = clips[i + 1];
      const tr = project.transitions.find(
        (t) => t.fromClipId === fromClip.id && t.toClipId === toClip.id && t.type !== 'cut'
      );
      if (tr) {
        const maxDur = Math.min(fromClip.duration || 1, toClip.duration || 1) * 0.45;
        const dur = Math.max(0.1, Math.min(tr.duration || 0.5, maxDur));
        totalTransitionsOverlap += dur;
      }
    }
  }

  const rawSum = clips.length > 0
    ? clips.reduce((acc, c) => acc + (c.duration || 0), 0)
    : (project.source.probe?.duration || 10);
  const outputDuration = Math.max(0.5, rawSum - totalTransitionsOverlap);

  args.push(
    '-t', outputDuration.toFixed(2),
    '-c:v', videoEncoder,
    ...encoderArgs,
    '-r', String(fps),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath
  );

  return {
    command: 'ffmpeg',
    args,
    outputPath,
  };
}
