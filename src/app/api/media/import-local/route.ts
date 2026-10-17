import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getProjectDir, saveProject } from '@/lib/storage/workspace';
import { probeMedia } from '@/lib/ffmpeg/probe';
import { createDefaultProject } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { filePath, name } = await req.json();

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'Missing local filePath' }, { status: 400 });
    }

    const cleanPath = filePath.trim().replace(/^["']|["']$/g, '');
    if (!fs.existsSync(cleanPath)) {
      return NextResponse.json({ error: `File not found on machine: ${cleanPath}` }, { status: 404 });
    }

    const projectId = `proj_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const originalName = path.basename(cleanPath);
    const projectName = (name && name.trim()) || path.parse(originalName).name || 'Imported Video';

    // Probe media with ffprobe
    const probe = probeMedia(cleanPath);

    // Create default project pointing to this file
    const project = createDefaultProject(projectId, projectName, cleanPath, originalName, probe);
    saveProject(project);

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error('Local import error:', error);
    return NextResponse.json({ error: error.message || 'Failed to import local video' }, { status: 500 });
  }
}
