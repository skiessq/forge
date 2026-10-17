import {
  Transcript,
  TranscriptWord,
  Signals,
  Sentence,
  Window,
  HighlightConfig,
} from './types';
import {
  loadCachedWindows,
  saveCachedWindows,
  computeWindowConfigHash,
} from './cache';

/**
 * Groups transcript words into sentences using punctuation (. ! ?)
 * and conversational pauses (silence gap >= 0.8s).
 */
export function extractSentences(transcript: Transcript): Sentence[] {
  const words = transcript.words;
  if (!words || words.length === 0) {
    // If no words but segments exist, construct from segments
    if (transcript.segments && transcript.segments.length > 0) {
      return transcript.segments.map((seg) => ({
        text: seg.text,
        start: seg.start,
        end: seg.end,
        words: seg.words || [],
      }));
    }
    return [];
  }

  const sentences: Sentence[] = [];
  let currentWords: TranscriptWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    const isLastWord = i === words.length - 1;
    const hasPunctuation = /[.!?]$/.test(w.word.trim());
    const hasLongPause = !isLastWord && words[i + 1].start - w.end >= 0.8;

    if (hasPunctuation || hasLongPause || isLastWord) {
      if (currentWords.length > 0) {
        const text = currentWords.map((cw) => cw.word).join(' ');
        sentences.push({
          text,
          start: currentWords[0].start,
          end: currentWords[currentWords.length - 1].end,
          words: [...currentWords],
        });
        currentWords = [];
      }
    }
  }

  return sentences;
}

/**
 * Checks if text contains any forbidden avoid-keywords (case-insensitive, whole-word matching).
 */
export function containsAvoidKeyword(text: string, avoidKeywords: string[]): boolean {
  if (!avoidKeywords || avoidKeywords.length === 0) return false;
  const lowerText = text.toLowerCase();

  for (const kw of avoidKeywords) {
    const cleanKw = kw.trim().toLowerCase();
    if (!cleanKw) continue;
    // Word boundary check
    const regex = new RegExp(`\\b${escapeRegExp(cleanKw)}\\b`, 'i');
    if (regex.test(lowerText)) {
      return true;
    }
  }
  return false;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Aggregates signal timeline metrics across a [start, end] window.
 */
export function aggregateWindowSignals(
  start: number,
  end: number,
  signals?: Signals
): { avgRms: number; maxSpike: number; speechRatio: number; wordsPerSecond: number; sceneChangeCount: number; signalScore: number } {
  if (!signals || !signals.perSecond || signals.perSecond.length === 0) {
    return { avgRms: -25, maxSpike: 0, speechRatio: 0.8, wordsPerSecond: 2.2, sceneChangeCount: 0, signalScore: 50 };
  }

  const startSec = Math.max(0, Math.floor(start));
  const endSec = Math.min(signals.perSecond.length - 1, Math.ceil(end));

  let rmsSum = 0;
  let maxSpike = 0;
  let speechCount = 0;
  let speechRateSum = 0;
  let sceneChanges = 0;
  let totalCount = 0;

  for (let s = startSec; s <= endSec; s++) {
    const sig = signals.perSecond[s];
    if (sig) {
      rmsSum += sig.rmsDb;
      if (sig.spikeScore > maxSpike) maxSpike = sig.spikeScore;
      if (sig.speechRate > 0.5) speechCount++;
      speechRateSum += sig.speechRate;
      if (sig.hasSceneChange) sceneChanges++;
      totalCount++;
    }
  }

  const count = Math.max(1, totalCount);
  const avgRms = Math.round((rmsSum / count) * 10) / 10;
  const speechRatio = Math.round((speechCount / count) * 100) / 100;
  const wordsPerSecond = Math.round((speechRateSum / count) * 10) / 10;

  // Signal score 0..100: rewards energy, volume spikes (hype), and brisk speech
  // Normalizing RMS: -45dB (0) to -10dB (100)
  const normRms = Math.min(100, Math.max(0, ((avgRms + 45) / 35) * 100));
  const normSpike = Math.min(100, maxSpike * 12);
  const normSpeech = Math.min(100, (wordsPerSecond / 4.0) * 100);

  const signalScore = Math.round(normRms * 0.35 + normSpike * 0.35 + normSpeech * 0.30);

  return {
    avgRms,
    maxSpike,
    speechRatio,
    wordsPerSecond,
    sceneChangeCount: sceneChanges,
    signalScore,
  };
}

/**
 * Builds sentence-bounded candidate windows and pre-filters low-signal content.
 */
export function buildAndFilterWindows(
  transcript: Transcript,
  signals?: Signals,
  config: Partial<HighlightConfig> = {}
): { allWindowsCount: number; filteredWindows: Window[] } {
  let minLength = config.minLength ?? 20;
  let maxLength = config.maxLength ?? 60;
  const avoidKeywords = config.avoidKeywords ?? [];
  const maxToKeep = config.maxWindowsForLlm ?? 100;

  // Handle edge case: short videos (< configured minLength)
  if (transcript.duration > 0 && transcript.duration < minLength) {
    minLength = Math.max(4, Math.floor(transcript.duration * 0.6));
    maxLength = Math.ceil(transcript.duration);
  }

  const sentences = extractSentences(transcript);
  if (sentences.length === 0) {
    return { allWindowsCount: 0, filteredWindows: [] };
  }

  const rawWindows: Window[] = [];
  let winId = 1;

  // Slide through sentences
  for (let i = 0; i < sentences.length; i++) {
    const startSentence = sentences[i];
    let windowSentences: Sentence[] = [];
    let currentWords: TranscriptWord[] = [];

    // Prior 1-2 sentences for context
    const contextStart = Math.max(0, i - 2);
    const contextBefore = sentences
      .slice(contextStart, i)
      .map((s) => s.text)
      .join(' ');

    for (let j = i; j < sentences.length; j++) {
      const currentSentence = sentences[j];
      windowSentences.push(currentSentence);
      currentWords.push(...currentSentence.words);

      const winStart = startSentence.start;
      const winEnd = currentSentence.end;
      const duration = winEnd - winStart;

      if (duration > maxLength) {
        break; // Exceeded maximum length
      }

      if (duration >= minLength) {
        // Valid sentence-bounded window found!
        const winText = windowSentences.map((s) => s.text).join(' ');
        const sig = aggregateWindowSignals(winStart, winEnd, signals);

        rawWindows.push({
          id: `win_${winId++}`,
          start: Math.round(winStart * 1000) / 1000,
          end: Math.round(winEnd * 1000) / 1000,
          duration: Math.round(duration * 1000) / 1000,
          text: winText,
          words: [...currentWords],
          sentences: [...windowSentences],
          contextBefore: contextBefore || undefined,
          signalScore: sig.signalScore,
          speechRatio: sig.speechRatio,
          wordsPerSecond: sig.wordsPerSecond,
          avgRms: sig.avgRms,
          maxSpike: sig.maxSpike,
          sceneChangeCount: sig.sceneChangeCount,
        });

        // Jump ahead in j if we found a nice complete thought
        if (duration >= minLength + 10) {
          break;
        }
      }
    }
  }

  // Fallback for short clips where sentence sequence is under minLength threshold
  if (rawWindows.length === 0 && sentences.length > 0) {
    const winStart = sentences[0].start;
    const winEnd = sentences[sentences.length - 1].end;
    const dur = Math.max(1, winEnd - winStart);
    const winText = sentences.map((s) => s.text).join(' ');
    const allWords = sentences.flatMap((s) => s.words);
    const sig = aggregateWindowSignals(winStart, winEnd, signals);
    rawWindows.push({
      id: `win_${winId++}`,
      start: Math.round(winStart * 1000) / 1000,
      end: Math.round(winEnd * 1000) / 1000,
      duration: Math.round(dur * 1000) / 1000,
      text: winText,
      words: allWords,
      sentences: [...sentences],
      signalScore: sig.signalScore,
      speechRatio: sig.speechRatio,
      wordsPerSecond: sig.wordsPerSecond,
      avgRms: sig.avgRms,
      maxSpike: sig.maxSpike,
      sceneChangeCount: sig.sceneChangeCount,
    });
  }

  const allWindowsCount = rawWindows.length;

  // Pre-filter:
  // 1. Drop avoid keywords
  // 2. Drop very low speech density (wordsPerSecond < 0.8 or speechRatio < 0.3)
  const passedPreFilter = rawWindows.filter((win) => {
    if (containsAvoidKeyword(win.text, avoidKeywords)) {
      return false;
    }
    if (win.wordsPerSecond < 0.8) {
      return false;
    }
    if (win.speechRatio < 0.25) {
      return false;
    }
    return true;
  });

  // Deduplicate overlapping candidate windows with stride merge
  // If window A and B overlap by >= 75%, keep the one with higher signalScore
  passedPreFilter.sort((a, b) => b.signalScore - a.signalScore);
  const deduplicated: Window[] = [];

  for (const candidate of passedPreFilter) {
    let hasHighOverlap = false;
    for (const kept of deduplicated) {
      const overlapStart = Math.max(candidate.start, kept.start);
      const overlapEnd = Math.min(candidate.end, kept.end);
      const overlapDur = Math.max(0, overlapEnd - overlapStart);
      const minDur = Math.min(candidate.duration, kept.duration);

      if (overlapDur / minDur >= 0.70) {
        hasHighOverlap = true;
        break;
      }
    }
    if (!hasHighOverlap) {
      deduplicated.push(candidate);
    }
  }

  // Keep top N highest signal windows (default 80-150, maxToKeep)
  const topWindows = deduplicated.slice(0, maxToKeep);

  // Re-sort chronologically for sequential LLM batch processing
  topWindows.sort((a, b) => a.start - b.start);

  return {
    allWindowsCount,
    filteredWindows: topWindows,
  };
}

/**
 * Stage 3 Orchestrator: Cached Candidate Windows generation and Pre-filtering.
 */
export function getCandidateWindows(
  sourceHash: string,
  transcript: Transcript,
  signals?: Signals,
  config: Partial<HighlightConfig> = {}
): { allWindowsCount: number; filteredWindows: Window[] } {
  const windowConfigHash = computeWindowConfigHash(config);

  const cached = loadCachedWindows(sourceHash, windowConfigHash);
  if (cached && cached.length > 0) {
    return {
      allWindowsCount: cached.length,
      filteredWindows: cached,
    };
  }

  const result = buildAndFilterWindows(transcript, signals, config);
  saveCachedWindows(sourceHash, windowConfigHash, result.filteredWindows);

  return result;
}
