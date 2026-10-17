import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getProjectDir, saveProject } from '@/lib/storage/workspace';
import { probeMedia } from '@/lib/ffmpeg/probe';
import { createDefaultProject } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const customName = (formData.get('name') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const projectDir = getProjectDir(projectId);

    const originalName = file.name || 'source.mp4';
    const ext = path.extname(originalName) || '.mp4';
    const destinationPath = path.join(projectDir, `source${ext}`);

    // Stream file directly to disk in chunks to handle 2.8GB+ videos without memory bottlenecks
    const writeStream = fs.createWriteStream(destinationPath);
    // @ts-ignore
    const stream = file.stream();
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writeStream.write(Buffer.from(value));
    }
    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(true));
      writeStream.on('error', reject);
    });

    // Probe media with ffprobe
    const probe = probeMedia(destinationPath);
    const projectName = customName.trim() || path.parse(originalName).name || 'New Clip';

    const project = createDefaultProject(projectId, projectName, destinationPath, originalName, probe);
    saveProject(project);

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: error.message || 'File upload failed' }, { status: 500 });
  }
}
