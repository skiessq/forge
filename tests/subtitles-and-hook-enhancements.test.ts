import test from 'node:test';
import assert from 'node:assert';
import { generateAssSubtitles } from '../src/lib/subtitles/assGenerator';
import { buildFFmpegExportCommand } from '../src/lib/ffmpeg/builder';
import { Project, SubtitleItem, SubtitleStyle, IntroHookConfig } from '../src/lib/types';

test('ASS generator outputs custom word color tags when specified', () => {
  const mockProject: Project = {
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
  const mockProject: Project = {
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
  assert.ok(filtergraph.includes('drawtext'), 'Drawtext filter included for Intro Hook');
  assert.ok(filtergraph.includes('WAIT FOR THE END!'), 'Drawtext text contains sanitized headline');
  assert.ok(filtergraph.includes('w*0.45'), 'Drawtext respects customized positionX');
  assert.ok(filtergraph.includes('0.3'), 'Drawtext respects customized positionY');
  assert.ok(filtergraph.includes('160'), 'Drawtext includes bounce_drop trajectory');
});
