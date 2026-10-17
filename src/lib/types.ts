export type AspectRatio = '9:16' | '1:1' | '16:9';

export interface CanvasConfig {
  width: number;
  height: number;
  fps: number;
  aspectRatio: AspectRatio;
}

export interface AudioTrackInfo {
  index: number;
  title?: string;
  language?: string;
  channels: number;
  codec: string;
}

export interface MediaProbe {
  width: number;
  height: number;
  duration: number; // in seconds
  fps: number;
  codec: string;
  bitrate: number;
  hasAudio: boolean;
  audioCodec?: string;
  audioChannels?: number;
  audioTracks: AudioTrackInfo[];
}

export interface CropRect {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  width: number; // 0..1
  height: number; // 0..1
}

export type FitMode = 'cover' | 'contain' | 'fill';

export interface LayoutRegion {
  id: string;
  label: string;
  sourceType: 'primary' | 'secondary_media';
  targetBounds: { x: number; y: number; width: number; height: number }; // normalized in canvas (0..1)
  crop: CropRect;
  fit: FitMode;
  borderRadius?: number; // px
  borderWidth?: number; // px
  borderColor?: string;
  blurBackground?: boolean;
}

export type LayoutTemplateId =
  | 'gameplay_full'
  | 'split_facecam_top'
  | 'split_gameplay_top'
  | 'media_top_game_bottom'
  | 'media_bottom_game_top'
  | 'blurred_background_fit'
  | 'picture_in_picture';

export interface LayoutConfig {
  templateId: LayoutTemplateId;
  splitRatio: number; // e.g. 0.5 (50/50), 0.6 (60/40)
  dividerWidth: number; // px
  dividerColor: string;
  regions: LayoutRegion[];
  secondaryMediaPath?: string;
  secondaryMediaType?: 'image' | 'video' | 'gif';
}

export interface SubtitleWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface SubtitleItem {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
  words?: SubtitleWord[];
}

export type SubtitleAnimation = 'none' | 'karaoke_highlight' | 'pop_in' | 'fade' | 'typewriter';

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number; // e.g. 52
  primaryColor: string; // e.g. #FFFFFF
  highlightColor: string; // active word e.g. #FFE600
  outlineColor: string; // e.g. #000000
  outlineWidth: number; // e.g. 3
  shadowColor: string;
  shadowDistance: number;
  backgroundColor?: string;
  backgroundPadding?: number;
  backgroundBorderRadius?: number;
  textTransform: 'none' | 'uppercase' | 'lowercase';
  position: 'top' | 'middle' | 'bottom';
  verticalOffset: number; // fine adjustment in px
  maxWordsPerLine: number;
  lineSpacing: number;
  animation: SubtitleAnimation;
}

export interface AudioSettings {
  keepOriginalAudio: boolean; // default: true
  sourceAudioTrackIndex: number;
  normalizeLoudness: boolean; // default: false
  duckGameAudio: boolean; // default: false
  duckingThresholdDb: number; // default: -22
  duckingAmountDb: number; // default: -14
  backgroundMusicPath?: string;
  backgroundMusicVolume: number; // 0..1, default: 0.25
}

export interface TransformKeyframe {
  time: number; // seconds relative to clip start
  scale: number;
  x: number;
  y: number;
  rotation?: number;
}

export type ClipType = 'video' | 'audio' | 'image' | 'gif' | 'text' | 'subtitle' | 'effect';

export interface EffectConfig {
  id: string;
  type: 'zoom' | 'punch_in' | 'shake' | 'flash' | 'vignette' | 'blur' | 'saturation_contrast' | 'freeze';
  start: number;
  duration: number;
  params: Record<string, number | string | boolean>;
}

export type TransitionType = 'cut' | 'fade' | 'crossfade' | 'slide_left' | 'slide_up' | 'zoom' | 'wipe' | 'glitch';

export interface TransitionConfig {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: TransitionType;
  duration: number; // e.g. 0.5s
}

export interface TimelineClip {
  id: string;
  type: ClipType;
  trackId: string;
  start: number; // timeline start (seconds)
  duration: number; // timeline duration (seconds)
  sourceStart: number; // source media start (seconds)
  sourceDuration: number;
  mediaPath?: string;
  text?: string;
  effects?: EffectConfig[];
  keyframes?: TransformKeyframe[];
  speed?: number; // 0.5 .. 2.0
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: ClipType;
  order: number;
  isMuted?: boolean;
  isLocked?: boolean;
  clips: TimelineClip[];
}

export interface ExportSettings {
  resolution: '720p' | '1080p';
  fps: 'source' | 30 | 60;
  quality: 'fast' | 'balanced' | 'high';
  hwAccel: 'auto' | 'nvenc' | 'videotoolbox' | 'qsv' | 'cpu';
  outputFileName: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  canvas: CanvasConfig;
  source: {
    path: string;
    originalFileName: string;
    probe: MediaProbe;
    twitchUrl?: string;
  };
  layout: LayoutConfig;
  tracks: TimelineTrack[];
  subtitles: SubtitleItem[];
  subtitleStyle: SubtitleStyle;
  audioSettings: AudioSettings;
  transitions: TransitionConfig[];
  introHook?: {
    enabled: boolean;
    text: string;
    duration: number;
    fontSize: number;
    color: string;
  };
  watermark?: {
    enabled: boolean;
    imagePath?: string;
    opacity: number;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    scale: number;
  };
  exportSettings: ExportSettings;
}

export interface JobProgress {
  id: string;
  projectId?: string;
  type: 'twitch_download' | 'transcription' | 'export' | 'silence_detect';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0..100
  stage: string;
  message?: string;
  etaSeconds?: number;
  resultUrl?: string;
  error?: string;
}

export interface SystemCheckResult {
  ffmpeg: {
    installed: boolean;
    version?: string;
    hwAccelSupport?: string[];
  };
  ffprobe: {
    installed: boolean;
    version?: string;
  };
  ytDlp: {
    installed: boolean;
    version?: string;
  };
  whisper: {
    installed: boolean;
    engine?: 'faster-whisper' | 'whisper' | 'none';
  };
}
