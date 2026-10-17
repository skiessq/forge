import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { listProjects } from '../src/lib/storage/workspace';
import { buildFFmpegExportCommand } from '../src/lib/ffmpeg/builder';
import { findExecutable } from '../src/lib/ffmpeg/systemCheck';
import { probeMedia } from '../src/lib/ffmpeg/probe';

async function verifyPhase3Audio() {
  console.log('=== Starting Phase 3: Audio Verification ===');

  const projects = listProjects();
  if (projects.length === 0) throw new Error('No projects found');

  const project = projects[0];
  const ffmpegExe = findExecutable('ffmpeg');
  const tempDir = path.join(process.cwd(), '.workspace', 'test_audio_verify');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  console.log('1. Checking default audio settings (untouched bitstream copy)...');
  assert(project.audioSettings.keepOriginalAudio === true, 'keepOriginalAudio must default to true');
  assert(project.audioSettings.normalizeLoudness === false, 'normalizeLoudness must default to false');
  assert(project.audioSettings.duckGameAudio === false, 'duckGameAudio must default to false');

  const plan = buildFFmpegExportCommand(project, {
    outputFileName: 'audio_default_export.mp4',
    hwAccel: 'cpu',
  });

  // Check command flags
  const argsStr = plan.args.join(' ');
  console.log('   Plan audio flags:', argsStr.includes('-c:a copy') ? '-c:a copy (Bitstream Copy)' : 'Other');
  if (!argsStr.includes('-c:a copy')) {
    throw new Error('Default export must use -c:a copy for byte-for-byte untouched audio preservation');
  }

  // Execute export
  console.log('2. Exporting with default audio...');
  execSync(`"${ffmpegExe}" ${plan.args.map(a => (a.includes(' ') || a.includes(';') || a.includes(':') ? `"${a}"` : a)).join(' ')}`, { stdio: 'pipe' });

  // Extract raw audio from source
  const srcAudioPath = path.join(tempDir, 'src_audio.aac');
  execSync(`"${ffmpegExe}" -y -i "${project.source.path}" -vn -c:a copy "${srcAudioPath}"`, { stdio: 'pipe' });

  // Extract raw audio from exported file
  const outAudioPath = path.join(tempDir, 'out_audio.aac');
  execSync(`"${ffmpegExe}" -y -i "${plan.outputPath}" -vn -c:a copy "${outAudioPath}"`, { stdio: 'pipe' });

  // Calculate SHA256 hashes
  const srcHash = crypto.createHash('sha256').update(fs.readFileSync(srcAudioPath)).digest('hex');
  const outHash = crypto.createHash('sha256').update(fs.readFileSync(outAudioPath)).digest('hex');

  console.log(`   Source Audio Hash:   ${srcHash}`);
  console.log(`   Exported Audio Hash: ${outHash}`);

  if (srcHash !== outHash) {
    throw new Error('Audio stream hash mismatch! Original audio was not preserved byte-for-byte.');
  }
  console.log('   ✓ SUCCESS: Audio stream is byte-for-byte IDENTICAL (SHA256 Match)!');

  // Verify ffprobe stream audio metadata
  const probeSrc = probeMedia(project.source.path);
  const probeOut = probeMedia(plan.outputPath);

  console.log(`   Source Codec: ${probeSrc.audioCodec}, Channels: ${probeSrc.audioChannels}`);
  console.log(`   Export Codec: ${probeOut.audioCodec}, Channels: ${probeOut.audioChannels}`);

  if (probeSrc.audioCodec !== probeOut.audioCodec || probeSrc.audioChannels !== probeOut.audioChannels) {
    throw new Error('Audio stream format metadata mismatch!');
  }

  // 3. Test Optional Loudness Normalization
  console.log('\n3. Testing Optional Loudness Normalization (loudnorm)...');
  const normProject = JSON.parse(JSON.stringify(project));
  normProject.audioSettings.normalizeLoudness = true;

  const normPlan = buildFFmpegExportCommand(normProject, {
    outputFileName: 'audio_norm_export.mp4',
    hwAccel: 'cpu',
  });

  const normArgsStr = normPlan.args.join(' ');
  if (!normArgsStr.includes('loudnorm')) {
    throw new Error('Filtergraph missing loudnorm filter when normalizeLoudness is enabled');
  }
  console.log('   ✓ SUCCESS: loudnorm filter included in filtergraph');

  // Cleanup temp files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== Phase 3 Audio Rules Acceptance Fully Passed! ===');
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

verifyPhase3Audio().catch((err) => {
  console.error('Phase 3 verification error:', err);
  process.exit(1);
});
