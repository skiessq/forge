import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { listProjects } from '../src/lib/storage/workspace';
import { buildFFmpegExportCommand } from '../src/lib/ffmpeg/builder';
import { findExecutable } from '../src/lib/ffmpeg/systemCheck';
import { probeMedia } from '../src/lib/ffmpeg/probe';
import { SUBTITLE_PRESETS } from '../src/lib/constants';

async function verifyPhase4Subtitles() {
  console.log('=== Starting Phase 4: Subtitles Verification ===');

  const projects = listProjects();
  if (projects.length === 0) throw new Error('No project found');

  const project = projects[0];
  const ffmpegExe = findExecutable('ffmpeg');

  // Add sample subtitle with word timestamps
  project.subtitles = [
    {
      id: 'sub_test_1',
      start: 0.5,
      end: 3.5,
      text: 'WELCOME TO CLIPFORGE STUDIO',
      words: [
        { word: 'WELCOME', start: 0.5, end: 1.2 },
        { word: 'TO', start: 1.3, end: 1.6 },
        { word: 'CLIPFORGE', start: 1.7, end: 2.6 },
        { word: 'STUDIO', start: 2.7, end: 3.5 },
      ],
    },
    {
      id: 'sub_test_2',
      start: 4.0,
      end: 7.0,
      text: 'WORD LEVEL KARAOKE HIGHLIGHT',
      words: [
        { word: 'WORD', start: 4.0, end: 4.6 },
        { word: 'LEVEL', start: 4.7, end: 5.3 },
        { word: 'KARAOKE', start: 5.4, end: 6.2 },
        { word: 'HIGHLIGHT', start: 6.3, end: 7.0 },
      ],
    },
  ];

  project.subtitleStyle = { ...SUBTITLE_PRESETS.yellow_active };

  console.log('1. Building export command with ASS subtitle burn-in...');
  const plan = buildFFmpegExportCommand(project, {
    outputFileName: 'subtitles_burned_export.mp4',
    hwAccel: 'cpu',
  });

  const argsStr = plan.args.join(' ');
  console.log('   Checking subtitles filter in filtergraph...');
  if (!argsStr.includes('subtitles=')) {
    throw new Error('Filtergraph missing subtitles filter!');
  }
  console.log('   ✓ SUCCESS: subtitles filter present with escaped path');

  // Verify subtitles.ass was written
  const assPath = path.join(path.dirname(project.source.path), 'subtitles.ass');
  if (!fs.existsSync(assPath)) {
    throw new Error(`subtitles.ass not generated at ${assPath}`);
  }
  const assContent = fs.readFileSync(assPath, 'utf-8');
  console.log('   ✓ SUCCESS: subtitles.ass generated on disk');
  if (!assContent.includes('KARAOKE')) {
    throw new Error('subtitles.ass does not contain expected subtitle words');
  }

  // 2. Execute export with burned subtitles
  console.log('2. Rendering MP4 with burned-in subtitles via FFmpeg libass...');
  const startTime = Date.now();
  const cmd = `"${ffmpegExe}" ${plan.args.map(a => (a.includes(' ') || a.includes(';') || a.includes(':') ? `"${a}"` : a)).join(' ')}`;
  execSync(cmd, { stdio: 'pipe' });
  const renderSecs = ((Date.now() - startTime) / 1000).toFixed(2);

  if (!fs.existsSync(plan.outputPath)) {
    throw new Error(`Exported MP4 not found: ${plan.outputPath}`);
  }

  // Probe output file
  const probe = probeMedia(plan.outputPath);
  const fileSizeMb = (fs.statSync(plan.outputPath).size / (1024 * 1024)).toFixed(2);

  console.log(`   ✓ Export completed in ${renderSecs}s (${fileSizeMb} MB)`);
  console.log(`   Dimensions: ${probe.width}x${probe.height}, FPS: ${probe.fps}, Duration: ${probe.duration.toFixed(1)}s`);

  if (probe.width !== 1080 || probe.height !== 1920) {
    throw new Error(`Invalid output dimensions: ${probe.width}x${probe.height}`);
  }

  console.log('\n=== Phase 4 Subtitles Acceptance Fully Passed! ===');
}

verifyPhase4Subtitles().catch((err) => {
  console.error('Phase 4 verification error:', err);
  process.exit(1);
});
