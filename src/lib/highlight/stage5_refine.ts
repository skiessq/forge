import {
  ScoredWindow,
  Candidate,
  TranscriptWord,
  HighlightConfig,
} from './types';
import {
  loadCachedCandidates,
  saveCachedCandidates,
  computeScoringConfigHash,
  computeWindowConfigHash,
} from './cache';

/**
 * Snaps timestamps strictly to word boundaries, adding a tiny natural
 * 150ms pre-speech margin and 250ms post-speech margin, never cutting into words.
 */
export function snapToWordBoundaries(
  start: number,
  end: number,
  words: TranscriptWord[],
  minClipLength = 15
): { snappedStart: number; snappedEnd: number; snappedWords: TranscriptWord[] } {
  if (!words || words.length === 0) {
    return {
      snappedStart: Math.max(0, Math.round(start * 1000) / 1000),
      snappedEnd: Math.round(end * 1000) / 1000,
      snappedWords: [],
    };
  }

  // Find words that overlap with or lie within the [start, end] window
  const inWindow = words.filter((w) => w.end >= start - 0.2 && w.start <= end + 0.2);

  if (inWindow.length === 0) {
    return {
      snappedStart: Math.max(0, Math.round(start * 1000) / 1000),
      snappedEnd: Math.round(end * 1000) / 1000,
      snappedWords: [],
    };
  }

  const firstWord = inWindow[0];
  const lastWord = inWindow[inWindow.length - 1];

  // Natural margins: 150ms before speech, 250ms after speech completes
  // Ensure we NEVER cut into speech: start <= firstWord.start, end >= lastWord.end
  const snappedStart = Math.max(0, Math.round((firstWord.start - 0.15) * 1000) / 1000);
  const snappedEnd = Math.round((lastWord.end + 0.25) * 1000) / 1000;

  return {
    snappedStart,
    snappedEnd: Math.max(snappedStart + minClipLength, snappedEnd),
    snappedWords: inWindow,
  };
}

/**
 * Selects top diverse candidates by suppressing overlapping segments
 * and enforcing temporal distribution.
 */
export function selectAndRefineCandidates(
  scoredWindows: ScoredWindow[],
  allWords: TranscriptWord[],
  config: Partial<HighlightConfig> = {},
  totalVideoDuration = 3600
): Candidate[] {
  let targetCount = config.targetCount ?? 15;

  // Edge case: very short videos (< 5 min)
  if (totalVideoDuration < 300) {
    targetCount = Math.max(1, Math.min(targetCount, Math.floor(totalVideoDuration / 25)));
  }

  if (scoredWindows.length === 0) return [];

  // Sort by finalScore descending
  const sorted = [...scoredWindows].sort((a, b) => b.finalScore - a.finalScore);

  const selected: ScoredWindow[] = [];
  const minTemporalGapSec = totalVideoDuration > 1800 ? 45 : 20;

  for (const win of sorted) {
    let conflicts = false;

    for (const chosen of selected) {
      // 1. Overlap check (> 30% overlap with an existing higher-rated clip)
      const overlapStart = Math.max(win.adjustedStart, chosen.adjustedStart);
      const overlapEnd = Math.min(win.adjustedEnd, chosen.adjustedEnd);
      const overlapDur = Math.max(0, overlapEnd - overlapStart);
      const minDur = Math.min(win.duration, chosen.duration);

      if (overlapDur / minDur >= 0.30) {
        conflicts = true;
        break;
      }

      // 2. Temporal diversity: avoid clusters from the exact same minute
      const centerDist = Math.abs(
        (win.adjustedStart + win.adjustedEnd) / 2 - (chosen.adjustedStart + chosen.adjustedEnd) / 2
      );
      if (centerDist < minTemporalGapSec) {
        conflicts = true;
        break;
      }
    }

    if (!conflicts) {
      selected.push(win);
      if (selected.length >= targetCount) break;
    }
  }

  // If strict diversity left us with too few clips, relax temporal gap
  if (selected.length < targetCount) {
    for (const win of sorted) {
      if (selected.some((s) => s.id === win.id)) continue;
      const overlapsExisting = selected.some((chosen) => {
        const overlapStart = Math.max(win.adjustedStart, chosen.adjustedStart);
        const overlapEnd = Math.min(win.adjustedEnd, chosen.adjustedEnd);
        return Math.max(0, overlapEnd - overlapStart) / Math.min(win.duration, chosen.duration) >= 0.35;
      });
      if (!overlapsExisting) {
        selected.push(win);
        if (selected.length >= targetCount) break;
      }
    }
  }

  // Snap to word boundaries and construct Candidate objects
  const candidates: Candidate[] = selected.map((win, idx) => {
    const { snappedStart, snappedEnd, snappedWords } = snapToWordBoundaries(
      win.adjustedStart,
      win.adjustedEnd,
      allWords.length > 0 ? allWords : win.words,
      config.minLength ?? 20
    );

    const dur = Math.round((snappedEnd - snappedStart) * 1000) / 1000;

    return {
      id: `cand_${idx + 1}_${win.id}`,
      rank: idx + 1,
      title: win.rawScores.suggested_title,
      reason: win.rawScores.reason,
      score: win.finalScore,
      rawScores: win.rawScores,
      start: snappedStart,
      end: snappedEnd,
      duration: dur,
      originalStart: win.start,
      originalEnd: win.end,
      riskFlags: win.rawScores.risk_flags || [],
      text: win.text,
      words: snappedWords,
      status: 'pending',
    };
  });

  return candidates;
}

/**
 * Stage 5 Orchestrator:
 * Selects and refines top candidates with boundary snapping and caching.
 */
export function getRefinedCandidates(
  sourceHash: string,
  scoredWindows: ScoredWindow[],
  allWords: TranscriptWord[],
  config: Partial<HighlightConfig>,
  totalDuration: number
): Candidate[] {
  const fullHash = computeScoringConfigHash(config) + '_' + computeWindowConfigHash(config);

  const cached = loadCachedCandidates(sourceHash, fullHash);
  if (cached && cached.length > 0) {
    return cached;
  }

  const candidates = selectAndRefineCandidates(scoredWindows, allWords, config, totalDuration);
  saveCachedCandidates(sourceHash, fullHash, candidates);

  return candidates;
}
