const test = require('node:test');
const assert = require('node:assert');
const {
  hexToAssColor,
  secondsToAssTime,
  generateAssSubtitles,
  exportToSrt,
  parseSrt,
} = require('../src/lib/subtitles/assGenerator.ts');

test('hexToAssColor converts RGB hex to ASS BGR format', () => {
  // White: #FFFFFF -> &H00FFFFFF&
  assert.strictEqual(hexToAssColor('#FFFFFF'), '&H00FFFFFF&');
  // Red: #FF0000 -> &H000000FF& (B=00, G=00, R=FF)
  assert.strictEqual(hexToAssColor('#FF0000'), '&H000000FF&');
  // Yellow: #FFE600 -> &H0000E6FF&
  assert.strictEqual(hexToAssColor('#FFE600'), '&H0000E6FF&');
});

test('secondsToAssTime formats timestamps correctly', () => {
  assert.strictEqual(secondsToAssTime(0), '0:00:00.00');
  assert.strictEqual(secondsToAssTime(12.34), '0:00:12.34');
  assert.strictEqual(secondsToAssTime(65.5), '0:01:05.50');
  assert.strictEqual(secondsToAssTime(3665.25), '1:01:05.25');
});

test('generateAssSubtitles generates full ASS file with karaoke tags', () => {
  const mockProject = {
    canvas: { width: 1080, height: 1920, fps: 30, aspectRatio: '9:16' },
    subtitles: [
      {
        id: 'sub_1',
        start: 1.0,
        end: 3.0,
        text: 'INSANE CLUTCH PLAY',
        words: [
          { word: 'INSANE', start: 1.0, end: 1.6 },
          { word: 'CLUTCH', start: 1.7, end: 2.3 },
          { word: 'PLAY', start: 2.4, end: 3.0 },
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
      shadowColor: '#000000',
      shadowDistance: 2,
      textTransform: 'uppercase',
      position: 'bottom',
      verticalOffset: -120,
      maxWordsPerLine: 4,
      lineSpacing: 1.2,
      animation: 'karaoke_highlight',
    },
  };

  const ass = generateAssSubtitles(mockProject);
  assert.ok(ass.includes('[Script Info]'));
  assert.ok(ass.includes('[V4+ Styles]'));
  assert.ok(ass.includes('Montserrat'));
  assert.ok(ass.includes('PlayResX: 1080'));
  assert.ok(ass.includes('PlayResY: 1920'));
  assert.ok(ass.includes('Dialogue: 0,0:00:01.00,0:00:01.60'));
  assert.ok(ass.includes('\\c&H0000E6FF&')); // highlighted active word
});

test('SRT export and import round-trip', () => {
  const original = [
    { id: '1', start: 1.2, end: 3.4, text: 'Hello World' },
    { id: '2', start: 4.0, end: 6.5, text: 'Testing Subtitles' },
  ];

  const srt = exportToSrt(original);
  assert.ok(srt.includes('00:00:01,200 --> 00:00:03,400'));
  assert.ok(srt.includes('Hello World'));

  const parsed = parseSrt(srt);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].text, 'Hello World');
  assert.strictEqual(Math.round(parsed[0].start * 10) / 10, 1.2);
  assert.strictEqual(Math.round(parsed[0].end * 10) / 10, 3.4);
});
