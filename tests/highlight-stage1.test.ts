import test from 'node:test';
import assert from 'node:assert';
import { planChunks, mergeChunkTranscripts, ChunkInfo } from '../src/lib/highlight/stage1_transcribe';
import { TranscriptSegment } from '../src/lib/highlight/types';

test('Stage 1 - planChunks handles short, medium, and 2-hour videos', () => {
  // 1. Short video (e.g. 15 seconds) -> single chunk
  const shortChunks = planChunks(15, 600, 5);
  assert.strictEqual(shortChunks.length, 1);
  assert.strictEqual(shortChunks[0].start, 0);
  assert.strictEqual(shortChunks[0].duration, 15);

  // 2. 1200 seconds (20 minutes) with 600s chunks and 5s overlap
  const twentyMin = planChunks(1200, 600, 5);
  // Chunk 0: 0 -> 600 (start=0)
  // Chunk 1: 595 -> 1195 (start=595)
  // Chunk 2: 1190 -> 1200 (start=1190)
  assert.strictEqual(twentyMin.length, 3);
  assert.strictEqual(twentyMin[0].start, 0);
  assert.strictEqual(twentyMin[0].duration, 600);
  assert.strictEqual(twentyMin[1].start, 595);
  assert.strictEqual(twentyMin[1].duration, 600);
  assert.strictEqual(twentyMin[2].start, 1190);
  assert.strictEqual(twentyMin[2].duration, 10);

  // 3. 2-hour video (7200 seconds)
  const twoHour = planChunks(7200, 600, 5);
  assert.ok(twoHour.length >= 12, 'Should create at least 12 chunks');
  // Check that start times advance monotonically and cover full duration
  for (let i = 1; i < twoHour.length; i++) {
    assert.strictEqual(twoHour[i].start, twoHour[i - 1].start + 600 - 5);
  }
  const lastChunk = twoHour[twoHour.length - 1];
  assert.ok(lastChunk.start + lastChunk.duration >= 7200, 'Last chunk must reach end of video');
});

test('Stage 1 - mergeChunkTranscripts removes overlapping duplicate words and adjusts offsets', () => {
  const chunk0: ChunkInfo = { index: 0, start: 0, duration: 600, overlap: 0 };
  const chunk1: ChunkInfo = { index: 1, start: 595, duration: 600, overlap: 5 };

  // Handover threshold = chunk1.start + chunk1.overlap / 2 = 595 + 2.5 = 597.5s

  const rawChunk0 = {
    language: 'en',
    segments: [
      {
        id: 's1',
        start: 590.0,
        end: 596.0,
        text: 'hello from chunk zero',
        words: [
          { word: 'hello', start: 590.0, end: 591.0 },
          { word: 'from', start: 591.0, end: 592.0 },
          { word: 'chunk', start: 592.0, end: 593.0 },
          { word: 'zero', start: 593.0, end: 596.0 },
        ],
      },
      {
        id: 's2',
        start: 596.0,
        end: 597.0,
        text: 'still zero',
        words: [
          { word: 'still', start: 596.0, end: 596.5 },
          { word: 'zero', start: 596.5, end: 597.0 },
        ],
      },
    ],
  };

  // In chunk 1, local start is 0, which corresponds to global 595
  // Whisper returns words starting at local 0..5
  const rawChunk1 = {
    language: 'en',
    segments: [
      {
        id: 's3',
        start: 1.0, // global 596.0 -> before handover (597.5), should be discarded
        end: 2.0,
        text: 'duplicate from zero',
        words: [
          { word: 'duplicate', start: 1.0, end: 2.0 }, // global 596.0..597.0
        ],
      },
      {
        id: 's4',
        start: 3.0, // global 598.0 -> after handover (597.5), should be included!
        end: 5.0,
        text: 'welcome to chunk one',
        words: [
          { word: 'welcome', start: 3.0, end: 3.5 }, // global 598.0
          { word: 'to', start: 3.5, end: 4.0 },      // global 598.5
          { word: 'chunk', start: 4.0, end: 4.5 },   // global 599.0
          { word: 'one', start: 4.5, end: 5.0 },     // global 599.5
        ],
      },
    ],
  };

  const merged = mergeChunkTranscripts([
    { chunk: chunk0, raw: rawChunk0 as any },
    { chunk: chunk1, raw: rawChunk1 as any },
  ]);

  // Verify that 'duplicate' was dropped because it was before 597.5 in chunk 1
  const wordTexts = merged.words.map((w) => w.word);
  assert.ok(!wordTexts.includes('duplicate'), 'Duplicate word in overlap region must be omitted');
  assert.ok(wordTexts.includes('zero'), 'Words before handover from chunk 0 must be kept');
  assert.ok(wordTexts.includes('welcome'), 'Words after handover from chunk 1 must be kept');

  // Verify global timestamps are strictly increasing and shifted by chunk.start (595)
  const welcomeWord = merged.words.find((w) => w.word === 'welcome');
  assert.ok(welcomeWord, 'Welcome word should exist');
  assert.strictEqual(welcomeWord!.start, 598.0);
  assert.strictEqual(welcomeWord!.end, 598.5);
});
