import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { findExecutable } from '../ffmpeg/systemCheck';
import { Signals, PerSecondSignal, TranscriptWord } from './types';
import {
  getSourceCacheDir,
  loadCachedSignals,
  saveCachedSignals,
  computeSourceHash,
} from './cache';

export interface SignalsOptions {
  sourcePath: string;
  sourceDuration: number;
  words?: TranscriptWord[];
  sourceHash?: string;
  detectSceneChanges?: boolean;
  onProgress?: (progress: number, stage: string) => void;
  isCancelled?: () => boolean;
}

/**
 * Runs Python audio signal extractor.
 */
function runAudioSignalExtraction(
  wavPath: string,
  targetDuration: number
): Promise<{ duration: number; averageRmsDb: number; seconds: { second: number; rmsDb: number; spike: number; silenceRatio: number }[] }> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'extract_signals.py');
    const child = spawn(
      'python',
      [scriptPath, wavPath, targetDuration.toString()],
      { windowsHide: true }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch (err: any) {
          reject(new Error(`Failed to parse extract_signals output: ${err.message}`));
        }
      } else {
        reject(new Error(`Signal extraction failed (${code}): ${stderr.slice(-200)}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Extracts 16kHz mono audio from video file if WAV does not exist yet.
 */
function extractMasterAudio(
  ffmpegExe: string,
  sourcePath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegExe,
      ['-y', '-i', sourcePath, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath],
      { windowsHide: true }
    );

    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Master audio extraction failed (${code}): ${stderr.slice(-200)}`));
    });
    child.on('error', reject);
  });
}

/**
 * Optional fast scene-change detector using FFmpeg filter.
 */
function detectSceneChangeTimestamps(
  ffmpegExe: string,
  sourcePath: string,
  threshold = 0.35,
  maxDuration = 7200
): Promise<number[]> {
  return new Promise((resolve) => {
    const timestamps: number[] = [];
    const child = spawn(
      ffmpegExe,
      [
        '-t', maxDuration.toString(),
        '-i', sourcePath,
        '-filter:v', `select='gt(scene,${threshold})',showinfo`,
        '-f', 'null',
        '-',
      ],
      { windowsHide: true }
    );

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      const matches = text.matchAll(/pts_time:([0-9.]+)/g);
      for (const m of matches) {
        const t = parseFloat(m[1]);
        if (!isNaN(t)) timestamps.push(Math.round(t * 10) / 10);
      }
    });

    child.on('close', () => resolve(timestamps));
    child.on('error', () => resolve([]));
  });
}

/**
 * Computes words per second for each second interval.
 */
export function computeSpeechRatePerSecond(
  words: TranscriptWord[],
  totalSeconds: number
): number[] {
  const rates = new Array<number>(totalSeconds).fill(0);
  if (!words || words.length === 0) return rates;

  for (const w of words) {
    const sec = Math.min(totalSeconds - 1, Math.max(0, Math.floor(w.start)));
    rates[sec]++;
  }

  // Smooth speech rate across a 3-second window for stability
  const smoothed = new Array<number>(totalSeconds).fill(0);
  for (let s = 0; s < totalSeconds; s++) {
    let sum = 0;
    let count = 0;
    for (let offset = -1; offset <= 1; offset++) {
      const idx = s + offset;
      if (idx >= 0 && idx < totalSeconds) {
        sum += rates[idx];
        count++;
      }
    }
    smoothed[s] = Math.round((sum / count) * 10) / 10;
  }

  return smoothed;
}

/**
 * Stage 2 Orchestrator: Local audio and video signals extraction.
 */
export async function extractSignals(
  options: SignalsOptions
): Promise<Signals> {
  const {
    sourcePath,
    sourceDuration,
    words = [],
    detectSceneChanges = false,
    onProgress,
    isCancelled,
  } = options;

  const sourceHash = options.sourceHash || computeSourceHash(sourcePath);

  // Check cache
  const cached = loadCachedSignals(sourceHash);
  if (cached && cached.perSecond.length > 0) {
    onProgress?.(100, 'Using cached audio/video signals');
    return cached;
  }

  const cacheDir = getSourceCacheDir(sourceHash);
  const tempWav = path.join(cacheDir, 'signals_audio.wav');
  const ffmpegExe = findExecutable('ffmpeg');
  if (!ffmpegExe) {
    throw new Error('FFmpeg executable not found.');
  }

  onProgress?.(15, 'Extracting audio for signal timeline...');
  if (!fs.existsSync(tempWav)) {
    await extractMasterAudio(ffmpegExe, sourcePath, tempWav);
  }

  if (isCancelled?.()) throw new Error('Cancelled by user.');

  onProgress?.(45, 'Computing RMS loudness, volume spikes, and silence timeline...');
  const audioResult = await runAudioSignalExtraction(tempWav, sourceDuration);

  // Clean up temporary WAV to conserve disk space
  try {
    if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
  } catch {}

  if (isCancelled?.()) throw new Error('Cancelled by user.');

  onProgress?.(75, 'Computing speech rates from word timestamps...');
  const totalSeconds = audioResult.duration;
  const speechRates = computeSpeechRatePerSecond(words, totalSeconds);

  let sceneTimestamps: number[] = [];
  if (detectSceneChanges && sourceDuration <= 1800) {
    onProgress?.(85, 'Detecting visual scene changes via FFmpeg...');
    sceneTimestamps = await detectSceneChangeTimestamps(ffmpegExe, sourcePath, 0.35, sourceDuration);
  }

  const sceneSet = new Set(sceneTimestamps.map((t) => Math.floor(t)));

  const perSecond: PerSecondSignal[] = audioResult.seconds.map((s, idx) => ({
    second: s.second,
    rmsDb: s.rmsDb,
    spikeScore: s.spike,
    speechRate: speechRates[idx] || 0,
    silenceRatio: s.silenceRatio,
    hasSceneChange: sceneSet.has(s.second),
  }));

  const finalSignals: Signals = {
    duration: totalSeconds,
    perSecond,
    averageRmsDb: audioResult.averageRmsDb,
    sceneChanges: sceneTimestamps,
  };

  saveCachedSignals(sourceHash, finalSignals);
  onProgress?.(100, `Audio/video signal timeline generated for ${totalSeconds}s.`);

  return finalSignals;
}
