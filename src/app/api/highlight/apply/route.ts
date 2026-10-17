import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/storage/workspace';
import { listTemplates, ProjectTemplate } from '@/lib/storage/templates';
import { createDefaultProject } from '@/lib/constants';
import { Candidate } from '@/lib/highlight/types';
import { SubtitleItem, SubtitleWord } from '@/lib/types';

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

    for (const cand of approvedCandidates as Candidate[]) {
      const newId = `proj_hl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const cleanTitle = cand.title?.trim() || `Viral Highlight (${Math.round(cand.start)}s - ${Math.round(cand.end)}s)`;

      const newProj = createDefaultProject(
        newId,
        cleanTitle,
        baseProject.source.path,
        baseProject.source.originalFileName,
        {
          ...baseProject.source.probe,
          duration: cand.duration,
        }
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

      // Apply Hook Title as intro hook banner
      newProj.introHook = {
        enabled: true,
        text: cleanTitle.toUpperCase(),
        duration: Math.min(2.5, Math.max(1.5, Math.round(cand.duration * 0.08 * 10) / 10)),
        fontSize: template?.introHook?.fontSize || 54,
        color: template?.introHook?.color || '#FFE600',
        transition: 'pop_in',
      };

      // Set Timeline Video Track slice
      newProj.tracks[0].clips = [
        {
          id: `clip_hl_${newId}`,
          type: 'video',
          trackId: newProj.tracks[0].id,
          start: 0,
          duration: cand.duration,
          sourceStart: cand.start,
          sourceDuration: cand.duration,
          mediaPath: baseProject.source.path,
        },
      ];

      // Pre-fill Subtitles from existing candidate words / base transcript
      const shiftedSubtitles: SubtitleItem[] = [];

      if (cand.words && cand.words.length > 0) {
        // Group candidate words into 3-4 word phrase cues
        const wordsPerCue = newProj.subtitleStyle.maxWordsPerLine || 4;
        let currentCueWords: SubtitleWord[] = [];
        let cueIdx = 1;

        for (let wIdx = 0; wIdx < cand.words.length; wIdx++) {
          const rawWord = cand.words[wIdx];
          const shiftedStart = Math.max(0, Math.round((rawWord.start - cand.start) * 1000) / 1000);
          const shiftedEnd = Math.min(cand.duration, Math.round((rawWord.end - cand.start) * 1000) / 1000);

          currentCueWords.push({
            word: rawWord.word,
            start: shiftedStart,
            end: shiftedEnd,
          });

          const isLast = wIdx === cand.words.length - 1;
          if (currentCueWords.length >= wordsPerCue || isLast) {
            shiftedSubtitles.push({
              id: `sub_${cueIdx++}`,
              start: currentCueWords[0].start,
              end: currentCueWords[currentCueWords.length - 1].end,
              text: currentCueWords.map((cw) => cw.word).join(' '),
              words: [...currentCueWords],
            });
            currentCueWords = [];
          }
        }
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
