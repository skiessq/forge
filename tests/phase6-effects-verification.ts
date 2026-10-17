import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { listProjects } from '../src/lib/storage/workspace';
import { buildFFmpegExportCommand } from '../src/lib/ffmpeg/builder';
import { findExecutable } from '../src/lib/ffmpeg/systemCheck';
import { probeMedia } from '../src/lib/ffmpeg/probe';
import { detectAutoPunchIns } from '../src/lib/effects/autoPunchIn';

async function verifyPhase6Effects() {
  console.log('=== Starting Phase 6: Transitions, Effects & Hooks Verification ===');

  const projects = listProjects();
  if (projects.length === 0) throw new Error('No project found');

  const project = JSON.parse(JSON.stringify(projects[0]));
  const ffmpegExe = findExecutable('ffmpeg');

  // 1. Test Auto Punch-In Detection
  console.log('1. Testing Auto Punch-In helper...');
  const punches = detectAutoPunchIns(project);
  console.log(`   Found ${punches.length} punch-in candidates:`, punches.map(p => `${p.time}s (${p.scale}x)`).join(', '));
  if (punches.length === 0) throw new Error('Failed to generate punch-in candidates');
  console.log('   ✓ SUCCESS: Auto punch-in detector generated valid zoom moments');

  // 2. Enable Intro Hook and Watermark
  console.log('2. Enabling Intro Hook Text & Watermark Overlay...');
  project.introHook = {
    enabled: true,
    text: 'WAIT FOR THE DROP',
    duration: 2.0,
    fontSize: 58,
    color: '#FFE600',
  };

  project.watermark = {
    enabled: true,
    opacity: 0.85,
    position: 'top-right',
    scale: 0.2,
  };

  const plan = buildFFmpegExportCommand(project, {
    outputFileName: 'effects_hook_watermark_export.mp4',
    hwAccel: 'cpu',
  });

  const argsStr = plan.args.join(' ');
  console.log('   Checking drawtext & drawbox in filtergraph...');
  if (!argsStr.includes('WAIT FOR THE DROP') || !argsStr.includes('CLIPFORGE')) {
    throw new Error('Filtergraph missing hook text or watermark drawtext filter!');
  }
  console.log('   ✓ SUCCESS: Hook text and watermark filters embedded in filtergraph');

  // 3. Render MP4 with effects
  console.log('3. Rendering video with Intro Hook and Watermark via FFmpeg...');
  const startTime = Date.now();
  const cmd = `"${ffmpegExe}" ${plan.args.map(a => (a.includes(' ') || a.includes(';') || a.includes(':') ? `"${a}"` : a)).join(' ')}`;
  execSync(cmd, { stdio: 'pipe' });
  const renderSecs = ((Date.now() - startTime) / 1000).toFixed(2);

  if (!fs.existsSync(plan.outputPath)) {
    throw new Error(`Exported MP4 not found: ${plan.outputPath}`);
  }

  const probe = probeMedia(plan.outputPath);
  const sizeMb = (fs.statSync(plan.outputPath).size / (1024 * 1024)).toFixed(2);
  console.log(`   ✓ Export completed in ${renderSecs}s (${sizeMb} MB)`);
  console.log(`   Dimensions: ${probe.width}x${probe.height}, FPS: ${probe.fps}, Duration: ${probe.duration.toFixed(1)}s`);

  if (probe.width !== 1080 || probe.height !== 1920) {
    throw new Error(`Expected 1080x1920, got ${probe.width}x${probe.height}`);
  }

  console.log('\n=== Phase 6 Effects Acceptance Fully Passed! ===');
}

verifyPhase6Effects().catch((err) => {
  console.error('Phase 6 verification error:', err);
  process.exit(1);
});
