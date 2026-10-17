import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/storage/workspace';
import { generateAutoSplitCandidates, ShortCandidate } from '@/lib/split/autoSplit';
import { createDefaultProject } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { projectId, targetDuration, applyCandidates } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // If requesting candidate list
    if (!applyCandidates) {
      const candidates = generateAutoSplitCandidates(project, targetDuration || 30);
      return NextResponse.json({ candidates });
    }

    // If user confirmed candidate list to generate individual projects
    const createdProjects: any[] = [];
    for (const cand of applyCandidates as ShortCandidate[]) {
      const newId = `proj_short_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newProj = createDefaultProject(
        newId,
        cand.title,
        project.source.path,
        project.source.originalFileName,
        {
          ...project.source.probe,
          duration: cand.duration,
        }
      );

      // Copy layout, subtitle style, and audio settings
      newProj.layout = project.layout;
      newProj.subtitleStyle = project.subtitleStyle;
      newProj.audioSettings = project.audioSettings;

      // Filter subtitles to this candidate segment
      newProj.subtitles = project.subtitles
        .filter((s) => s.end >= cand.start && s.start <= cand.end)
        .map((s) => ({
          ...s,
          start: Math.max(0, s.start - cand.start),
          end: Math.min(cand.duration, s.end - cand.start),
        }));

      // Set video track to candidate slice
      newProj.tracks[0].clips = [
        {
          id: `clip_slice_${newId}`,
          type: 'video',
          trackId: newProj.tracks[0].id,
          start: 0,
          duration: cand.duration,
          sourceStart: cand.start,
          sourceDuration: cand.duration,
          mediaPath: project.source.path,
        },
      ];

      saveProject(newProj);
      createdProjects.push(newProj);
    }

    return NextResponse.json({ success: true, count: createdProjects.length, projects: createdProjects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
