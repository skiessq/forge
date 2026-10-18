import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getProject, getProjectDir, saveProject } from '@/lib/storage/workspace';
import { probeMedia } from '@/lib/ffmpeg/probe';

export const dynamic = 'force-dynamic';

function getMediaTypeFromExtension(ext: string): 'video' | 'image' | 'gif' {
  const cleanExt = ext.toLowerCase().replace('.', '');
  if (cleanExt === 'gif') return 'gif';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'wmv'].includes(cleanExt)) {
    return 'video';
  }
  return 'image';
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Handle JSON body (e.g. local file path import)
    if (contentType.includes('application/json')) {
      const { projectId, localPath } = await req.json();
      if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
      }
      if (!localPath || typeof localPath !== 'string') {
        return NextResponse.json({ error: 'Missing local file path' }, { status: 400 });
      }

      const cleanPath = localPath.trim().replace(/^["']|["']$/g, '');
      if (!fs.existsSync(cleanPath)) {
        return NextResponse.json({ error: `File not found on machine: ${cleanPath}` }, { status: 404 });
      }

      const project = getProject(projectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const ext = path.extname(cleanPath);
      const mediaType = getMediaTypeFromExtension(ext);

      let probe: any = null;
      try {
        probe = probeMedia(cleanPath);
      } catch (err) {
        console.warn('Could not probe secondary media:', err);
      }

      project.layout.secondaryMediaPath = cleanPath;
      project.layout.secondaryMediaType = mediaType;
      if (probe) {
        project.layout.secondaryMediaProbe = {
          width: probe.width || 1920,
          height: probe.height || 1080,
          duration: probe.duration,
        };
      }
      saveProject(project);

      return NextResponse.json({
        success: true,
        secondaryMediaPath: cleanPath,
        secondaryMediaType: mediaType,
        secondaryMediaProbe: project.layout.secondaryMediaProbe,
        fileName: path.basename(cleanPath),
        project,
      });
    }

    // Handle Multipart FormData (file upload from browser)
    const formData = await req.formData();
    const projectId = formData.get('projectId') as string;
    const file = formData.get('file') as File | null;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No media file provided' }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectDir = getProjectDir(projectId);
    const originalName = file.name || 'secondary_media.mp4';
    const ext = path.extname(originalName) || '.mp4';
    const destinationPath = path.join(projectDir, `secondary_${Date.now()}${ext}`);

    // Stream file to disk in chunks to handle large videos seamlessly
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

    const mediaType = getMediaTypeFromExtension(ext);

    let probe: any = null;
    try {
      probe = probeMedia(destinationPath);
    } catch (err) {
      console.warn('Could not probe uploaded secondary media:', err);
    }

    project.layout.secondaryMediaPath = destinationPath;
    project.layout.secondaryMediaType = mediaType;
    if (probe) {
      project.layout.secondaryMediaProbe = {
        width: probe.width || 1920,
        height: probe.height || 1080,
        duration: probe.duration,
      };
    }
    saveProject(project);

    return NextResponse.json({
      success: true,
      secondaryMediaPath: destinationPath,
      secondaryMediaType: mediaType,
      secondaryMediaProbe: project.layout.secondaryMediaProbe,
      fileName: originalName,
      project,
    });
  } catch (error: any) {
    console.error('Secondary media upload error:', error);
    return NextResponse.json({ error: error.message || 'Secondary media upload failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    project.layout.secondaryMediaPath = undefined;
    project.layout.secondaryMediaType = undefined;
    project.layout.secondaryMediaProbe = undefined;
    saveProject(project);

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove secondary media' }, { status: 500 });
  }
}
