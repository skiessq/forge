const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { findExecutable } = require('../src/lib/ffmpeg/systemCheck.ts');
const { probeMedia } = require('../src/lib/ffmpeg/probe.ts');
const { createDefaultProject } = require('../src/lib/constants.ts');
const { saveProject, getProjectDir, deleteProject } = require('../src/lib/storage/workspace.ts');
const { runFFmpegExport } = require('../src/lib/ffmpeg/runner.ts');

test('End-to-End Pipeline: sample clip -> layout -> fixture subtitles -> 1080x1920 MP4 export', async () => {
  const ffmpegExe = findExecutable('ffmpeg');
  assert.ok(ffmpegExe, 'FFmpeg binary must be available');

  const projectId = `proj_ci_e2e_${Date.now()}`;
  const projectDir = getProjectDir(projectId);
  const samplePath = path.join(projectDir, 'sample.mp4');

  // 1. Generate a tiny 2-second 1920x1080 test video with audio
  const genCmd = `"${ffmpegExe}" -y -f lavfi -i testsrc=duration=2:size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:duration=2 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k "${samplePath}"`;
  execSync(genCmd, { stdio: 'pipe' });
  assert.ok(fs.existsSync(samplePath), 'Tiny sample video must be created');

  const probe = await probeMedia(samplePath);
  assert.strictEqual(probe.width, 1920);
  assert.strictEqual(probe.height, 1080);

  // 2. Create Project
  const project = createDefaultProject(projectId, 'CI E2E Test Short', samplePath, 'sample.mp4', probe);

  // 3. Apply Layout Template
  project.layout.templateId = 'split_facecam_top';
  project.layout.splitRatio = 0.5;

  // 4. Add Subtitles from fixture transcript
  project.subtitles = [
    {
      id: 'sub_fixture_1',
      start: 0.2,
      end: 1.8,
      text: 'CLUTCH MOMENT',
      words: [
        { word: 'CLUTCH', start: 0.2, end: 1.0 },
        { word: 'MOMENT', start: 1.0, end: 1.8 },
      ],
    },
  ];
  project.subtitleStyle.preset = 'yellow_highlight';
  project.subtitleStyle.animation = 'karaoke';

  saveProject(project);

  // 5. Run FFmpeg Export
  const jobId = `job_ci_${Date.now()}`;
  const exportedPath = await runFFmpegExport(project, jobId, {
    resolution: '1080p',
    fps: 30,
    quality: 'fast',
    hwAccel: 'cpu',
    outputFileName: 'ci_test_export.mp4',
  });

  // 6. Verify Export
  assert.ok(fs.existsSync(exportedPath), 'Exported MP4 must exist');
  const exportProbe = await probeMedia(exportedPath);

  assert.strictEqual(exportProbe.width, 1080, 'Exported width must be 1080');
  assert.strictEqual(exportProbe.height, 1920, 'Exported height must be 1920 (9:16)');
  assert.strictEqual(exportProbe.codec, 'h264', 'Video codec must be h264');
  assert.ok(exportProbe.duration > 0, 'Exported duration must be > 0');
  assert.ok(exportProbe.audioTracks.length > 0, 'Audio track must be present in export');

  // 7. Cleanup
  deleteProject(projectId);
});
