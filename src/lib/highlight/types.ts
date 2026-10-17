export interface TranscriptWord {
  word: string;
  start: number; // in seconds relative to entire media
  end: number;   // in seconds relative to entire media
  score?: number;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
  chunkIndex?: number;
}

export interface Transcript {
  language: string;
  duration: number;
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  createdAt: string;
  sourceHash: string;
}

export interface PerSecondSignal {
  second: number;
  rmsDb: number;
  spikeScore: number; // deviation above local rolling average
  speechRate: number; // words per second
  silenceRatio: number; // 0..1 (fraction of second that is silence)
  hasSceneChange: boolean;
}

export interface Signals {
  duration: number;
  perSecond: PerSecondSignal[];
  averageRmsDb: number;
  sceneChanges: number[];
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
  words: TranscriptWord[];
}

export interface Window {
  id: string;
  start: number;
  end: number;
  duration: number;
  text: string;
  words: TranscriptWord[];
  sentences: Sentence[];
  contextBefore?: string;
  signalScore: number;
  speechRatio: number;
  wordsPerSecond: number;
  avgRms: number;
  maxSpike: number;
  sceneChangeCount: number;
}

export interface LlmScoreOutput {
  hook_strength: number;       // 0-10
  standalone_clarity: number;  // 0-10
  payoff: number;              // 0-10
  emotion_or_surprise: number; // 0-10
  brief_fit: number;           // 0-10
  risk_flags: string[];
  suggested_title: string;     // max 8 words
  reason: string;              // one sentence
}

export interface ScoringWeights {
  hook_strength: number;
  standalone_clarity: number;
  payoff: number;
  emotion_or_surprise: number;
  brief_fit: number;
  riskPenalty: number;
}

export interface ScoredWindow extends Window {
  rawScores: LlmScoreOutput;
  finalScore: number; // 0 - 100
  scoreBreakdown: Record<string, number>;
  adjustedStart: number;
  adjustedEnd: number;
  hookShifted: boolean;
}

export interface Candidate {
  id: string;
  rank: number;
  title: string;
  reason: string;
  score: number; // 0 - 100
  rawScores: LlmScoreOutput;
  start: number;
  end: number;
  duration: number;
  originalStart: number;
  originalEnd: number;
  riskFlags: string[];
  text: string;
  words: TranscriptWord[];
  status: 'pending' | 'approved' | 'rejected';
  userRating?: 'good' | 'bad';
}

export type ContentType = 'talking_podcast' | 'streamer_gameplay' | 'other';
export type ScoringEngineType = 'local' | 'api';

export interface HighlightConfig {
  campaignBrief?: string;
  minLength: number; // seconds, default 20
  maxLength: number; // seconds, default 60
  targetCount: number; // default 15
  contentType: ContentType;
  scoringEngine: ScoringEngineType;
  ollamaModel?: string; // default 'llama3.2'
  ollamaHost?: string;  // default 'http://127.0.0.1:11434'
  geminiApiKey?: string;
  avoidKeywords: string[];
  chunkDurationSec?: number; // default 600s (10 min)
  chunkOverlapSec?: number;   // default 5s
  whisperModel?: string;     // default 'base'
  maxWindowsForLlm?: number; // default 100
}

export interface HighlightStats {
  totalWindowsConsidered: number;
  survivedPreFilter: number;
  scoredCount: number;
  finalCandidatesCount: number;
  elapsedMs: number;
  costEstimateUsd: number;
  llmEngineUsed: string;
}

export interface HighlightJobResult {
  sourceHash: string;
  config: HighlightConfig;
  stats: HighlightStats;
  candidates: Candidate[];
  transcript: Transcript;
}
