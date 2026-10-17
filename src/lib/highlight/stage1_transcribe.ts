import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { findExecutable } from '../ffmpeg/systemCheck';
import { Transcript, TranscriptSegment, TranscriptWord } from './types';
import {
  getSourceCacheDir,
  loadCachedTranscript,
  saveCachedTranscript,
  computeSourceHash,
} from './cache';

export interface ChunkInfo {
  index: number;
  start: number; // in seconds
  duration: number; // in seconds
  overlap: number; // in seconds
}

export interface TranscribeOptions {
  sourcePath: string;
  sourceDuration: number;
  language?: string;
  modelSize?: string;
  chunkDurationSec?: number; // default 600 (10 min)
  chunkOverlapSec?: number;  // default 5
  sourceHash?: string;
  onProgress?: (progress: number, stage: string, etaSeconds?: number) => void;
  isCancelled?: () => boolean;
}

/**
 * Calculates chunk boundaries with overlap across total duration.
 */
export function planChunks(
  totalDuration: number,
  chunkDuration = 600,
  overlap = 5
): ChunkInfo[] {
  if (totalDuration <= 0) return [];
  if (totalDuration <= chunkDuration + overlap) {
    return [{ index: 0, start: 0, duration: totalDuration, overlap: 0 }];
  }

  const chunks: ChunkInfo[] = [];
  let currentStart = 0;
  let idx = 0;

  while (currentStart < totalDuration) {
    const remaining = totalDuration - currentStart;
    const dur = Math.min(chunkDuration, remaining);
    chunks.push({
      index: idx,
      start: currentStart,
      duration: dur,
      overlap: idx === 0 ? 0 : overlap,
    });

    idx++;
    currentStart += chunkDuration - overlap;
    if (currentStart >= totalDuration) break;
  }

  return chunks;
}

/**
 * Runs faster-whisper on an audio chunk file via Python script.
 */
function runWhisperOnChunk(
  audioChunkPath: string,
  language: string,
  modelSize: string
): Promise<{ language: string; segments: TranscriptSegment[] }> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'transcribe_whisper.py');
    const child = spawn(
      'python',
      [scriptPath, audioChunkPath, language || 'auto', modelSize || 'base'],
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
          reject(new Error(`Failed to parse whisper chunk JSON: ${err.message}`));
        }
      } else {
        reject(new Error(`Whisper script exited with code ${code}: ${stderr.slice(-300)}`));
      }
    });

    child.on('error', (err) => reject(err));
  });
}

/**
 * Pure function to merge multiple chunk transcripts with overlap deduplication.
 */
export function mergeChunkTranscripts(
  chunkResults: { chunk: ChunkInfo; raw: { language: string; segments: TranscriptSegment[] } }[]
): { language: string; segments: TranscriptSegment[]; words: TranscriptWord[] } {
  if (chunkResults.length === 0) {
    return { language: 'en', segments: [], words: [] };
  }

  const detectedLanguage = chunkResults[0].raw.language || 'en';
  const allWords: TranscriptWord[] = [];
  const mergedSegments: TranscriptSegment[] = [];

  let globalWordIdx = 0;
  let globalSegIdx = 0;

  for (let i = 0; i < chunkResults.length; i++) {
    const { chunk, raw } = chunkResults[i];
    const chunkOffset = chunk.start;
    const prevChunk = i > 0 ? chunkResults[i - 1].chunk : null;

    // Overlap handover threshold in seconds (global time)
    // We hand over at the midpoint of the overlap window
    const handoverTime = prevChunk ? chunk.start + chunk.overlap / 2 : 0;

    for (const seg of raw.segments || []) {
      const segStartGlobal = round3(seg.start + chunkOffset);
      const segEndGlobal = round3(seg.end + chunkOffset);

      // If segment is entirely before handover point in this chunk, skip (covered by previous chunk)
      if (i > 0 && segEndGlobal <= handoverTime) {
        continue;
      }

      const segmentWords: TranscriptWord[] = [];
      for (const w of seg.words || []) {
        const wordStartGlobal = round3(w.start + chunkOffset);
        const wordEndGlobal = round3(w.end + chunkOffset);

        if (i > 0 && wordStartGlobal < handoverTime) {
          continue; // Covered by previous chunk
        }

        const cleanWord: TranscriptWord = {
          word: w.word.trim(),
          start: wordStartGlobal,
          end: wordEndGlobal,
        };
        segmentWords.push(cleanWord);
        allWords.push(cleanWord);
        globalWordIdx++;
      }

      if (segmentWords.length > 0) {
        mergedSegments.push({
          id: `seg_${++globalSegIdx}`,
          start: segmentWords[0].start,
          end: segmentWords[segmentWords.length - 1].end,
          text: seg.text.trim(),
          words: segmentWords,
          chunkIndex: chunk.index,
        });
      }
    }
  }

  return {
    language: detectedLanguage,
    segments: mergedSegments,
    words: allWords,
  };
}

function round3(num: number): number {
  return Math.round(num * 1000) / 1000;
}

/**
 * Extracts a chunk from master media/audio file to a 16kHz mono WAV using FFmpeg.
 */
function extractChunkAudio(
  ffmpegExe: string,
  sourcePath: string,
  start: number,
  duration: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegExe,
      [
        '-y',
        '-ss',
        start.toString(),
        '-t',
        duration.toString(),
        '-i',
        sourcePath,
        '-vn',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-c:a',
        'pcm_s16le',
        outputPath,
      ],
      { windowsHide: true }
    );

    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg audio chunk extraction failed (${code}): ${stderr.slice(-200)}`));
    });
    child.on('error', reject);
  });
}

/**
 * Stage 1 Orchestrator:
 * Chunked, resumable, cached transcription of full media.
 */
export async function transcribeWholeVideo(
  options: TranscribeOptions
): Promise<Transcript> {
  const {
    sourcePath,
    sourceDuration,
    language = 'auto',
    modelSize = 'base',
    chunkDurationSec = 600,
    chunkOverlapSec = 5,
    onProgress,
    isCancelled,
  } = options;

  const sourceHash = options.sourceHash || computeSourceHash(sourcePath);

  // Check cache first: never redo transcription if already finished
  const cached = loadCachedTranscript(sourceHash);
  if (cached && cached.segments.length > 0) {
    onProgress?.(100, 'Using cached transcript', 0);
    return cached;
  }

  const cacheDir = getSourceCacheDir(sourceHash);
  const chunksDir = path.join(cacheDir, 'whisper_chunks');
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const chunks = planChunks(sourceDuration, chunkDurationSec, chunkOverlapSec);
  const totalChunks = chunks.length;
  const chunkResults: { chunk: ChunkInfo; raw: any }[] = [];

  const ffmpegExe = findExecutable('ffmpeg');
  if (!ffmpegExe) {
    throw new Error('FFmpeg executable not found on system.');
  }

  const startTime = Date.now();

  for (let i = 0; i < totalChunks; i++) {
    if (isCancelled?.()) {
      throw new Error('Transcription cancelled by user.');
    }

    const chunk = chunks[i];
    const chunkJsonPath = path.join(chunksDir, `chunk_${chunk.index}.json`);

    // Check if chunk was already transcribed in a previous run (Resumability!)
    if (fs.existsSync(chunkJsonPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(chunkJsonPath, 'utf-8'));
        chunkResults.push({ chunk, raw });
        const pct = Math.round(((i + 1) / totalChunks) * 100);
        onProgress?.(pct, `Resumed chunk ${i + 1}/${totalChunks} from cache`);
        continue;
      } catch {
        // Corrupted chunk json, re-transcribe
      }
    }

    // Extract chunk audio
    const chunkWavPath = path.join(chunksDir, `audio_${chunk.index}.wav`);
    onProgress?.(
      Math.round((i / totalChunks) * 100),
      `Extracting audio chunk ${i + 1}/${totalChunks} (${Math.round(chunk.start)}s - ${Math.round(
        chunk.start + chunk.duration
      )}s)...`
    );

    await extractChunkAudio(ffmpegExe, sourcePath, chunk.start, chunk.duration, chunkWavPath);

    // Transcribe chunk
    const elapsedSoFar = (Date.now() - startTime) / 1000;
    const avgSecPerChunk = i > 0 ? elapsedSoFar / i : 20;
    const remainingChunks = totalChunks - i;
    const etaSec = Math.round(remainingChunks * avgSecPerChunk);

    onProgress?.(
      Math.round((i / totalChunks) * 100) + 2,
      `Transcribing chunk ${i + 1}/${totalChunks} with faster-whisper (${modelSize})...`,
      etaSec
    );

    let chunkOutput;
    try {
      chunkOutput = await runWhisperOnChunk(chunkWavPath, language, modelSize);
    } finally {
      // Clean up temporary WAV
      try {
        if (fs.existsSync(chunkWavPath)) fs.unlinkSync(chunkWavPath);
      } catch {}
    }

    // Persist chunk json immediately for crash recovery
    fs.writeFileSync(chunkJsonPath, JSON.stringify(chunkOutput, null, 2), 'utf-8');
    chunkResults.push({ chunk, raw: chunkOutput });

    const pct = Math.round(((i + 1) / totalChunks) * 100);
    onProgress?.(pct, `Completed chunk ${i + 1}/${totalChunks}`, Math.max(0, etaSec - Math.round(avgSecPerChunk)));
  }

  // Merge all chunks with overlap deduplication
  onProgress?.(98, 'Merging transcript chunks and de-duplicating boundaries...');
  const merged = mergeChunkTranscripts(chunkResults);

  const finalTranscript: Transcript = {
    language: merged.language,
    duration: sourceDuration,
    segments: merged.segments,
    words: merged.words,
    createdAt: new Date().toISOString(),
    sourceHash,
  };

  // Cache final transcript
  saveCachedTranscript(sourceHash, finalTranscript);
  onProgress?.(100, `Transcription complete! ${finalTranscript.words.length} words detected.`);

  return finalTranscript;
}
