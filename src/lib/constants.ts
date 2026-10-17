import { LayoutConfig, SubtitleStyle, Project, CanvasConfig, LayoutTemplateId } from './types';

export const DEFAULT_CANVAS: CanvasConfig = {
  width: 1080,
  height: 1920,
  fps: 30,
  aspectRatio: '9:16',
};

export const CANVAS_PRESETS: Record<string, CanvasConfig> = {
  '9:16': { width: 1080, height: 1920, fps: 30, aspectRatio: '9:16' },
  '1:1': { width: 1080, height: 1080, fps: 30, aspectRatio: '1:1' },
  '16:9': { width: 1920, height: 1080, fps: 30, aspectRatio: '16:9' },
};

export const BUILT_IN_FONTS = [
  { name: 'Inter', label: 'Inter (Clean & Modern)' },
  { name: 'Montserrat', label: 'Montserrat (Bold Viral)' },
  { name: 'Impact', label: 'Impact (Classic Meme/Shorts)' },
  { name: 'Arial Black', label: 'Arial Black (Heavy Punch)' },
  { name: 'Trebuchet MS', label: 'Trebuchet MS (Dynamic)' },
  { name: 'Verdana', label: 'Verdana (Legible)' },
];

export const SUBTITLE_PRESETS: Record<string, SubtitleStyle> = {
  bold_white: {
    fontFamily: 'Montserrat',
    fontSize: 54,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFE600',
    outlineColor: '#000000',
    outlineWidth: 4,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowDistance: 2,
    textTransform: 'uppercase',
    position: 'bottom',
    verticalOffset: -120,
    maxWordsPerLine: 4,
    lineSpacing: 1.2,
    animation: 'karaoke_highlight',
  },
  yellow_active: {
    fontFamily: 'Impact',
    fontSize: 58,
    primaryColor: '#FFFFFF',
    highlightColor: '#22C55E',
    outlineColor: '#000000',
    outlineWidth: 5,
    shadowColor: 'rgba(0,0,0,0.9)',
    shadowDistance: 3,
    textTransform: 'uppercase',
    position: 'middle',
    verticalOffset: 60,
    maxWordsPerLine: 3,
    lineSpacing: 1.1,
    animation: 'karaoke_highlight',
  },
  boxed_modern: {
    fontFamily: 'Inter',
    fontSize: 44,
    primaryColor: '#FFFFFF',
    highlightColor: '#38BDF8',
    outlineColor: '#000000',
    outlineWidth: 0,
    shadowColor: 'transparent',
    shadowDistance: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    backgroundPadding: 16,
    backgroundBorderRadius: 10,
    textTransform: 'none',
    position: 'bottom',
    verticalOffset: -140,
    maxWordsPerLine: 5,
    lineSpacing: 1.3,
    animation: 'pop_in',
  },
  minimal: {
    fontFamily: 'Inter',
    fontSize: 42,
    primaryColor: '#F8FAFC',
    highlightColor: '#F59E0B',
    outlineColor: '#0F172A',
    outlineWidth: 2,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowDistance: 2,
    textTransform: 'none',
    position: 'bottom',
    verticalOffset: -100,
    maxWordsPerLine: 6,
    lineSpacing: 1.2,
    animation: 'fade',
  },
  neon_cyber: {
    fontFamily: 'Montserrat',
    fontSize: 52,
    primaryColor: '#E0E7FF',
    highlightColor: '#EC4899',
    outlineColor: '#4F46E5',
    outlineWidth: 4,
    shadowColor: '#818CF8',
    shadowDistance: 4,
    textTransform: 'uppercase',
    position: 'bottom',
    verticalOffset: -130,
    maxWordsPerLine: 4,
    lineSpacing: 1.2,
    animation: 'karaoke_highlight',
  },
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = SUBTITLE_PRESETS.bold_white;

export function getLayoutTemplate(templateId: LayoutTemplateId, splitRatio = 0.5): LayoutConfig {
  switch (templateId) {
    case 'gameplay_full':
      return {
        templateId,
        splitRatio: 1.0,
        dividerWidth: 0,
        dividerColor: '#000000',
        regions: [
          {
            id: 'reg_full',
            label: 'Gameplay Full Frame',
            sourceType: 'primary',
            targetBounds: { x: 0, y: 0, width: 1, height: 1 },
            crop: { x: 0.2, y: 0, width: 0.6, height: 1 }, // center 9:16 crop of 16:9
            fit: 'cover',
          },
        ],
      };

    case 'split_facecam_top': {
      const topAspect = 1080 / Math.max(1, 1920 * splitRatio);
      const botAspect = 1080 / Math.max(1, 1920 * (1 - splitRatio));
      const srcAspect = 1920 / 1080;

      // Facecam: 35% width, height derived from topAspect
      const camW = 0.35;
      const camH = parseFloat(((camW * srcAspect) / topAspect).toFixed(3));

      // Gameplay: fill height (1.0), width derived from botAspect
      let gameH = 1.0;
      let gameW = parseFloat(((gameH * botAspect) / srcAspect).toFixed(3));
      if (gameW > 1.0) {
        gameW = 1.0;
        gameH = parseFloat(((gameW * srcAspect) / botAspect).toFixed(3));
      }
      const gameX = parseFloat(((1 - gameW) / 2).toFixed(3));

      return {
        templateId,
        splitRatio,
        dividerWidth: 4,
        dividerColor: '#3B82F6',
        regions: [
          {
            id: 'reg_cam_top',
            label: 'Facecam (Top)',
            sourceType: 'primary',
            targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
            crop: { x: 0.60, y: 0.05, width: camW, height: camH }, // top right facecam unstretched
            fit: 'cover',
          },
          {
            id: 'reg_game_bottom',
            label: 'Gameplay (Bottom)',
            sourceType: 'primary',
            targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
            crop: { x: gameX, y: 0, width: gameW, height: gameH }, // centered gameplay unstretched
            fit: 'cover',
          },
        ],
      };
    }

    case 'split_gameplay_top': {
      const topAspect = 1080 / Math.max(1, 1920 * splitRatio);
      const botAspect = 1080 / Math.max(1, 1920 * (1 - splitRatio));
      const srcAspect = 1920 / 1080;

      let gameH = 1.0;
      let gameW = parseFloat(((gameH * topAspect) / srcAspect).toFixed(3));
      if (gameW > 1.0) {
        gameW = 1.0;
        gameH = parseFloat(((gameW * srcAspect) / topAspect).toFixed(3));
      }
      const gameX = parseFloat(((1 - gameW) / 2).toFixed(3));

      const camW = 0.35;
      const camH = parseFloat(((camW * srcAspect) / botAspect).toFixed(3));

      return {
        templateId,
        splitRatio,
        dividerWidth: 4,
        dividerColor: '#3B82F6',
        regions: [
          {
            id: 'reg_game_top',
            label: 'Gameplay (Top)',
            sourceType: 'primary',
            targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
            crop: { x: gameX, y: 0, width: gameW, height: gameH },
            fit: 'cover',
          },
          {
            id: 'reg_cam_bottom',
            label: 'Facecam (Bottom)',
            sourceType: 'primary',
            targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
            crop: { x: 0.60, y: 0.05, width: camW, height: camH },
            fit: 'cover',
          },
        ],
      };
    }

    case 'media_top_game_bottom':
      return {
        templateId,
        splitRatio,
        dividerWidth: 4,
        dividerColor: '#10B981',
        regions: [
          {
            id: 'reg_media_top',
            label: 'Extra Media (Top)',
            sourceType: 'secondary_media',
            targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
            crop: { x: 0, y: 0, width: 1, height: 1 },
            fit: 'contain',
          },
          {
            id: 'reg_game_bottom',
            label: 'Gameplay / Cam (Bottom)',
            sourceType: 'primary',
            targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
            crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
            fit: 'cover',
          },
        ],
      };

    case 'media_bottom_game_top':
      return {
        templateId,
        splitRatio,
        dividerWidth: 4,
        dividerColor: '#10B981',
        regions: [
          {
            id: 'reg_game_top',
            label: 'Gameplay / Cam (Top)',
            sourceType: 'primary',
            targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
            crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
            fit: 'cover',
          },
          {
            id: 'reg_media_bottom',
            label: 'Extra Media (Bottom)',
            sourceType: 'secondary_media',
            targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
            crop: { x: 0, y: 0, width: 1, height: 1 },
            fit: 'contain',
          },
        ],
      };

    case 'blurred_background_fit':
      return {
        templateId,
        splitRatio: 1.0,
        dividerWidth: 0,
        dividerColor: 'transparent',
        regions: [
          {
            id: 'reg_blur_bg',
            label: 'Blurred Background',
            sourceType: 'primary',
            targetBounds: { x: 0, y: 0, width: 1, height: 1 },
            crop: { x: 0, y: 0, width: 1, height: 1 },
            fit: 'cover',
            blurBackground: true,
          },
          {
            id: 'reg_fit_center',
            label: 'Centered Crisp Video',
            sourceType: 'primary',
            targetBounds: { x: 0.05, y: 0.25, width: 0.9, height: 0.5 },
            crop: { x: 0, y: 0, width: 1, height: 1 },
            fit: 'contain',
            borderRadius: 12,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.2)',
          },
        ],
      };

    case 'picture_in_picture':
      return {
        templateId,
        splitRatio: 1.0,
        dividerWidth: 0,
        dividerColor: 'transparent',
        regions: [
          {
            id: 'reg_pip_main',
            label: 'Main Gameplay',
            sourceType: 'primary',
            targetBounds: { x: 0, y: 0, width: 1, height: 1 },
            crop: { x: 0.2, y: 0, width: 0.6, height: 1 },
            fit: 'cover',
          },
          {
            id: 'reg_pip_cam',
            label: 'Facecam Overlay',
            sourceType: 'primary',
            targetBounds: { x: 0.06, y: 0.08, width: 0.42, height: 0.28 },
            crop: { x: 0.7, y: 0.05, width: 0.28, height: 0.4 },
            fit: 'cover',
            borderRadius: 16,
            borderWidth: 4,
            borderColor: '#FFFFFF',
          },
        ],
      };
  }
}

export function createDefaultProject(id: string, name: string, sourcePath: string, originalFileName: string, probe: any): Project {
  const duration = probe?.duration || 10;
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    canvas: { ...DEFAULT_CANVAS },
    source: {
      path: sourcePath,
      originalFileName,
      probe,
    },
    layout: getLayoutTemplate('split_facecam_top', 0.45),
    tracks: [
      {
        id: 'track_video_main',
        name: 'Main Video',
        type: 'video',
        order: 0,
        clips: [
          {
            id: 'clip_source_1',
            type: 'video',
            trackId: 'track_video_main',
            start: 0,
            duration: duration,
            sourceStart: 0,
            sourceDuration: duration,
            mediaPath: sourcePath,
          },
        ],
      },
      {
        id: 'track_audio_main',
        name: 'Audio Track',
        type: 'audio',
        order: 1,
        clips: [
          {
            id: 'clip_audio_1',
            type: 'audio',
            trackId: 'track_audio_main',
            start: 0,
            duration: duration,
            sourceStart: 0,
            sourceDuration: duration,
            mediaPath: sourcePath,
          },
        ],
      },
    ],
    subtitles: [],
    subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
    audioSettings: {
      keepOriginalAudio: true,
      sourceAudioTrackIndex: 0,
      normalizeLoudness: false,
      duckGameAudio: false,
      duckingThresholdDb: -22,
      duckingAmountDb: -14,
      backgroundMusicVolume: 0.25,
    },
    transitions: [],
    introHook: {
      enabled: false,
      text: 'WATCH TILL THE END! 🔥',
      duration: 2.5,
      fontSize: 56,
      color: '#FFE600',
    },
    watermark: {
      enabled: false,
      opacity: 0.8,
      position: 'top-right',
      scale: 0.2,
    },
    exportSettings: {
      resolution: '1080p',
      fps: 30,
      quality: 'high',
      hwAccel: 'auto',
      outputFileName: `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}_short.mp4`,
    },
  };
}
