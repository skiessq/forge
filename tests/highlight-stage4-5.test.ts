import test from 'node:test';
import assert from 'node:assert';
import {
  parseAndValidateBatchResponse,
  applyHookStartFix,
  computeFinalScore,
  isFillerOpening,
  DeterministicRuleScoringEngine,
} from '../src/lib/highlight/stage4_scoring';
import {
  snapToWordBoundaries,
  selectAndRefineCandidates,
} from '../src/lib/highlight/stage5_refine';
import { Window, ScoredWindow, TranscriptWord } from '../src/lib/highlight/types';

test('Stage 4 - parseAndValidateBatchResponse cleans markdown fences and handles malformed keys', () => {
  const mockLlmOutput = '```json\n{\n  "win_1": {\n    "hook_strength": 9,\n    "standalone_clarity": 8.5,\n    "payoff": 9,\n    "emotion_or_surprise": 7.5,\n    "brief_fit": 8,\n    "risk_flags": [],\n    "suggested_title": "Insane 1v4 Clutch Win",\n    "reason": "Dramatic gameplay climax with punchy delivery."\n  }\n}\n```';

  const validated = parseAndValidateBatchResponse(mockLlmOutput, ['win_1']);
  assert.ok(validated['win_1']);
  assert.strictEqual(validated['win_1'].hook_strength, 9);
  assert.strictEqual(validated['win_1'].standalone_clarity, 8.5);
  assert.strictEqual(validated['win_1'].suggested_title, 'Insane 1v4 Clutch Win');
  assert.strictEqual(validated['win_1'].reason, 'Dramatic gameplay climax with punchy delivery.');
});

test('Stage 4 - applyHookStartFix shifts start forward when opening sentence is conversational filler', () => {
  const windowWithFiller: Window = {
    id: 'win_filler',
    start: 10.0,
    end: 42.0,
    duration: 32.0,
    text: 'So, um, yeah. Watch this incredible defuse right now!',
    words: [],
    sentences: [
      { text: 'So, um, yeah.', start: 10.0, end: 12.2, words: [] },
      { text: 'Watch this incredible defuse right now!', start: 12.8, end: 16.5, words: [] },
    ],
    signalScore: 80,
    speechRatio: 0.9,
    wordsPerSecond: 2.5,
    avgRms: -18,
    maxSpike: 6.0,
    sceneChangeCount: 1,
  };

  assert.strictEqual(isFillerOpening(windowWithFiller.sentences[0].text), true);

  const fix = applyHookStartFix(windowWithFiller, 20);
  assert.strictEqual(fix.hookShifted, true);
  assert.strictEqual(fix.adjustedStart, 12.8); // Shifted to second sentence!
});

test('Stage 4 - computeFinalScore applies weights and penalizes risk flags', () => {
  const rawScore = {
    hook_strength: 9.0,
    standalone_clarity: 8.0,
    payoff: 8.5,
    emotion_or_surprise: 9.0,
    brief_fit: 8.0,
    risk_flags: ['copyright music flag'],
    suggested_title: 'Title',
    reason: 'Reason',
  };

  const { finalScore, scoreBreakdown } = computeFinalScore(rawScore, 'streamer_gameplay');
  assert.ok(scoreBreakdown.riskPenalty > 0, 'Risk penalty must be subtracted');
  // Score without risk penalty would be around 86 - 25 = 61
  assert.ok(finalScore <= 70, `Final score ${finalScore} should reflect risk deduction`);
});

test('Stage 5 - snapToWordBoundaries never cuts into speech and provides natural margins', () => {
  const words: TranscriptWord[] = [
    { word: 'Welcome', start: 10.2, end: 10.8 },
    { word: 'to', start: 10.9, end: 11.1 },
    { word: 'the', start: 11.2, end: 11.4 },
    { word: 'show.', start: 11.5, end: 12.3 },
  ];

  const snapped = snapToWordBoundaries(10.0, 12.5, words, 1);
  // Must start <= firstWord.start (10.2)
  assert.ok(snapped.snappedStart <= 10.2);
  // Must end >= lastWord.end (12.3)
  assert.ok(snapped.snappedEnd >= 12.3);
  assert.strictEqual(snapped.snappedWords.length, 4);
});

test('Stage 5 - selectAndRefineCandidates removes overlapping candidates and enforces diversity', () => {
  const makeWin = (id: string, start: number, end: number, score: number): ScoredWindow => ({
    id,
    start,
    end,
    duration: end - start,
    adjustedStart: start,
    adjustedEnd: end,
    hookShifted: false,
    finalScore: score,
    scoreBreakdown: {},
    rawScores: {
      hook_strength: 8,
      standalone_clarity: 8,
      payoff: 8,
      emotion_or_surprise: 8,
      brief_fit: 8,
      risk_flags: [],
      suggested_title: `Clip ${id}`,
      reason: `Reason ${id}`,
    },
    text: `Text for ${id}`,
    words: [{ word: 'Test', start, end }],
    sentences: [],
    signalScore: score,
    speechRatio: 0.9,
    wordsPerSecond: 2.5,
    avgRms: -20,
    maxSpike: 3,
    sceneChangeCount: 0,
  });

  const scored: ScoredWindow[] = [
    makeWin('win_1', 10, 40, 95),  // High score
    makeWin('win_2', 15, 45, 80),  // Heavily overlaps win_1 (should be suppressed)
    makeWin('win_3', 120, 150, 90), // Distant, high score (should be kept)
    makeWin('win_4', 300, 330, 85), // Distant, good score (should be kept)
  ];

  const candidates = selectAndRefineCandidates(scored, [], { targetCount: 3 }, 600);
  assert.strictEqual(candidates.length, 3);
  const ids = candidates.map((c) => c.title);
  assert.ok(ids.includes('Clip win_1'), 'win_1 must be included');
  assert.ok(!ids.includes('Clip win_2'), 'win_2 must be suppressed due to overlap with win_1');
  assert.ok(ids.includes('Clip win_3'), 'win_3 must be included');
});
