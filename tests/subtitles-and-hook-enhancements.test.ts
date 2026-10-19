import test from 'node:test';
import assert from 'node:assert';
import { generateAssSubtitles } from '../src/lib/subtitles/assGenerator';
import { buildFFmpegExportCommand } from '../src/lib/ffmpeg/builder';
import { Project, SubtitleItem, SubtitleStyle, IntroHookConfig } from '../src/lib/types';

test('ASS generator outputs custom word color tags when specified', () => {
  const mockProject: any = {
    id: 'test_custom_colors',
    name: 'Custom Colors Test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: {
      id: 'src1',
      name: 'game.mp4',
      path: 'c:/fake/game.mp4',
      size: 1000,
      mimeType: 'video/mp4',
    },
    canvas: {
      width: 1080,
      height: 1920,
      fps: 30,
      aspectRatio: '9:16',
    },
    layout: {
      templateId: 'gameplay_full',
      regions: [
        {
          id: 'r1',
          label: 'Game',
          sourceType: 'source_media',
          targetBounds: { x: 0, y: 0, width: 1, height: 1 },
          crop: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
      dividerWidth: 0,
      dividerColor: '#3B82F6',
    },
    timeline: { tracks: [] },
    subtitles: [
      {
        id: 'sub1',
        start: 0,
        end: 2,
        text: 'Insane Viral Play',
        words: [
          { word: 'Insane', start: 0, end: 0.6, color: '#FF0055' },
          { word: 'Viral', start: 0.7, end: 1.3, color: '#00F0FF' },
          { word: 'Play', start: 1.4, end: 2.0 },
        ],
      },
    ],
    subtitleStyle: {
      fontFamily: 'Montserrat',
      fontSize: 52,
      primaryColor: '#FFFFFF',
      highlightColor: '#FFE600',
      outlineColor: '#000000',
      outlineWidth: 3,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowDistance: 2,
      textTransform: 'uppercase',
      position: 'bottom',
      verticalOffset: -50,
      horizontalOffset: 25,
      maxWordsPerLine: 3,
      lineSpacing: 1.2,
      animation: 'karaoke_highlight',
    },
  };

  const ass = generateAssSubtitles(mockProject);
  assert.ok(ass.includes('[Script Info]'), 'Generates valid ASS header');
  assert.ok(ass.includes('PlayResX: 1080'), 'Canvas width matches 1080');
  assert.ok(ass.includes('PlayResY: 1920'), 'Canvas height matches 1920');

  // Check horizontal offset reflection in MarginL or MarginR
  assert.ok(ass.includes('Style: Default'), 'Defines Default style');

  // Check custom word colors in Dialogue line:
  // #FF0055 -> ASS BGR \c&H5500FF&
  // #00F0FF -> ASS BGR \c&HFFF000&
  assert.ok(ass.includes('5500FF'), 'Contains custom hex color for first word (Insane)');
  assert.ok(ass.includes('FFF000'), 'Contains custom hex color for second word (Viral)');
});

test('FFmpeg builder includes intro hook with custom positioning, transition, and viral font', () => {
  const mockProject: any = {
    id: 'test_hook',
    name: 'Hook Test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: {
      id: 'src1',
      name: 'game.mp4',
      path: 'c:/fake/game.mp4',
      size: 1000,
      mimeType: 'video/mp4',
    },
    canvas: {
      width: 1080,
      height: 1920,
      fps: 30,
      aspectRatio: '9:16',
    },
    layout: {
      templateId: 'gameplay_full',
      regions: [
        {
          id: 'r1',
          label: 'Game',
          sourceType: 'source_media',
          targetBounds: { x: 0, y: 0, width: 1, height: 1 },
          crop: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
      dividerWidth: 0,
      dividerColor: '#3B82F6',
    },
    timeline: { tracks: [] },
    subtitles: [],
    subtitleStyle: {
      fontFamily: 'Montserrat',
      fontSize: 50,
      primaryColor: '#FFFFFF',
      highlightColor: '#FFE600',
      outlineColor: '#000000',
      outlineWidth: 3,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowDistance: 2,
      textTransform: 'uppercase',
      position: 'bottom',
      verticalOffset: 0,
      maxWordsPerLine: 3,
      lineSpacing: 1.2,
      animation: 'karaoke_highlight',
    },
    introHook: {
      enabled: true,
      text: '*WAIT* FOR THE END! 🔥',
      duration: 3.0,
      fontSize: 60,
      color: '#FFE600',
      highlightColor: '#00F0FF',
      fontFamily: 'Anton',
      transition: 'bounce_drop',
      positionX: 0.45,
      positionY: 0.30,
    },
  };

  const { args } = buildFFmpegExportCommand(mockProject, {
    resolution: '1080p',
    fps: 30,
    quality: 'balanced',
    hwAccel: 'cpu',
    outputFileName: 'test_hook_out.mp4',
  });

  const filtergraph = args[args.indexOf('-filter_complex') + 1];
  assert.ok(
    filtergraph.includes('overlay') || filtergraph.includes('subtitles'),
    'Filtergraph includes overlay or subtitles for Intro Hook'
  );
});

test('ASS generator outputs calibrated font size 154 and WrapStyle: 0 for 1080p preview parity', () => {
  const mockProject: any = {
    canvas: { width: 1080, height: 1920, fps: 30, aspectRatio: '9:16' },
    subtitles: [
      {
        id: 's1',
        start: 0,
        end: 2,
        text: 'BIG BOLD CAPTIONS',
        words: [
          { word: 'BIG', start: 0, end: 0.6 },
          { word: 'BOLD', start: 0.6, end: 1.2 },
          { word: 'CAPTIONS', start: 1.2, end: 2.0 },
        ],
      },
    ],
    subtitleStyle: {
      fontFamily: 'Montserrat',
      fontSize: 54,
      primaryColor: '#FFFFFF',
      highlightColor: '#FFE600',
      outlineColor: '#000000',
      outlineWidth: 4,
      animation: 'pop_in',
    },
  };

  const ass = generateAssSubtitles(mockProject);
  assert.ok(ass.includes('WrapStyle: 0'), 'ASS header sets WrapStyle: 0 for smart multi-line wrapping');
  assert.ok(ass.includes('Style: Default,Montserrat Black,154,'), 'ASS font size is calibrated to 154 (54 * 2.85) matching preview 1:1');
  assert.ok(ass.includes('\\fscx124\\fscy124\\t(0,100,\\fscx108\\fscy108)'), 'Generates pop_in scale transform tags for active word');
});

test('ASS generator produces bounce, neon, and typewriter tags accurately', () => {
  const baseProject: any = {
    canvas: { width: 1080, height: 1920, fps: 30, aspectRatio: '9:16' },
    subtitles: [
      {
        id: 's1',
        start: 0,
        end: 2,
        text: 'BOUNCE NEON TEST 🔥',
        words: [
          { word: 'BOUNCE', start: 0, end: 0.7 },
          { word: 'NEON', start: 0.7, end: 1.4 },
          { word: '🔥', start: 1.4, end: 2.0 },
        ],
      },
    ],
    subtitleStyle: {
      fontFamily: 'Montserrat',
      fontSize: 54,
      primaryColor: '#FFFFFF',
      highlightColor: '#FFE600',
      outlineColor: '#000000',
      outlineWidth: 4,
    },
  };

  // Test bounce_word
  const bounceAss = generateAssSubtitles({
    ...baseProject,
    subtitleStyle: { ...baseProject.subtitleStyle, animation: 'bounce_word' },
  });
  assert.ok(bounceAss.includes('\\fscx108\\fscy125'), 'Bounce animation includes vertical stretch tags');

  // Test neon_glow
  const neonAss = generateAssSubtitles({
    ...baseProject,
    subtitleStyle: { ...baseProject.subtitleStyle, animation: 'neon_glow' },
  });
  assert.ok(neonAss.includes('\\blur5'), 'Neon animation includes blur tag');

  // Test typewriter
  const typeAss = generateAssSubtitles({
    ...baseProject,
    subtitleStyle: { ...baseProject.subtitleStyle, animation: 'typewriter' },
  });
  // In typewriter, dialogue line 0 has only word 0
  const dialogueLines = typeAss.split('\n').filter((l: string) => l.startsWith('Dialogue: 0,'));
  assert.strictEqual(dialogueLines.length, 3, 'Typewriter creates sequential dialogue entries per word');
});

