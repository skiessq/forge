import {
  HighlightConfig,
  HighlightJobResult,
  HighlightStats,
  Transcript,
  Signals,
} from './types';
import { computeSourceHash } from './cache';
import { transcribeWholeVideo } from './stage1_transcribe';
import { extractSignals } from './stage2_signals';
import { getCandidateWindows } from './stage3_windows';
import { scoreCandidateWindows } from './stage4_scoring';
import { getRefinedCandidates } from './stage5_refine';
import { jobQueue } from '../jobs/queue';

export interface RunPipelineOptions {
  jobId: string;
  sourcePath: string;
  sourceDuration: number;
  config: HighlightConfig;
  onProgress?: (progress: number, stage: string, etaSeconds?: number) => void;
}

/**
 * Runs the end-to-end Auto-Highlight pipeline across Stages 1 through 5.
 */
export async function runAutoHighlightPipeline(
  options: RunPipelineOptions
): Promise<HighlightJobResult> {
  const { jobId, sourcePath, sourceDuration, config } = options;
  const startTime = Date.now();

  const isCancelled = () => {
    const job = jobQueue.getJob(jobId);
    return job?.status === 'cancelled';
  };

  const updateStage = (progress: number, stage: string, etaSeconds?: number) => {
    jobQueue.updateProgress(jobId, {
      status: 'running',
      progress,
      stage,
      etaSeconds,
    });
    options.onProgress?.(progress, stage, etaSeconds);
  };

  updateStage(2, 'Initializing Auto-Highlight pipeline and hashing source...');
  const sourceHash = computeSourceHash(sourcePath);

  // Stage 1: Transcribe the whole video (Chunked, resumable, cached)
  updateStage(5, 'Stage 1/5: Transcribing video with faster-whisper...');
  const transcript: Transcript = await transcribeWholeVideo({
    sourcePath,
    sourceDuration,
    language: 'auto',
    modelSize: config.whisperModel || 'base',
    chunkDurationSec: config.chunkDurationSec || 600,
    chunkOverlapSec: config.chunkOverlapSec || 5,
    sourceHash,
    onProgress: (pct, stageText, eta) => {
      // Stage 1 occupies 5% to 45% of total progress
      const mapped = 5 + Math.round((pct / 100) * 40);
      updateStage(mapped, `Stage 1/5: ${stageText}`, eta);
    },
    isCancelled,
  });

  if (isCancelled()) throw new Error('Pipeline cancelled by user.');

  // Stage 2: Audio and video signals (RMS, spikes, speech rate, silence)
  updateStage(48, 'Stage 2/5: Computing per-second audio & video signal hints...');
  const signals: Signals = await extractSignals({
    sourcePath,
    sourceDuration,
    words: transcript.words,
    sourceHash,
    detectSceneChanges: false,
    onProgress: (pct, stageText) => {
      // Stage 2 occupies 48% to 60% of total progress
      const mapped = 48 + Math.round((pct / 100) * 12);
      updateStage(mapped, `Stage 2/5: ${stageText}`);
    },
    isCancelled,
  });

  if (isCancelled()) throw new Error('Pipeline cancelled by user.');

  // Stage 3: Candidate windows and pre-filtering
  updateStage(62, 'Stage 3/5: Building sentence-bounded windows and pre-filtering...');
  const { allWindowsCount, filteredWindows } = getCandidateWindows(
    sourceHash,
    transcript,
    signals,
    config
  );

  updateStage(
    68,
    `Stage 3/5: Built ${allWindowsCount} candidate windows, pre-filtered down to ${filteredWindows.length} high-signal windows.`
  );

  if (isCancelled()) throw new Error('Pipeline cancelled by user.');

  // Stage 4: LLM Scoring (Local Ollama or Gemini API)
  updateStage(70, `Stage 4/5: Scoring windows with ${config.scoringEngine} LLM engine...`);
  const scoredWindows = await scoreCandidateWindows(
    filteredWindows,
    config,
    sourceHash,
    (pct, stageText) => {
      // Stage 4 occupies 70% to 92% of total progress
      const mapped = 70 + Math.round((pct / 100) * 22);
      updateStage(mapped, `Stage 4/5: ${stageText}`);
    },
    isCancelled
  );

  if (isCancelled()) throw new Error('Pipeline cancelled by user.');

  // Stage 5: Select and refine (overlap removal, diversity, boundary snapping)
  updateStage(94, 'Stage 5/5: Enforcing temporal diversity and snapping word boundaries...');
  const finalCandidates = getRefinedCandidates(
    sourceHash,
    scoredWindows,
    transcript.words,
    config,
    sourceDuration
  );

  const elapsedMs = Date.now() - startTime;
  const costEstimateUsd = config.scoringEngine === 'local' ? 0.0 : Math.round((filteredWindows.length * 0.00015) * 1000) / 1000;

  const stats: HighlightStats = {
    totalWindowsConsidered: allWindowsCount,
    survivedPreFilter: filteredWindows.length,
    scoredCount: scoredWindows.length,
    finalCandidatesCount: finalCandidates.length,
    elapsedMs,
    costEstimateUsd,
    llmEngineUsed: config.scoringEngine === 'local' ? `Ollama (${config.ollamaModel || 'llama3.2'})` : 'Gemini 1.5 Flash',
  };

  const result: HighlightJobResult = {
    sourceHash,
    config,
    stats,
    candidates: finalCandidates,
    transcript,
  };

  updateStage(100, `Complete! Selected top ${finalCandidates.length} viral candidates.`);

  jobQueue.updateProgress(jobId, {
    status: 'completed',
    progress: 100,
    stage: `Generated ${finalCandidates.length} viral candidates in ${Math.round(elapsedMs / 1000)}s`,
    message: JSON.stringify(result),
  });

  return result;
}
