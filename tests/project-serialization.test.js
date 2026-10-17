const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  saveProject,
  getProject,
  listProjects,
  deleteProject,
} = require('../src/lib/storage/workspace.ts');
const { createDefaultProject } = require('../src/lib/constants.ts');

test('Project serialization round-trip persists and restores full project structure', () => {
  const testId = `proj_test_serialization_${Date.now()}`;
  const mockProbe = {
    duration: 15.5,
    width: 1920,
    height: 1080,
    fps: 60,
    codec: 'h264',
    bitrate: 4500000,
    audioTracks: [
      { index: 0, codec: 'aac', channels: 2, sampleRate: 48000, bitrate: 192000 },
    ],
  };

  const project = createDefaultProject(
    testId,
    'Serialization Test Clip',
    'C:/fake/path/source.mp4',
    'source.mp4',
    mockProbe
  );

  // Customize some fields
  project.layout.templateId = 'split_facecam_top';
  project.layout.splitRatio = 0.4;
  project.subtitleStyle.preset = 'neon';
  project.subtitleStyle.primaryColor = '#00F0FF';
  project.introHook = {
    enabled: true,
    text: 'SERIALIZATION TEST HOOK',
    duration: 2.0,
    fontSize: 52,
    color: '#FFE600',
  };
  project.watermark = {
    enabled: true,
    opacity: 0.75,
    position: 'top-left',
    scale: 0.15,
  };

  // 1. Save Project
  saveProject(project);

  // 2. Verify file exists on disk
  const projectFile = path.resolve(process.cwd(), '.workspace', testId, 'project.json');
  assert.ok(fs.existsSync(projectFile), 'project.json must exist in workspace');

  // 3. Load Project
  const restored = getProject(testId);
  assert.ok(restored !== null, 'restored project must not be null');
  assert.strictEqual(restored.id, testId);
  assert.strictEqual(restored.name, 'Serialization Test Clip');
  assert.strictEqual(restored.canvas.width, 1080);
  assert.strictEqual(restored.canvas.height, 1920);
  assert.strictEqual(restored.layout.templateId, 'split_facecam_top');
  assert.strictEqual(restored.layout.splitRatio, 0.4);
  assert.strictEqual(restored.subtitleStyle.preset, 'neon');
  assert.strictEqual(restored.introHook?.text, 'SERIALIZATION TEST HOOK');
  assert.strictEqual(restored.watermark?.opacity, 0.75);
  assert.strictEqual(restored.source.probe.width, 1920);
  assert.strictEqual(restored.tracks.length, 2);

  // 4. Verify listed in listProjects()
  const projects = listProjects();
  assert.ok(projects.some((p) => p.id === testId), 'project must be listed in listProjects()');

  // 5. Cleanup
  deleteProject(testId);
  assert.ok(!fs.existsSync(projectFile), 'deleted project directory must be removed');
});
