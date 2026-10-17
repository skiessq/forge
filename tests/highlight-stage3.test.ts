import test from 'node:test';
import assert from 'node:assert';
import {
  extractSentences,
  containsAvoidKeyword,
  buildAndFilterWindows,
} from '../src/lib/highlight/stage3_windows';
import { Transcript } from '../src/lib/highlight/types';

test('Stage 3 - extractSentences extracts complete sentences based on punctuation and pauses', () => {
  const fixtureTranscript: Transcript = {
    language: 'en',
    duration: 60,
    sourceHash: 'test_hash',
    createdAt: new Date().toISOString(),
    segments: [],
    words: [
      { word: 'Hello', start: 1.0, end: 1.4 },
      { word: 'everyone', start: 1.5, end: 2.0 },
      { word: 'welcome.', start: 2.1, end: 2.8 },
      // 1.2s pause here
      { word: 'Today', start: 4.0, end: 4.4 },
      { word: 'we', start: 4.5, end: 4.6 },
      { word: 'clutch', start: 4.7, end: 5.2 },
      { word: 'this!', start: 5.3, end: 5.8 },
    ],
  };

  const sentences = extractSentences(fixtureTranscript);
  assert.strictEqual(sentences.length, 2);
  assert.strictEqual(sentences[0].text, 'Hello everyone welcome.');
  assert.strictEqual(sentences[0].start, 1.0);
  assert.strictEqual(sentences[0].end, 2.8);

  assert.strictEqual(sentences[1].text, 'Today we clutch this!');
  assert.strictEqual(sentences[1].start, 4.0);
  assert.strictEqual(sentences[1].end, 5.8);
});

test('Stage 3 - containsAvoidKeyword detects banned words accurately with word boundaries', () => {
  const avoid = ['gambling', 'casino', 'politics'];

  assert.strictEqual(containsAvoidKeyword('Join our brand new casino stream tonight!', avoid), true);
  assert.strictEqual(containsAvoidKeyword('Let us avoid all politics here.', avoid), true);
  assert.strictEqual(containsAvoidKeyword('This is pure gameplay clutch in CS2!', avoid), false);
  // Boundary check: word 'gambit' or 'casin' should not falsely trigger
  assert.strictEqual(containsAvoidKeyword('Queen gambit opening play.', avoid), false);
});

test('Stage 3 - buildAndFilterWindows respects min/max length and drops avoid keywords', () => {
  // Build a 100-second synthetic transcript with sentences
  const words = [];
  let t = 0;
  for (let s = 1; s <= 20; s++) {
    const isAvoid = s === 5; // sentence 5 has an avoid keyword
    words.push({ word: `Sentence${s}`, start: t, end: t + 0.8 });
    t += 1.0;
    words.push({ word: isAvoid ? 'gambling' : 'clutch', start: t, end: t + 0.8 });
    t += 1.0;
    words.push({ word: 'play.', start: t, end: t + 1.0 });
    t += 2.0; // total 4s per sentence
  }

  const transcript: Transcript = {
    language: 'en',
    duration: t,
    sourceHash: 'test_hash_2',
    createdAt: new Date().toISOString(),
    segments: [],
    words,
  };

  const { allWindowsCount, filteredWindows } = buildAndFilterWindows(transcript, undefined, {
    minLength: 20,
    maxLength: 35,
    avoidKeywords: ['gambling'],
  });

  assert.ok(allWindowsCount > 0, 'Should build raw candidate windows');
  assert.ok(filteredWindows.length > 0, 'Filtered windows should exist');

  // Verify constraints on every filtered window
  for (const win of filteredWindows) {
    assert.ok(win.duration >= 20, `Window duration ${win.duration} must be >= minLength (20)`);
    assert.ok(win.duration <= 35, `Window duration ${win.duration} must be <= maxLength (35)`);
    assert.strictEqual(win.text.toLowerCase().includes('gambling'), false, 'Window must not contain avoid keywords');
    // Verify window starts at first sentence start and ends at last sentence end
    assert.strictEqual(win.start, win.sentences[0].start);
    assert.strictEqual(win.end, win.sentences[win.sentences.length - 1].end);
  }
});
