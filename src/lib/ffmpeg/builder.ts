import path from 'path';
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

  // Source video dimensions
  const srcW = project.source.probe?.width || 1920;
  const srcH = project.source.probe?.height || 1080;

  const tpl = project.layout.templateId;
  const splitRatio = project.layout.splitRatio || 0.5;

  let finalVideoStream = '[v_out]';

  switch (tpl) {
    case 'gameplay_full': {
      const reg = project.layout.regions[0] || {
        crop: { x: 0.2, y: 0, width: 0.6, height: 1 },
      };
      const cropW = makeEven(srcW * reg.crop.width);
      const cropH = makeEven(srcH * reg.crop.height);
      const cropX = Math.round(srcW * reg.crop.x);
      const cropY = Math.round(srcH * reg.crop.y);

      filterChains.push(
        `[0:v]crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${canvasWidth}:${canvasHeight},setsar=1${finalVideoStream}`
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
      const topCropW = makeEven(srcW * regTop.crop.width);
      const topCropH = makeEven(srcH * regTop.crop.height);
      const topCropX = Math.round(srcW * regTop.crop.x);
      const topCropY = Math.round(srcH * regTop.crop.y);
      filterChains.push(
        `[0:v]crop=${topCropW}:${topCropH}:${topCropX}:${topCropY},scale=${canvasWidth}:${topH},setsar=1[v_top]`
      );

      // Crop bottom
      const botCropW = makeEven(srcW * regBottom.crop.width);
      const botCropH = makeEven(srcH * regBottom.crop.height);
      const botCropX = Math.round(srcW * regBottom.crop.x);
      const botCropY = Math.round(srcH * regBottom.crop.y);
      filterChains.push(
        `[0:v]crop=${botCropW}:${botCropH}:${botCropX}:${botCropY},scale=${canvasWidth}:${bottomH},setsar=1[v_bot]`
      );

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
      const gCropW = makeEven(srcW * gameReg.crop.width);
      const gCropH = makeEven(srcH * gameReg.crop.height);
      const gCropX = Math.round(srcW * gameReg.crop.x);
      const gCropY = Math.round(srcH * gameReg.crop.y);

      filterChains.push(
        `[0:v]crop=${gCropW}:${gCropH}:${gCropX}:${gCropY},scale=${canvasWidth}:${gameH},setsar=1[v_game]`
      );

      if (secondaryInputIndex >= 0) {
        // Scale secondary media to slot
        filterChains.push(
          `[${secondaryInputIndex}:v]scale=${canvasWidth}:${mediaH}:force_original_aspect_ratio=decrease,pad=${canvasWidth}:${mediaH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v_media]`
        );
      } else {
        // Fallback color box if no media attached yet
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
        `[0:v]scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=increase,crop=${canvasWidth}:${canvasHeight},boxblur=25:5[v_blur_bg]`
      );

      // 2. Crisp centered video scaled to fit with padding or margin
      const targetW = makeEven(canvasWidth * 0.96);
      filterChains.push(
        `[0:v]scale=${targetW}:-2,setsar=1[v_crisp_fg]`,
        `[v_blur_bg][v_crisp_fg]overlay=(W-w)/2:(H-h)/2${finalVideoStream}`
      );
      break;
    }

    case 'picture_in_picture': {
      // Main gameplay fills canvas
      const mainReg = project.layout.regions[0];
      const pipReg = project.layout.regions[1];

      const mCropW = makeEven(srcW * mainReg.crop.width);
      const mCropH = makeEven(srcH * mainReg.crop.height);
      const mCropX = Math.round(srcW * mainReg.crop.x);
      const mCropY = Math.round(srcH * mainReg.crop.y);

      filterChains.push(
        `[0:v]crop=${mCropW}:${mCropH}:${mCropX}:${mCropY},scale=${canvasWidth}:${canvasHeight},setsar=1[v_base]`
      );

      // PiP Overlay Facecam
      const pipBounds = pipReg.targetBounds;
      const pipW = makeEven(canvasWidth * pipBounds.width);
      const pipH = makeEven(canvasHeight * pipBounds.height);
      const pipX = Math.round(canvasWidth * pipBounds.x);
      const pipY = Math.round(canvasHeight * pipBounds.y);

      const pCropW = makeEven(srcW * pipReg.crop.width);
      const pCropH = makeEven(srcH * pipReg.crop.height);
      const pCropX = Math.round(srcW * pipReg.crop.x);
      const pCropY = Math.round(srcH * pipReg.crop.y);

      let pipChain = `[0:v]crop=${pCropW}:${pCropH}:${pCropX}:${pCropY},scale=${pipW}:${pipH},setsar=1`;
      if (pipReg.borderWidth && pipReg.borderWidth > 0) {
        pipChain += `,drawbox=x=0:y=0:w=${pipW}:h=${pipH}:color=white@1:t=${pipReg.borderWidth}`;
      }
      pipChain += `[v_pip]`;
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

  // Final arguments assemble
  const args: string[] = [
    '-y',
    ...inputs,
    '-filter_complex', filterChains.join(';'),
    '-map', finalVideoStream,
    '-map', '0:a:0?', // Map first audio track if present
    '-c:v', videoEncoder,
    ...encoderArgs,
    '-r', String(fps),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputPath,
  ];

  return {
    command: 'ffmpeg',
    args,
    outputPath,
  };
}
