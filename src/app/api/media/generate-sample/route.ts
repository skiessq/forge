import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getProjectDir, saveProject } from '@/lib/storage/workspace';
import { findExecutable } from '@/lib/ffmpeg/systemCheck';
import { probeMedia } from '@/lib/ffmpeg/probe';
import { createDefaultProject } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const projectId = `proj_demo_${Date.now()}`;
    const projectDir = getProjectDir(projectId);
    const destPath = path.join(projectDir, 'source.mp4');
    const ffmpegExe = findExecutable('ffmpeg');

    // Generate a 12-second 1920x1080 test video with a moving gameplay-like testsrc and synthetic audio
    const cmd = `"${ffmpegExe}" -y -f lavfi -i testsrc=duration=12:size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:beep_factor=4:duration=12 -filter_complex "[0:v]drawbox=x=1360:y=60:w=500:h=380:color=white@0.8:t=4,drawtext=text='STREAMER CAM':x=1380:y=80:fontsize=32:fontcolor=yellow[v]" -map "[v]" -map 1:a -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${destPath}"`;

    execSync(cmd, { stdio: 'pipe' });

    if (!fs.existsSync(destPath)) {
      throw new Error('Failed to generate sample video file');
    }

    const probe = probeMedia(destPath);
    const project = createDefaultProject(projectId, 'Demo Gameplay & Cam Clip', destPath, 'sample_gameplay.mp4', probe);
    saveProject(project);

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Failed to generate sample video:', error);
    return NextResponse.json({ error: error.message || 'Sample generation failed' }, { status: 500 });
  }
}
