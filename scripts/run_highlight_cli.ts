import path from 'path';
import fs from 'fs';
import { runAutoHighlightPipeline } from '../src/lib/highlight/pipeline';
import { HighlightConfig } from '../src/lib/highlight/types';
import { probeMedia } from '../src/lib/ffmpeg/probe';
import { listProjects, getProject } from '../src/lib/storage/workspace';

async function main() {
  console.log('========================================================');
  console.log('       CLIPFORGE AUTO-HIGHLIGHT PIPELINE CLI           ');
  console.log('========================================================\n');

  // Find a video in workspace or accept from CLI arguments
  const args = process.argv.slice(2);
  let videoPath = args[0];

  if (!videoPath) {
    const projects = listProjects();
    if (projects.length === 0) {
      console.error('[ERROR] No projects found in .workspace. Pass a video path: npx tsx scripts/run_highlight_cli.ts <videoPath>');
      process.exit(1);
    }
    const targetProj = projects[0];
    videoPath = targetProj.source.path;
    console.log(`[INFO] Using media from project: "${targetProj.name}" (${videoPath})`);
  } else {
    console.log(`[INFO] Using media path: ${videoPath}`);
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`[ERROR] Video file does not exist: ${videoPath}`);
    process.exit(1);
  }

  console.log('[INFO] Probing media duration and format...');
  const probe = await probeMedia(videoPath);
  console.log(`   ✓ Duration: ${Math.round(probe.duration)}s (${Math.round(probe.duration / 60)} min)`);
  console.log(`   ✓ Resolution: ${probe.width}x${probe.height} @ ${probe.fps}fps`);
  console.log(`   ✓ Audio: ${probe.hasAudio ? 'Detected' : 'None'}\n`);

  const config: HighlightConfig = {
    campaignBrief: 'Focus on high energy moments and clutch plays',
    minLength: 20,
    maxLength: 60,
    targetCount: 5,
    contentType: 'streamer_gameplay',
    scoringEngine: 'local', // Falls back automatically if Ollama not running
    ollamaModel: 'llama3.2',
    avoidKeywords: ['gambling', 'politics', 'slur'],
    chunkDurationSec: 600,
    chunkOverlapSec: 5,
  };

  const jobId = `cli_test_${Date.now()}`;
  console.log('[INFO] Starting multi-stage Auto-Highlight run...');

  const startTime = Date.now();
  const result = await runAutoHighlightPipeline({
    jobId,
    sourcePath: videoPath,
    sourceDuration: probe.duration,
    config,
    onProgress: (pct, stageText, eta) => {
      const etaStr = eta !== undefined ? ` (ETA: ${eta}s)` : '';
      console.log(`   [${pct}%] ${stageText}${etaStr}`);
    },
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n========================================================');
  console.log('                  PIPELINE SUMMARY                      ');
  console.log('========================================================');
  console.log(`Total Windows Evaluated:   ${result.stats.totalWindowsConsidered}`);
  console.log(`Passed Pre-Filter:         ${result.stats.survivedPreFilter}`);
  console.log(`Windows Scored by AI:      ${result.stats.scoredCount}`);
  console.log(`Final Selected Candidates: ${result.stats.finalCandidatesCount}`);
  console.log(`Execution Time:            ${totalTime}s`);
  console.log(`Estimated Cost:            $${result.stats.costEstimateUsd.toFixed(2)}`);
  console.log(`Scoring Engine Used:       ${result.stats.llmEngineUsed}\n`);

  console.log('========================================================');
  console.log('                TOP RANKED CANDIDATES                   ');
  console.log('========================================================');

  result.candidates.forEach((cand, idx) => {
    console.log(`\n#${idx + 1} [Score: ${cand.score}/100] "${cand.title}"`);
    console.log(`   Range:    ${cand.start.toFixed(1)}s - ${cand.end.toFixed(1)}s (${cand.duration.toFixed(1)}s)`);
    console.log(`   Reason:   ${cand.reason}`);
    console.log(`   Hook:     ${cand.rawScores.hook_strength}/10 | Clarity: ${cand.rawScores.standalone_clarity}/10 | Payoff: ${cand.rawScores.payoff}/10`);
    if (cand.riskFlags.length > 0) {
      console.log(`   Risks:    ${cand.riskFlags.join(', ')}`);
    }
  });

  console.log('\n✓ Manual end-to-end Auto-Highlight run completed successfully.');
}

main().catch((e) => {
  console.error('\n[FATAL ERROR]', e);
  process.exit(1);
});
