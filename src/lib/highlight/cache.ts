import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Transcript, Signals, Window, ScoredWindow, Candidate, HighlightConfig } from './types';

const WORKSPACE_DIR = path.resolve(process.cwd(), '.workspace');
const HIGHLIGHT_CACHE_ROOT = path.join(WORKSPACE_DIR, 'highlight_cache');

export function ensureCacheRoot(): string {
  if (!fs.existsSync(HIGHLIGHT_CACHE_ROOT)) {
    fs.mkdirSync(HIGHLIGHT_CACHE_ROOT, { recursive: true });
  }
  return HIGHLIGHT_CACHE_ROOT;
}

/**
 * Computes a fast, collision-resistant hash of a media file without
 * reading gigabytes of data into memory for multi-hour videos.
 */
export function computeSourceHash(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file does not exist: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(`size:${stat.size}|mtime:${stat.mtimeMs}|`);

  const fd = fs.openSync(filePath, 'r');
  try {
    const headerBuf = Buffer.alloc(Math.min(65536, stat.size));
    const bytesReadHead = fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
    hash.update(headerBuf.subarray(0, bytesReadHead));

    if (stat.size > 65536) {
      const tailBuf = Buffer.alloc(65536);
      const tailOffset = Math.max(0, stat.size - 65536);
      const bytesReadTail = fs.readSync(fd, tailBuf, 0, tailBuf.length, tailOffset);
      hash.update(tailBuf.subarray(0, bytesReadTail));
    }
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest('hex').substring(0, 24);
}

/**
 * Computes a hash of window-generation settings.
 */
export function computeWindowConfigHash(config: Partial<HighlightConfig>): string {
  const norm = {
    min: config.minLength ?? 20,
    max: config.maxLength ?? 60,
    avoid: (config.avoidKeywords ?? []).map((k) => k.toLowerCase().trim()).sort(),
  };
  return crypto.createHash('sha256').update(JSON.stringify(norm)).digest('hex').substring(0, 16);
}

/**
 * Computes a hash of scoring settings.
 */
export function computeScoringConfigHash(config: Partial<HighlightConfig>): string {
  const norm = {
    brief: config.campaignBrief?.trim() || '',
    contentType: config.contentType || 'other',
    engine: config.scoringEngine || 'local',
    model: config.ollamaModel || 'llama3.2',
  };
  return crypto.createHash('sha256').update(JSON.stringify(norm)).digest('hex').substring(0, 16);
}

export function getSourceCacheDir(sourceHash: string): string {
  ensureCacheRoot();
  const dir = path.join(HIGHLIGHT_CACHE_ROOT, sourceHash);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ---------------- TRANSCRIPT CACHE ----------------
export function loadCachedTranscript(sourceHash: string): Transcript | null {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, 'transcript.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Transcript;
  } catch {
    return null;
  }
}

export function saveCachedTranscript(sourceHash: string, transcript: Transcript): void {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, 'transcript.json');
  fs.writeFileSync(file, JSON.stringify(transcript, null, 2), 'utf-8');
}

// ---------------- SIGNALS CACHE ----------------
export function loadCachedSignals(sourceHash: string): Signals | null {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, 'signals.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Signals;
  } catch {
    return null;
  }
}

export function saveCachedSignals(sourceHash: string, signals: Signals): void {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, 'signals.json');
  fs.writeFileSync(file, JSON.stringify(signals, null, 2), 'utf-8');
}

// ---------------- WINDOWS CACHE ----------------
export function loadCachedWindows(sourceHash: string, windowHash: string): Window[] | null {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, `windows_${windowHash}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Window[];
  } catch {
    return null;
  }
}

export function saveCachedWindows(sourceHash: string, windowHash: string, windows: Window[]): void {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, `windows_${windowHash}.json`);
  fs.writeFileSync(file, JSON.stringify(windows, null, 2), 'utf-8');
}

// ---------------- SCORES CACHE ----------------
export function loadCachedScores(sourceHash: string, scoringHash: string): ScoredWindow[] | null {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, `scores_${scoringHash}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ScoredWindow[];
  } catch {
    return null;
  }
}

export function saveCachedScores(sourceHash: string, scoringHash: string, scores: ScoredWindow[]): void {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, `scores_${scoringHash}.json`);
  fs.writeFileSync(file, JSON.stringify(scores, null, 2), 'utf-8');
}

// ---------------- CANDIDATES CACHE ----------------
export function loadCachedCandidates(sourceHash: string, fullHash: string): Candidate[] | null {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, `candidates_${fullHash}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Candidate[];
  } catch {
    return null;
  }
}

export function saveCachedCandidates(sourceHash: string, fullHash: string, candidates: Candidate[]): void {
  const dir = getSourceCacheDir(sourceHash);
  const file = path.join(dir, `candidates_${fullHash}.json`);
  fs.writeFileSync(file, JSON.stringify(candidates, null, 2), 'utf-8');
}
