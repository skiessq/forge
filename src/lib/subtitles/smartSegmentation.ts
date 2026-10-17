import { SubtitleItem, SubtitleWord } from '../types';

export interface SmartSegmentationOptions {
  maxWordsPerCue?: number; // default 3-4
  maxDurationSec?: number; // default 3.0s
  pauseThresholdSec?: number; // default 0.35s
  extendCueToNextSec?: number; // default 0.4s to prevent flicker
}

/**
 * Intelligent, viral-optimized subtitle segmentation.
 * 
 * Rules:
 * 1. Punctuation Priority: A sentence ending with (. ! ?) ALWAYS ends the cue immediately.
 *    A new sentence will NEVER start as a trailing word in the previous cue (e.g. fixes "meta right now? Do").
 * 2. Clause Breaks: Words ending with (, ; :) break if cue has 2+ words.
 * 3. Conversational Pauses: Silence gaps >= 0.35s between words start a new cue.
 * 4. Word Cadence: 3 to 4 words per cue (ideal for TikTok/Reels reading speed).
 * 5. Anti-Flicker: Cues smoothly extend their visual presence until the next cue starts (up to 0.4s).
 * 6. Stutter Cleanup: Eliminates accidental Whisper stutter/duplicate words.
 */
export function smartSegmentWords(
  rawWords: { word: string; start: number; end: number }[],
  options: SmartSegmentationOptions = {}
): SubtitleItem[] {
  if (!rawWords || rawWords.length === 0) return [];

  const maxWords = options.maxWordsPerCue || 4;
  const maxDur = options.maxDurationSec || 2.8;
  const pauseThreshold = options.pauseThresholdSec || 0.35;
  const extendLimit = options.extendCueToNextSec || 0.4;

  // 1. Clean up repeated adjacent word hallucinations from Whisper
  const cleanedWords: { word: string; start: number; end: number }[] = [];
  for (let i = 0; i < rawWords.length; i++) {
    const cur = rawWords[i];
    const prev = cleanedWords[cleanedWords.length - 1];

    if (
      prev &&
      prev.word.toLowerCase().replace(/[^a-z0-9]/g, '') === cur.word.toLowerCase().replace(/[^a-z0-9]/g, '') &&
      cur.start - prev.end < 0.2
    ) {
      // Skip stutter/duplicate hallucination
      continue;
    }
    cleanedWords.push(cur);
  }

  const cues: SubtitleItem[] = [];
  let currentGroup: { word: string; start: number; end: number }[] = [];
  let cueIdx = 1;

  for (let i = 0; i < cleanedWords.length; i++) {
    const w = cleanedWords[i];
    currentGroup.push(w);

    const isLast = i === cleanedWords.length - 1;
    const nextWord = !isLast ? cleanedWords[i + 1] : null;

    const cleanWord = w.word.trim();
    const isSentenceTerminus = /[.!?]$/.test(cleanWord);
    const isClauseBreak = /[,;:]$/.test(cleanWord);
    const hasLongPause = nextWord ? (nextWord.start - w.end >= pauseThreshold) : false;
    const curDuration = w.end - currentGroup[0].start;

    // Boundary decision:
    let shouldBreak = false;

    if (isLast) {
      shouldBreak = true;
    } else if (isSentenceTerminus) {
      // Hard break: sentence is over! Never drag the next word into this cue.
      shouldBreak = true;
    } else if (hasLongPause && currentGroup.length >= 2) {
      // Natural breath pause
      shouldBreak = true;
    } else if (isClauseBreak && currentGroup.length >= 2) {
      // Comma / clause boundary
      shouldBreak = true;
    } else if (currentGroup.length >= maxWords) {
      // Word limit reached
      shouldBreak = true;
    } else if (curDuration >= maxDur && currentGroup.length >= 2) {
      // Duration limit reached
      shouldBreak = true;
    }

    if (shouldBreak && currentGroup.length > 0) {
      const cueStart = Math.round(currentGroup[0].start * 1000) / 1000;
      let cueEnd = Math.round(currentGroup[currentGroup.length - 1].end * 1000) / 1000;

      // Anti-flicker: if next word is within extendLimit, extend cue to bridge the micro-pause
      if (nextWord && nextWord.start > cueEnd && nextWord.start - cueEnd <= extendLimit) {
        cueEnd = Math.round((nextWord.start - 0.04) * 1000) / 1000;
      }

      const cueWords: SubtitleWord[] = currentGroup.map((cw) => ({
        word: cw.word,
        start: Math.round(cw.start * 1000) / 1000,
        end: Math.round(cw.end * 1000) / 1000,
      }));

      cues.push({
        id: `sub_${cueIdx++}`,
        start: cueStart,
        end: Math.max(cueStart + 0.4, cueEnd),
        text: currentGroup.map((cw) => cw.word).join(' '),
        words: cueWords,
      });

      currentGroup = [];
    }
  }

  return cues;
}
