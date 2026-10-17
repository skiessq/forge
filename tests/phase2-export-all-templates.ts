import path from 'path';
import fs from 'fs';
import { listProjects } from '../src/lib/storage/workspace';
import { getLayoutTemplate } from '../src/lib/constants';
import { buildFFmpegExportCommand } from '../src/lib/ffmpeg/builder';
import { findExecutable } from '../src/lib/ffmpeg/systemCheck';
import { probeMedia } from '../src/lib/ffmpeg/probe';
import { execSync } from 'child_process';
import { LayoutTemplateId } from '../src/lib/types';

async function verifyPhase2Templates() {
  console.log('=== Starting Phase 2: Export All 7 Templates Verification ===');

  const projects = listProjects();
  if (projects.length === 0) {
    throw new Error('No project found in workspace. Run sample generation first.');
  }

  const project = projects[0];
  console.log(`Using project: ${project.id} (${project.name})`);
  console.log(`Source: ${project.source.path}`);

  const ffmpegExe = findExecutable('ffmpeg');

  const templates: LayoutTemplateId[] = [
    'gameplay_full',
    'split_facecam_top',
    'split_gameplay_top',
    'media_top_game_bottom',
    'media_bottom_game_top',
    'blurred_background_fit',
    'picture_in_picture',
  ];

  const results: any[] = [];

  for (const tpl of templates) {
    console.log(`\nTesting template: ${tpl}...`);
    project.layout = getLayoutTemplate(tpl, 0.45);
    project.canvas = { width: 1080, height: 1920, fps: 30, aspectRatio: '9:16' };

    const outputFileName = `test_export_${tpl}.mp4`;
    const plan = buildFFmpegExportCommand(project, {
      outputFileName,
      resolution: '1080p',
      fps: 30,
      quality: 'fast',
      hwAccel: 'cpu', // software fallback for deterministic test
    });

    const exportDir = path.dirname(plan.outputPath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const startTime = Date.now();
    // Execute export
    const cmd = `"${ffmpegExe}" ${plan.args.map((a) => (a.includes(' ') || a.includes(';') || a.includes(':') ? `"${a}"` : a)).join(' ')}`;
    execSync(cmd, { stdio: 'pipe' });
    const durationMs = Date.now() - startTime;

    if (!fs.existsSync(plan.outputPath)) {
      throw new Error(`Exported file not found: ${plan.outputPath}`);
    }

    // Probe exported video
    const probe = probeMedia(plan.outputPath);
    const fileSize = fs.statSync(plan.outputPath).size;

    console.log(`  -> Exported successfully in ${(durationMs / 1000).toFixed(2)}s`);
    console.log(`  -> Dimensions: ${probe.width}x${probe.height}`);
    console.log(`  -> Duration: ${probe.duration.toFixed(2)}s`);
    console.log(`  -> Audio Codec: ${probe.audioCodec || 'none'}, Channels: ${probe.audioChannels || 0}`);
    console.log(`  -> File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

    if (probe.width !== 1080 || probe.height !== 1920) {
      throw new Error(`Template ${tpl} did not produce 1080x1920 (got ${probe.width}x${probe.height})`);
    }

    if (!probe.hasAudio) {
      throw new Error(`Template ${tpl} export is missing audio track!`);
    }

    results.push({
      template: tpl,
      resolution: `${probe.width}x${probe.height}`,
      duration: probe.duration,
      hasAudio: probe.hasAudio,
      fileSizeMb: (fileSize / (1024 * 1024)).toFixed(2),
    });
  }

  console.log('\n=== All 7 Templates Verified Successfully! ===');
  console.table(results);
}

verifyPhase2Templates().catch((err) => {
  console.error('Phase 2 verification failed:', err);
  process.exit(1);
});
