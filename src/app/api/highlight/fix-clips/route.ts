import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { findExecutable } from '@/lib/ffmpeg/systemCheck';
import { probeMedia } from '@/lib/ffmpeg/probe';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workspaceDir = path.resolve(process.cwd(), '.workspace');
    if (!fs.existsSync(workspaceDir)) {
      return NextResponse.json({ message: 'No workspace found' });
    }

    const ffmpegExe = findExecutable('ffmpeg');
    const projects = fs.readdirSync(workspaceDir, { withFileTypes: true });
    const fixedProjects: string[] = [];

    for (const entry of projects) {
      if (!entry.isDirectory() || !entry.name.startsWith('proj_hl_')) continue;

      const projDir = path.join(workspaceDir, entry.name);
      const jsonPath = path.join(projDir, 'project.json');
      if (!fs.existsSync(jsonPath)) continue;

      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const project = JSON.parse(raw);
        const clip = project.tracks?.[0]?.clips?.[0];

        if (!clip) continue;

        const cutSourcePath = path.join(projDir, 'source.mp4');
        const sourceExists = fs.existsSync(cutSourcePath) && fs.statSync(cutSourcePath).size > 1000;

        if (!sourceExists && clip.sourceStart > 0 && fs.existsSync(project.source?.path)) {
          console.log(`Cutting media for ${project.id}: [${clip.sourceStart}s -> +${clip.duration}s]...`);
          const cutCmd = `"${ffmpegExe}" -y -ss ${clip.sourceStart.toFixed(3)} -t ${clip.duration.toFixed(3)} -i "${project.source.path}" -c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 192k "${cutSourcePath}"`;
          execSync(cutCmd, { stdio: 'pipe' });
        }

        if (fs.existsSync(cutSourcePath) && fs.statSync(cutSourcePath).size > 1000) {
          project.source.path = cutSourcePath;
          project.source.originalFileName = `clip_${path.basename(cutSourcePath)}`;
          try {
            project.source.probe = probeMedia(cutSourcePath);
          } catch {}

          clip.sourceStart = 0;
          clip.mediaPath = cutSourcePath;
          clip.duration = project.source.probe?.duration || clip.duration;

          // Apply clean viral TikTok subtitle styling (natural casing, 4px stroke with paint-order fill, neon yellow highlight)
          project.subtitleStyle = {
            fontFamily: 'Montserrat',
            fontSize: 54,
            primaryColor: '#FFFFFF',
            highlightColor: '#FFE600',
            outlineColor: '#000000',
            outlineWidth: 5,
            shadowColor: 'rgba(0,0,0,0.9)',
            shadowDistance: 3,
            textTransform: 'none',
            position: 'bottom',
            verticalOffset: -120,
            maxWordsPerLine: 4,
            lineSpacing: 1.2,
            animation: 'karaoke_highlight',
          };

          fs.writeFileSync(jsonPath, JSON.stringify(project, null, 2), 'utf-8');
          fixedProjects.push(project.id);
        }
      } catch (err: any) {
        console.error(`Error fixing project ${entry.name}:`, err.message);
      }
    }

    return NextResponse.json({
      success: true,
      fixedCount: fixedProjects.length,
      fixedProjects,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
