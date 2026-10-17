import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { listProjects } from '../src/lib/storage/workspace';
import { buildFFmpegExportCommand } from '../src/lib/ffmpeg/builder';
import { findExecutable } from '../src/lib/ffmpeg/systemCheck';
import { probeMedia } from '../src/lib/ffmpeg/probe';
import { splitClip, deleteClip } from '../src/lib/timeline/operations';

async function verifyPhase5Timeline() {
  console.log('=== Starting Phase 5: Timeline Edits & Export Verification ===');

  const projects = listProjects();
  if (projects.length === 0) throw new Error('No project found');

  const project = JSON.parse(JSON.stringify(projects[0]));
  const ffmpegExe = findExecutable('ffmpeg');

  console.log('1. Applying timeline edits (split clip at 4.0s and delete segment 2)...');
  const videoTrack = project.tracks.find((t: any) => t.type === 'video');
  const originalClipId = videoTrack.clips[0].id;

  // Split clip at 4.0s
  const splitRes = splitClip(videoTrack, originalClipId, 4.0);
  videoTrack.clips = splitRes.track.clips;
  console.log(`   Split into 2 clips: Clip 1 (${videoTrack.clips[0].duration}s), Clip 2 (${videoTrack.clips[1].duration}s)`);

  // Delete clip 2 with ripple
  const deleteRes = deleteClip(videoTrack, splitRes.splitClipId!, true);
  videoTrack.clips = deleteRes.clips;
  console.log(`   Deleted Clip 2. Remaining clip duration: ${videoTrack.clips[0].duration}s`);

  // 2. Build export command
  console.log('2. Building export command with timeline edits...');
  const plan = buildFFmpegExportCommand(project, {
    outputFileName: 'timeline_trimmed_export.mp4',
    hwAccel: 'cpu',
  });

  const argsStr = plan.args.join(' ');
  if (!argsStr.includes('trim=')) {
    throw new Error('Export command filtergraph does not contain trim filter!');
  }
  console.log('   ✓ SUCCESS: trim filter present in FFmpeg filtergraph');

  // 3. Execute export
  console.log('3. Rendering exported video with timeline cut...');
  const cmd = `"${ffmpegExe}" ${plan.args.map(a => (a.includes(' ') || a.includes(';') || a.includes(':') ? `"${a}"` : a)).join(' ')}`;
  execSync(cmd, { stdio: 'pipe' });

  if (!fs.existsSync(plan.outputPath)) {
    throw new Error(`Exported MP4 not found: ${plan.outputPath}`);
  }

  // 4. Probe output file duration
  const probe = probeMedia(plan.outputPath);
  console.log(`   Exported Dimensions: ${probe.width}x${probe.height}`);
  console.log(`   Exported Duration:   ${probe.duration.toFixed(2)}s (Target was 4.00s)`);

  if (Math.abs(probe.duration - 4.0) > 0.5) {
    throw new Error(`Exported duration ${probe.duration}s does not match timeline edit (expected ~4.0s)`);
  }

  console.log('   ✓ SUCCESS: Timeline edit is directly reflected in the exported video duration!');
  console.log('\n=== Phase 5 Timeline Acceptance Fully Passed! ===');
}

verifyPhase5Timeline().catch((err) => {
  console.error('Phase 5 verification error:', err);
  process.exit(1);
});
