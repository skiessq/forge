import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/storage/workspace';
import { detectSilences } from '@/lib/ffmpeg/silence';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { projectId, noiseThresholdDb, minDuration } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const silences = await detectSilences(
      project.source.path,
      noiseThresholdDb || -30,
      minDuration || 0.6
    );

    return NextResponse.json({ silences });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
