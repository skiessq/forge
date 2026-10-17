import test from 'node:test';
import assert from 'node:assert';
import { buildFFmpegExportCommand } from '../src/lib/ffmpeg/builder';
import { ProjectState } from '../src/lib/types';

function makeSplitProject(splitRatio: number): ProjectState {
  return {
    id: 'test_split_project',
    name: 'Test Split Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    canvas: { width: 1080, height: 1920, fps: 30, aspectRatio: '9:16' },
    source: {
      path: 'c:/mock_source.mp4',
      originalFileName: 'mock.mp4',
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
    layout: {
      templateId: 'split_facecam_top',
      splitRatio,
      dividerWidth: 4,
      dividerColor: '#3B82F6',
      regions: [
        {
          id: 'reg_cam_top',
          label: 'Facecam (Top)',
          sourceType: 'primary',
          targetBounds: { x: 0, y: 0, width: 1, height: splitRatio },
          crop: { x: 0.6, y: 0.05, width: 0.35, height: 0.4 },
          fit: 'cover',
        },
        {
          id: 'reg_game_bottom',
          label: 'Gameplay (Bottom)',
          sourceType: 'primary',
          targetBounds: { x: 0, y: splitRatio, width: 1, height: 1 - splitRatio },
          crop: { x: 0.28, y: 0, width: 0.42, height: 1.0 },
          fit: 'cover',
        },
      ],
    },
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
      outputFileName: 'split_test.mp4',
    },
  };
}

test('Split 25/75 preserves uniform aspect ratio without stretching in FFmpeg', () => {
  const project = makeSplitProject(0.25);
  const plan = buildFFmpegExportCommand(project);
  const fc = plan.args[plan.args.indexOf('-filter_complex') + 1];

  // Top region is 1080 x 480 (aspect ratio = 2.25)
  // Bottom region is 1080 x 1440 (aspect ratio = 0.75)
  const topMatch = fc.match(/crop=(\d+):(\d+):[^;]+scale=1080:480/);
  assert.ok(topMatch, 'Top region must crop and scale to 1080:480');
  const cropWTop = parseInt(topMatch[1], 10);
  const cropHTop = parseInt(topMatch[2], 10);
  const topCropAspect = cropWTop / cropHTop;
  const topTargetAspect = 1080 / 480;
  assert.ok(
    Math.abs(topCropAspect - topTargetAspect) < 0.02,
    `Top crop aspect ratio (${topCropAspect}) must match target (${topTargetAspect}) to prevent stretching`
  );

  const botMatch = fc.match(/crop=(\d+):(\d+):[^;]+scale=1080:1440/);
  assert.ok(botMatch, 'Bottom region must crop and scale to 1080:1440');
  const cropWBot = parseInt(botMatch[1], 10);
  const cropHBot = parseInt(botMatch[2], 10);
  const botCropAspect = cropWBot / cropHBot;
  const botTargetAspect = 1080 / 1440;
  assert.ok(
    Math.abs(botCropAspect - botTargetAspect) < 0.02,
    `Bottom crop aspect ratio (${botCropAspect}) must match target (${botTargetAspect}) to prevent stretching`
  );
});

test('Split 50/50 preserves uniform aspect ratio without stretching in FFmpeg', () => {
  const project = makeSplitProject(0.5);
  const plan = buildFFmpegExportCommand(project);
  const fc = plan.args[plan.args.indexOf('-filter_complex') + 1];

  // Top and Bottom are both 1080 x 960 (aspect ratio = 1.125)
  const matches = [...fc.matchAll(/crop=(\d+):(\d+):[^;]+scale=1080:960/g)];
  assert.strictEqual(matches.length, 2, 'Both regions must scale to 1080:960');
  for (const m of matches) {
    const cropW = parseInt(m[1], 10);
    const cropH = parseInt(m[2], 10);
    const cropAspect = cropW / cropH;
    const targetAspect = 1080 / 960;
    assert.ok(
      Math.abs(cropAspect - targetAspect) < 0.02,
      `Crop aspect ratio (${cropAspect}) must match target (${targetAspect})`
    );
  }
});
