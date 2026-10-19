const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Mock project factory for testing
function createMockProject(templateId, splitRatio = 0.5) {
  const layouts = {
    gameplay_full: {
      templateId: 'gameplay_full',
      splitRatio: 1.0,
      dividerWidth: 0,
      dividerColor: '#000000',
      regions: [
        {
          id: 'reg_full',
          label: 'Gameplay Full Frame',
          sourceType: 'primary',
          targetBounds: { x: 0, y: 0, width: 1, height: 1 },
          crop: { x: 0.2, y: 0, width: 0.6, height: 1 },
          fit: 'cover',
        },
      ],
    },
    split_facecam_top: {
      templateId: 'split_facecam_top',
      splitRatio,
      dividerWidth: 4,
      dividerColor: '#3B82F6',
      regions: [
        {
          id: 'reg_cam',
          label: 'Facecam (Top)',
          sourceType: 'primary',
          targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
          crop: { x: 0.7, y: 0.05, width: 0.28, height: 0.4 },
          fit: 'cover',
        },
        {
          id: 'reg_game',
          label: 'Gameplay (Bottom)',
          sourceType: 'primary',
          targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
          crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          fit: 'cover',
        },
      ],
    },
    split_gameplay_top: {
      templateId: 'split_gameplay_top',
      splitRatio,
      dividerWidth: 4,
      dividerColor: '#3B82F6',
      regions: [
        {
          id: 'reg_game',
          label: 'Gameplay (Top)',
          sourceType: 'primary',
          targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
          crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          fit: 'cover',
        },
        {
          id: 'reg_cam',
          label: 'Facecam (Bottom)',
          sourceType: 'primary',
          targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
          crop: { x: 0.7, y: 0.05, width: 0.28, height: 0.4 },
          fit: 'cover',
        },
      ],
    },
    media_top_game_bottom: {
      templateId: 'media_top_game_bottom',
      splitRatio,
      dividerWidth: 4,
      dividerColor: '#10B981',
      regions: [
        {
          id: 'reg_media',
          label: 'Media (Top)',
          sourceType: 'secondary_media',
          targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
          crop: { x: 0, y: 0, width: 1, height: 1 },
          fit: 'contain',
        },
        {
          id: 'reg_game',
          label: 'Gameplay (Bottom)',
          sourceType: 'primary',
          targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
          crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          fit: 'cover',
        },
      ],
    },
    media_bottom_game_top: {
      templateId: 'media_bottom_game_top',
      splitRatio,
      dividerWidth: 4,
      dividerColor: '#10B981',
      regions: [
        {
          id: 'reg_game',
          label: 'Gameplay (Top)',
          sourceType: 'primary',
          targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
          crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          fit: 'cover',
        },
        {
          id: 'reg_media',
          label: 'Media (Bottom)',
          sourceType: 'secondary_media',
          targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
          crop: { x: 0, y: 0, width: 1, height: 1 },
          fit: 'contain',
        },
      ],
    },
    blurred_background_fit: {
      templateId: 'blurred_background_fit',
      splitRatio: 1.0,
      dividerWidth: 0,
      dividerColor: 'transparent',
      regions: [
        {
          id: 'reg_blur',
          label: 'Blurred Background',
          sourceType: 'primary',
          targetBounds: { x: 0, y: 0, width: 1, height: 1 },
          crop: { x: 0, y: 0, width: 1, height: 1 },
          fit: 'cover',
          blurBackground: true,
        },
        {
          id: 'reg_fg',
          label: 'Crisp Center',
          sourceType: 'primary',
          targetBounds: { x: 0.05, y: 0.25, width: 0.9, height: 0.5 },
          crop: { x: 0, y: 0, width: 1, height: 1 },
          fit: 'contain',
        },
      ],
    },
    picture_in_picture: {
      templateId: 'picture_in_picture',
      splitRatio: 1.0,
      dividerWidth: 0,
      dividerColor: 'transparent',
      regions: [
        {
          id: 'reg_pip_main',
          label: 'Main',
          sourceType: 'primary',
          targetBounds: { x: 0, y: 0, width: 1, height: 1 },
          crop: { x: 0.2, y: 0, width: 0.6, height: 1 },
          fit: 'cover',
        },
        {
          id: 'reg_pip_cam',
          label: 'Facecam PiP',
          sourceType: 'primary',
          targetBounds: { x: 0.05, y: 0.05, width: 0.4, height: 0.3 },
          crop: { x: 0.7, y: 0.05, width: 0.28, height: 0.4 },
          fit: 'cover',
          borderWidth: 4,
        },
      ],
    },
  };

  return {
    id: 'test_project',
    name: 'Test Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    canvas: { width: 1080, height: 1920, fps: 30, aspectRatio: '9:16' },
    source: {
      path: path.resolve(__dirname, 'mock_source.mp4'),
      originalFileName: 'mock_source.mp4',
      probe: {
        width: 1920,
        height: 1080,
        duration: 10,
        fps: 30,
        codec: 'h264',
        bitrate: 4000000,
        hasAudio: true,
        audioTracks: [{ index: 0, title: 'Track 1', language: 'und', channels: 2, codec: 'aac' }],
      },
    },
    layout: layouts[templateId],
    tracks: [],
    subtitles: [],
    subtitleStyle: {
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
    exportSettings: {
      resolution: '1080p',
      fps: 30,
      quality: 'high',
      hwAccel: 'cpu',
      outputFileName: 'test_export.mp4',
    },
  };
}

// Simple direct test of filtergraph builder logic
test('FFmpeg Builder generates valid filtergraph for Gameplay Full Frame', () => {
  const { buildFFmpegExportCommand } = require('../src/lib/ffmpeg/builder.ts');
  const project = createMockProject('gameplay_full');
  const plan = buildFFmpegExportCommand(project);

  assert.ok(plan.args.includes('-filter_complex'));
  const fcIndex = plan.args.indexOf('-filter_complex');
  const filtergraph = plan.args[fcIndex + 1];

  assert.match(filtergraph, /crop=\d+:\d+:\d+:\d+/);
  assert.match(filtergraph, /scale=1080:1920/);
  assert.ok(plan.args.includes('yuv420p'));
  assert.ok(plan.args.includes('+faststart'));
});

test('FFmpeg Builder generates valid filtergraph for Split Facecam Top', () => {
  const { buildFFmpegExportCommand } = require('../src/lib/ffmpeg/builder.ts');
  const project = createMockProject('split_facecam_top', 0.45);
  const plan = buildFFmpegExportCommand(project);

  const filtergraph = plan.args[plan.args.indexOf('-filter_complex') + 1];
  assert.match(filtergraph, /vstack=inputs=2/);
  assert.match(filtergraph, /drawbox=/);
  assert.match(filtergraph, /\[v_top/);
  assert.match(filtergraph, /\[v_bot/);
});

test('FFmpeg Builder generates valid filtergraph for Blurred Background Fit', () => {
  const { buildFFmpegExportCommand } = require('../src/lib/ffmpeg/builder.ts');
  const project = createMockProject('blurred_background_fit');
  const plan = buildFFmpegExportCommand(project);

  const filtergraph = plan.args[plan.args.indexOf('-filter_complex') + 1];
  assert.match(filtergraph, /boxblur=/);
  assert.match(filtergraph, /overlay=/);
  assert.match(filtergraph, /scale=1080:1920/);
});

test('FFmpeg Builder generates valid filtergraph for Picture-in-Picture', () => {
  const { buildFFmpegExportCommand } = require('../src/lib/ffmpeg/builder.ts');
  const project = createMockProject('picture_in_picture');
  const plan = buildFFmpegExportCommand(project);

  const filtergraph = plan.args[plan.args.indexOf('-filter_complex') + 1];
  assert.match(filtergraph, /\[v_base/);
  assert.match(filtergraph, /\[v_pip/);
  assert.match(filtergraph, /overlay=/);
});
