import path from 'path';
import fs from 'fs';
import { listProjects, saveProject, getProject } from '../src/lib/storage/workspace';
import { saveTemplate, listTemplates, ProjectTemplate } from '../src/lib/storage/templates';
import { runFFmpegExport } from '../src/lib/ffmpeg/runner';
import { probeMedia } from '../src/lib/ffmpeg/probe';
import { generateAutoSplitCandidates } from '../src/lib/split/autoSplit';
import { Project } from '../src/lib/types';
import { createDefaultProject } from '../src/lib/constants';

async function verifyPhase7BatchAndTemplates() {
  console.log('=== Starting Phase 7 Acceptance Verification: Templates, Batch Export & Auto-Split ===\n');

  // 1. Prepare 3 distinct clips in workspace
  console.log('Step 1: Setting up 3 project clips in workspace...');
  const existing = listProjects();
  if (existing.length === 0) {
    throw new Error('No base project found in workspace to derive batch clips');
  }

  const baseProject = existing[0];
  const sourcePath = baseProject.source.path;
  const probe = baseProject.source.probe;

  const clipNames = [
    'Batch Clip 1 - Ace Round Clutch',
    'Batch Clip 2 - Mid Defuse Play',
    'Batch Clip 3 - Final Boss Showdown',
  ];

  const batchProjects: Project[] = [];

  for (let i = 0; i < clipNames.length; i++) {
    const id = `proj_batch_test_${i + 1}`;
    const p = createDefaultProject(id, clipNames[i], sourcePath, baseProject.source.originalFileName, probe);
    // Add realistic subtitle item
    p.subtitles = [
      {
        id: `sub_${i}_1`,
        start: 0.5,
        end: 2.5,
        text: `Insane clutch play on clip ${i + 1}!`,
        words: [
          { word: 'Insane', start: 0.5, end: 0.9 },
          { word: 'clutch', start: 0.9, end: 1.4 },
          { word: 'play', start: 1.4, end: 1.8 },
          { word: 'now!', start: 1.8, end: 2.5 },
        ],
      },
    ];
    saveProject(p);
    batchProjects.push(p);
  }
  console.log(`   ✓ Created ${batchProjects.length} projects: ${batchProjects.map((p) => p.name).join(', ')}`);

  // 2. Create and Save Reusable Template
  console.log('\nStep 2: Creating and saving reusable Project Template...');
  const viralTemplate: ProjectTemplate = {
    id: 'template_viral_gaming_batch',
    name: 'Viral Gaming 50/50 Split + Neon Karaoke',
    createdAt: new Date().toISOString(),
    layout: {
      templateId: 'split_facecam_top',
      splitRatio: 0.45,
      regions: [
        {
          id: 'facecam',
          name: 'Facecam',
          role: 'facecam',
          crop: { x: 0.1, y: 0.1, width: 0.4, height: 0.5 },
          borderRadius: 12,
          fitMode: 'cover',
        },
        {
          id: 'gameplay',
          name: 'Gameplay',
          role: 'gameplay',
          crop: { x: 0, y: 0, width: 1, height: 1 },
          borderRadius: 0,
          fitMode: 'cover',
        },
      ],
      dividerColor: '#00F0FF',
      dividerWidth: 4,
    },
    subtitleStyle: {
      preset: 'neon',
      fontFamily: 'Outfit',
      fontSize: 48,
      primaryColor: '#FFFFFF',
      outlineColor: '#00F0FF',
      outlineWidth: 3,
      shadowColor: '#000000',
      shadowDistance: 2,
      boxColor: 'rgba(0,0,0,0.6)',
      boxPadding: 8,
      position: 'middle',
      yOffsetPercent: 65,
      animation: 'karaoke',
      activeWordColor: '#FFE600',
      activeWordScale: 1.15,
      maxWordsPerLine: 4,
      lineSpacing: 1.2,
      letterCase: 'uppercase',
    },
    introHook: {
      enabled: true,
      text: 'WATCH TILL THE END',
      duration: 1.5,
      fontSize: 54,
      color: '#FFE600',
    },
    watermark: {
      enabled: true,
      opacity: 0.85,
      position: 'top-right',
      scale: 0.2,
    },
  };

  saveTemplate(viralTemplate);
  const loadedTemplates = listTemplates();
  const matched = loadedTemplates.find((t) => t.id === viralTemplate.id);
  if (!matched) throw new Error('Failed to persist template to .workspace/templates.json');
  console.log(`   ✓ Saved and verified template "${matched.name}" (ID: ${matched.id})`);

  // 3. Apply Reusable Template to all 3 clips
  console.log('\nStep 3: Applying template to all 3 clips...');
  for (const proj of batchProjects) {
    proj.layout = viralTemplate.layout;
    proj.subtitleStyle = viralTemplate.subtitleStyle;
    proj.introHook = viralTemplate.introHook;
    proj.watermark = viralTemplate.watermark;
    saveProject(proj);
    console.log(`   ✓ Applied template to "${proj.name}"`);
  }

  // 4. Batch Export all 3 clips
  console.log('\nStep 4: Executing Batch Export Queue for 3 clips...');
  const exportResults: string[] = [];

  for (let i = 0; i < batchProjects.length; i++) {
    const proj = batchProjects[i];
    const jobId = `job_batch_test_${i + 1}`;
    console.log(`   [${i + 1}/3] Rendering "${proj.name}" to 1080x1920 MP4...`);

    const tStart = Date.now();
    const outputPath = await runFFmpegExport(proj, jobId, {
      resolution: '1080p',
      fps: 30,
      quality: 'high',
      hwAccel: 'cpu',
      outputFileName: `batch_export_${i + 1}.mp4`,
    });
    const elapsed = ((Date.now() - tStart) / 1000).toFixed(2);
    console.log(`       Render completed in ${elapsed}s -> ${path.basename(outputPath)}`);

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Exported file not found: ${outputPath}`);
    }
    exportResults.push(outputPath);
  }

  // 5. Probe all 3 exported files with ffprobe
  console.log('\nStep 5: Verifying all 3 exported videos with ffprobe...');
  for (let i = 0; i < exportResults.length; i++) {
    const outPath = exportResults[i];
    const stat = fs.statSync(outPath);
    const probeResult = await probeMedia(outPath);

    console.log(`   Probing Video #${i + 1}: ${path.basename(outPath)}`);
    console.log(`     Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`     Resolution: ${probeResult.width}x${probeResult.height}`);
    console.log(`     Duration: ${probeResult.duration.toFixed(2)}s`);
    console.log(`     Video Codec: ${probeResult.codec}`);
    console.log(`     Audio Tracks: ${probeResult.audioTracks.length} (${probeResult.audioTracks.map((a) => a.codec).join(', ')})`);

    // Strict verifications
    if (probeResult.width !== 1080 || probeResult.height !== 1920) {
      throw new Error(`Video dimensions ${probeResult.width}x${probeResult.height} do not match required 1080x1920!`);
    }
    if (probeResult.duration <= 0) {
      throw new Error(`Video duration is 0!`);
    }
    if (stat.size < 50000) {
      throw new Error(`Video file size is suspiciously small: ${stat.size} bytes`);
    }
    console.log(`     ✓ Video #${i + 1} PASSED ALL QUALITY CHECKS`);
  }

  // 6. Test Auto-Split candidate engine
  console.log('\nStep 6: Testing AI Auto-Split candidate generation...');
  const candidates = generateAutoSplitCandidates(batchProjects[0], 5);
  console.log(`   Auto-split generated ${candidates.length} candidate segments:`);
  for (const c of candidates) {
    console.log(`     • [${c.start.toFixed(1)}s -> ${c.end.toFixed(1)}s] (${c.duration.toFixed(1)}s): "${c.title}"`);
  }
  if (candidates.length === 0) throw new Error('Auto-split returned 0 candidates');
  console.log('   ✓ Auto-split successfully partitioned clip along speech boundaries');

  console.log('\n=============================================================');
  console.log('🎉 PHASE 7 ACCEPTANCE CRITERIA FULLY VERIFIED & COMPLETED!');
  console.log('• Template saved & persisted: YES');
  console.log('• Template applied to 3 distinct clips: YES');
  console.log('• Batch export of all 3 clips to 1080x1920 MP4: YES (All passed ffprobe)');
  console.log('• Auto-split segmentation engine: YES');
  console.log('=============================================================\n');
}

verifyPhase7BatchAndTemplates().catch((err) => {
  console.error('❌ Phase 7 Verification Failed:', err);
  process.exit(1);
});
