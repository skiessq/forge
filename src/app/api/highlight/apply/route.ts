import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject, getProjectDir } from '@/lib/storage/workspace';
import { listTemplates, ProjectTemplate } from '@/lib/storage/templates';
import { createDefaultProject } from '@/lib/constants';
import { Candidate } from '@/lib/highlight/types';
import { SubtitleItem, SubtitleWord } from '@/lib/types';
import { findExecutable } from '@/lib/ffmpeg/systemCheck';
import { probeMedia } from '@/lib/ffmpeg/probe';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { smartSegmentWords } from '@/lib/subtitles/smartSegmentation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { sourceProjectId, templateId, approvedCandidates } = await req.json();

    if (!sourceProjectId) {
      return NextResponse.json({ error: 'Missing sourceProjectId' }, { status: 400 });
    }

    const baseProject = getProject(sourceProjectId);
    if (!baseProject) {
      return NextResponse.json({ error: 'Source project not found' }, { status: 404 });
    }

    if (!approvedCandidates || !Array.isArray(approvedCandidates) || approvedCandidates.length === 0) {
      return NextResponse.json({ error: 'No approved candidates provided' }, { status: 400 });
    }

    // Load template if specified
    let template: ProjectTemplate | undefined;
    if (templateId) {
      const templates = listTemplates();
      template = templates.find((t) => t.id === templateId);
    }

    const createdProjects: any[] = [];
    const ffmpegExe = findExecutable('ffmpeg');

    for (const cand of approvedCandidates as Candidate[]) {
      const newId = `proj_hl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const cleanTitle = cand.title?.trim() || `Viral Highlight (${Math.round(cand.start)}s - ${Math.round(cand.end)}s)`;

      const projectDir = getProjectDir(newId);
      const cutVideoPath = path.join(projectDir, 'source.mp4');

      // 1. Physically cut video & audio slice using native FFmpeg
      let hasCutFile = false;
      if (ffmpegExe && fs.existsSync(baseProject.source.path)) {
        try {
          // -ss before -i for fast seek, accurate encoding to guarantee zero audio drift and exact frame cuts
          const cutCmd = `"${ffmpegExe}" -y -ss ${cand.start.toFixed(3)} -t ${cand.duration.toFixed(3)} -i "${baseProject.source.path}" -c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 192k "${cutVideoPath}"`;
          execSync(cutCmd, { stdio: 'pipe' });
          if (fs.existsSync(cutVideoPath) && fs.statSync(cutVideoPath).size > 1000) {
            hasCutFile = true;
          }
        } catch (cutErr) {
          console.error(`Failed re-encode cut for candidate ${cand.id}, attempting stream copy fallback:`, cutErr);
          try {
            const copyCmd = `"${ffmpegExe}" -y -ss ${cand.start.toFixed(3)} -t ${cand.duration.toFixed(3)} -i "${baseProject.source.path}" -c copy "${cutVideoPath}"`;
            execSync(copyCmd, { stdio: 'pipe' });
            if (fs.existsSync(cutVideoPath) && fs.statSync(cutVideoPath).size > 1000) {
              hasCutFile = true;
            }
          } catch (copyErr) {
            console.error(`Failed stream copy fallback:`, copyErr);
          }
        }
      }

      const activeSourcePath = hasCutFile ? cutVideoPath : baseProject.source.path;
      const originalFileName = hasCutFile
        ? `${path.parse(baseProject.source.originalFileName).name}_clip_${Math.round(cand.start)}s.mp4`
        : baseProject.source.originalFileName;

      let probe = baseProject.source.probe;
      if (hasCutFile) {
        try {
          probe = probeMedia(cutVideoPath);
        } catch {
          probe = { ...baseProject.source.probe, duration: cand.duration };
        }
      } else {
        probe = { ...baseProject.source.probe, duration: cand.duration };
      }

      const newProj = createDefaultProject(
        newId,
        cleanTitle,
        activeSourcePath,
        originalFileName,
        probe
      );

      // Apply Layout
      if (template?.layout) {
        newProj.layout = JSON.parse(JSON.stringify(template.layout));
      } else {
        newProj.layout = JSON.parse(JSON.stringify(baseProject.layout));
      }

      // Apply Subtitle Style
      if (template?.subtitleStyle) {
        newProj.subtitleStyle = JSON.parse(JSON.stringify(template.subtitleStyle));
      } else {
        newProj.subtitleStyle = JSON.parse(JSON.stringify(baseProject.subtitleStyle));
      }

      // Apply Audio Settings
      if (template?.audioSettings) {
        newProj.audioSettings = JSON.parse(JSON.stringify(template.audioSettings));
      } else {
        newProj.audioSettings = JSON.parse(JSON.stringify(baseProject.audioSettings));
      }

      // Apply Watermark
      if (template?.watermark) {
        newProj.watermark = JSON.parse(JSON.stringify(template.watermark));
      }

      // Apply Hook Title as intro hook banner (matching viral subtitle format)
      newProj.introHook = {
        enabled: true,
        text: cleanTitle,
        duration: Math.min(2.5, Math.max(1.5, Math.round(cand.duration * 0.08 * 10) / 10)),
        fontSize: newProj.subtitleStyle?.fontSize || 54,
        color: '#FFFFFF',
        highlightColor: '#FFE600',
        backgroundColor: 'transparent',
        outlineWidth: newProj.subtitleStyle?.outlineWidth || 5,
        outlineColor: newProj.subtitleStyle?.outlineColor || '#000000',
        fontFamily: newProj.subtitleStyle?.fontFamily || 'Montserrat',
        transition: 'pop_in',
      };

      // Set Timeline Video Track slice
      newProj.tracks[0].clips = [
        {
          id: `clip_hl_${newId}`,
          type: 'video',
          trackId: newProj.tracks[0].id,
          start: 0,
          duration: probe.duration || cand.duration,
          sourceStart: hasCutFile ? 0 : cand.start,
          sourceDuration: probe.duration || cand.duration,
          mediaPath: activeSourcePath,
        },
      ];

      // Pre-fill Subtitles with intelligent punctuation & pause-aware segmentation
      const shiftedSubtitles: SubtitleItem[] = [];

      if (cand.words && cand.words.length > 0) {
        const shiftedWords = cand.words.map((w) => ({
          word: w.word,
          start: Math.max(0, Math.round((w.start - cand.start) * 1000) / 1000),
          end: Math.min(cand.duration, Math.round((w.end - cand.start) * 1000) / 1000),
        }));

        const segmented = smartSegmentWords(shiftedWords, {
          maxWordsPerCue: newProj.subtitleStyle.maxWordsPerLine || 4,
          maxDurationSec: 2.8,
          pauseThresholdSec: 0.35,
        });

        shiftedSubtitles.push(...segmented);
      } else if (baseProject.subtitles && baseProject.subtitles.length > 0) {
        // Fallback: filter base subtitles
        const overlapping = baseProject.subtitles.filter(
          (s) => s.end >= cand.start && s.start <= cand.end
        );
        for (let sIdx = 0; sIdx < overlapping.length; sIdx++) {
          const s = overlapping[sIdx];
          const cueStart = Math.max(0, Math.round((s.start - cand.start) * 1000) / 1000);
          const cueEnd = Math.min(cand.duration, Math.round((s.end - cand.start) * 1000) / 1000);

          const shiftedWords: SubtitleWord[] = (s.words || []).map((w) => ({
            word: w.word,
            start: Math.max(0, Math.round((w.start - cand.start) * 1000) / 1000),
            end: Math.min(cand.duration, Math.round((w.end - cand.start) * 1000) / 1000),
          }));

          shiftedSubtitles.push({
            id: `sub_${sIdx + 1}`,
            start: cueStart,
            end: cueEnd,
            text: s.text,
            words: shiftedWords,
          });
        }
      }

      newProj.subtitles = shiftedSubtitles;

      // Save new project to workspace
      saveProject(newProj);
      createdProjects.push(newProj);
    }

    return NextResponse.json({
      success: true,
      count: createdProjects.length,
      projects: createdProjects.map((p) => ({ id: p.id, name: p.name, duration: p.source.probe.duration })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
