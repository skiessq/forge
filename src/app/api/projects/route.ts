import { NextResponse } from 'next/server';
import { listProjects, saveProject } from '@/lib/storage/workspace';
import { createDefaultProject } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = listProjects();
    return NextResponse.json({ projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const name = body.name || 'Untitled Clip';
    const sourcePath = body.sourcePath || '';
    const originalFileName = body.originalFileName || 'source.mp4';
    const probe = body.probe || {
      width: 1920,
      height: 1080,
      duration: 15,
      fps: 30,
      codec: 'h264',
      bitrate: 4000000,
      hasAudio: true,
      audioTracks: [{ index: 0, title: 'Default Audio', language: 'und', channels: 2, codec: 'aac' }],
    };

    const project = createDefaultProject(id, name, sourcePath, originalFileName, probe);
    saveProject(project);

    return NextResponse.json({ project });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
