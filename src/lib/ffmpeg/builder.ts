import path from 'path';
import fs from 'fs';
import { Project, ExportSettings, LayoutRegion } from '../types';

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

  // Primary source input (index 0)
  inputs.push('-i', project.source.path);

  // Check if secondary media is used (for layouts media_top_game_bottom, media_bottom_game_top)
  let secondaryInputIndex = -1;
  const usesSecondary =
    (project.layout.templateId === 'media_top_game_bottom' ||
      project.layout.templateId === 'media_bottom_game_top') &&
    project.layout.secondaryMediaPath;

  if (usesSecondary && project.layout.secondaryMediaPath) {
    secondaryInputIndex = 1;
    if (project.layout.secondaryMediaType === 'video') {
      // Loop secondary video if shorter than clip
      inputs.push('-stream_loop', '-1', '-i', project.layout.secondaryMediaPath);
    } else {
      // Image or GIF
      inputs.push('-loop', '1', '-i', project.layout.secondaryMediaPath);
    }
  }

  // Check if timeline video track has trims or splits
  const videoTrack = project.tracks.find((t) => t.type === 'video');
  const clips = videoTrack?.clips || [];
  let baseVideoInputNode = '[0:v]';

  // If clips are trimmed or split into multiple segments
  if (clips.length === 1 && (clips[0].sourceStart > 0 || clips[0].duration < (project.source.probe?.duration || 10) - 0.1)) {
    const c = clips[0];
    filterChains.push(
      `[0:v]trim=start=${c.sourceStart.toFixed(2)}:duration=${c.duration.toFixed(2)},setpts=PTS-STARTPTS[v_trimmed]`
    );
    baseVideoInputNode = '[v_trimmed]';
  } else if (clips.length > 1) {
    const segStreams: string[] = [];
    clips.forEach((c, idx) => {
      const segStream = `[seg_v_${idx}]`;
      filterChains.push(
        `[0:v]trim=start=${c.sourceStart.toFixed(2)}:duration=${c.duration.toFixed(2)},setpts=PTS-STARTPTS${segStream}`
      );
      segStreams.push(segStream);
    });
    filterChains.push(
      `${segStreams.join('')}concat=n=${clips.length}:v=1:a=0[v_concatenated]`
    );
    baseVideoInputNode = '[v_concatenated]';
  }

  // Source video dimensions
  const srcW = project.source.probe?.width || 1920;
  const srcH = project.source.probe?.height || 1080;

  // Split input into 2 streams so multi-region layouts can each consume one
  filterChains.push(`${baseVideoInputNode}split=2[v_in_1][v_in_2]`);

  const tpl = project.layout.templateId;
  const splitRatio = project.layout.splitRatio || 0.5;

  let finalVideoStream = '[v_out]';

  function buildCropScaleFilter(
    inputStream: string,
    reg: { crop: { x: number; y: number; width: number; height: number } },
    targetW: number,
    targetH: number,
    outputStream: string
  ): string {
    const targetAspect = targetW / targetH;
    const cropW = makeEven(srcW * reg.crop.width);
    // Strictly lock source crop aspect ratio to target box to guarantee ZERO stretching
    const cropH = makeEven(cropW / targetAspect);
    const cropX = Math.round(srcW * reg.crop.x);
    const cropY = Math.round(srcH * reg.crop.y);

    const needsPadding = cropX < 0 || cropY < 0 || cropX + cropW > srcW || cropY + cropH > srcH;

    if (needsPadding) {
      const padW = srcW * 3;
      const padH = srcH * 3;
      const paddedX = cropX + srcW;
      const paddedY = cropY + srcH;
      return `${inputStream}pad=${padW}:${padH}:${srcW}:${srcH}:color=black,crop=${cropW}:${cropH}:${paddedX}:${paddedY},scale=${targetW}:${targetH},setsar=1${outputStream}`;
    }

    return `${inputStream}crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${targetW}:${targetH},setsar=1${outputStream}`;
  }

  switch (tpl) {
    case 'gameplay_full': {
      const reg = project.layout.regions[0] || {
        crop: { x: 0.2, y: 0, width: 0.6, height: 1 },
      };
      filterChains.push(
        buildCropScaleFilter('[v_in_1]', reg, canvasWidth, canvasHeight, finalVideoStream)
      );
      break;
    }

    case 'split_facecam_top':
    case 'split_gameplay_top': {
      const regTop = project.layout.regions[0];
      const regBottom = project.layout.regions[1];

      const topH = makeEven(canvasHeight * splitRatio);
      const bottomH = makeEven(canvasHeight - topH);

      // Crop top
      filterChains.push(buildCropScaleFilter('[v_in_1]', regTop, canvasWidth, topH, '[v_top]'));

      // Crop bottom
      filterChains.push(buildCropScaleFilter('[v_in_2]', regBottom, canvasWidth, bottomH, '[v_bot]'));

      // Stack top and bottom
      if (project.layout.dividerWidth > 0) {
        const divH = project.layout.dividerWidth;
        const color = project.layout.dividerColor.replace('#', '0x');
        filterChains.push(
          `[v_top][v_bot]vstack=inputs=2[v_stacked]`,
          `[v_stacked]drawbox=x=0:y=${topH - Math.round(divH / 2)}:w=${canvasWidth}:h=${divH}:color=${color}@1:t=fill${finalVideoStream}`
        );
      } else {
        filterChains.push(`[v_top][v_bot]vstack=inputs=2${finalVideoStream}`);
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

      const gameReg = isMediaTop ? project.layout.regions[1] : project.layout.regions[0];
      filterChains.push(buildCropScaleFilter('[v_in_1]', gameReg, canvasWidth, gameH, '[v_game]'));

      if (secondaryInputIndex >= 0) {
        filterChains.push(
          `[${secondaryInputIndex}:v]scale=${canvasWidth}:${mediaH}:force_original_aspect_ratio=decrease,pad=${canvasWidth}:${mediaH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v_media]`
        );
      } else {
        filterChains.push(`color=c=0x1E293B:s=${canvasWidth}x${mediaH}:duration=10[v_media]`);
      }

      const topStream = isMediaTop ? '[v_media]' : '[v_game]';
      const botStream = isMediaTop ? '[v_game]' : '[v_media]';

      if (project.layout.dividerWidth > 0) {
        const divH = project.layout.dividerWidth;
        const color = project.layout.dividerColor.replace('#', '0x');
        filterChains.push(
          `${topStream}${botStream}vstack=inputs=2[v_stacked]`,
          `[v_stacked]drawbox=x=0:y=${topH - Math.round(divH / 2)}:w=${canvasWidth}:h=${divH}:color=${color}@1:t=fill${finalVideoStream}`
        );
      } else {
        filterChains.push(`${topStream}${botStream}vstack=inputs=2${finalVideoStream}`);
      }
      break;
    }

    case 'blurred_background_fit': {
      // 1. Zoomed, cropped, heavily blurred background filling 1080x1920
      filterChains.push(
        `[v_in_1]scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=increase,crop=${canvasWidth}:${canvasHeight},boxblur=25:5[v_blur_bg]`
      );

      // 2. Crisp centered video scaled to fit with padding or margin
      const targetW = makeEven(canvasWidth * 0.96);
      filterChains.push(
        `[v_in_2]scale=${targetW}:-2,setsar=1[v_crisp_fg]`,
        `[v_blur_bg][v_crisp_fg]overlay=(W-w)/2:(H-h)/2${finalVideoStream}`
      );
      break;
    }

    case 'picture_in_picture': {
      // Main gameplay fills canvas
      const mainReg = project.layout.regions[0];
      const pipReg = project.layout.regions[1];

      filterChains.push(buildCropScaleFilter('[v_in_1]', mainReg, canvasWidth, canvasHeight, '[v_base]'));

      // PiP Overlay Facecam
      const pipBounds = pipReg.targetBounds;
      const pipW = makeEven(canvasWidth * pipBounds.width);
      const pipH = makeEven(canvasHeight * pipBounds.height);
      const pipX = Math.round(canvasWidth * pipBounds.x);
      const pipY = Math.round(canvasHeight * pipBounds.y);

      filterChains.push(buildCropScaleFilter('[v_in_2]', pipReg, pipW, pipH, '[v_pip_raw]'));

      let pipChain = `[v_pip_raw]`;
      if (pipReg.borderWidth && pipReg.borderWidth > 0) {
        pipChain += `drawbox=x=0:y=0:w=${pipW}:h=${pipH}:color=white@1:t=${pipReg.borderWidth},`;
      }
      pipChain += `setsar=1[v_pip]`;
      filterChains.push(pipChain);

      filterChains.push(`[v_base][v_pip]overlay=${pipX}:${pipY}${finalVideoStream}`);
      break;
    }
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

  // Intro hook text overlay (first 1-3 seconds)
  if (project.introHook?.enabled && project.introHook.text) {
    const hookText = project.introHook.text.replace(/'/g, '').replace(/:/g, '').trim();
    const hookDur = project.introHook.duration || 2.5;
    const hookColor = (project.introHook.color || '#FFE600').replace('#', '0x');
    const hookFontSize = Math.round((project.introHook.fontSize || 56) * 1.0);
    filterChains.push(
      `${finalVideoStream}drawtext=text='${hookText}':fontsize=${hookFontSize}:fontcolor=${hookColor}:box=1:boxcolor=black@0.75:boxborderw=16:x=(w-text_w)/2:y=h*0.22:enable='between(t,0,${hookDur})'[v_hook]`
    );
    finalVideoStream = '[v_hook]';
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

  // Subtitle burning with libass
  if (project.subtitles && project.subtitles.length > 0) {
    const { generateAssSubtitles } = require('../subtitles/assGenerator');
    const assContent = generateAssSubtitles(project);
    const assPath = path.join(projectDir, 'subtitles.ass');
    fs.writeFileSync(assPath, assContent, 'utf-8');

    // Escape Windows file path for FFmpeg subtitles filter: C\:/path/to/file.ass
    const escapedAssPath = assPath.replace(/\\/g, '/').replace(':', '\\:');
    filterChains.push(
      `${finalVideoStream}subtitles='${escapedAssPath}'[v_subbed]`
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
    bgMusicInputIdx = inputs.length / 2; // current count of inputs
    inputs.push('-stream_loop', '-1', '-i', audioSettings.backgroundMusicPath);
  }

  if (hasBgMusic || hasLoudnorm || hasDucking) {
    audioCodec = 'aac';
    audioCodecArgs = ['-b:a', '192k'];

    let currentAudioNode = `[0:a:${audioTrackIdx}]`;

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

  if (hasBgMusic || hasLoudnorm || hasDucking) {
    args.push('-map', finalAudioStream, '-c:a', audioCodec, ...audioCodecArgs);
  } else {
    // Default rule: Keep original audio untouched (bitstream copy when possible)
    args.push('-map', audioInputMap, '-c:a', 'copy');
  }

  args.push(
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
