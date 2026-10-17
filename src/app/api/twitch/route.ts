import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getProjectDir, saveProject } from '@/lib/storage/workspace';
import { probeMedia } from '@/lib/ffmpeg/probe';
import { findExecutable } from '@/lib/ffmpeg/systemCheck';
import { createDefaultProject } from '@/lib/constants';
import { jobQueue } from '@/lib/jobs/queue';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { url, name } = await req.json();

    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return NextResponse.json({ error: 'Please provide a valid clip URL (e.g. Twitch clip URL)' }, { status: 400 });
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const jobId = `job_dl_${Date.now()}`;
    const projectDir = getProjectDir(projectId);
    const destinationPath = path.join(projectDir, 'source.mp4');

    jobQueue.createJob(jobId, 'twitch_download', projectId, 'Starting clip download...');

    // Asynchronously run yt-dlp
    (async () => {
      try {
        const ytDlpExe = findExecutable('yt-dlp');
        // If standalone yt-dlp is not in PATH, we can invoke python -m yt_dlp
        let cmd = ytDlpExe;
        let args = [
          url.trim(),
          '-o', destinationPath,
          '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '--newline',
          '--no-playlist',
          '--no-continue',
        ];

        // Check if command is python module fallback
        if (ytDlpExe === 'yt-dlp') {
          // test if plain yt-dlp works or fallback to python -m yt_dlp
          try {
            const { execSync } = require('child_process');
            execSync(`"${ytDlpExe}" --version`, { stdio: 'ignore' });
          } catch {
            cmd = 'python';
            args = ['-m', 'yt_dlp', ...args];
          }
        }

        const child = spawn(cmd, args, { windowsHide: true });
        jobQueue.registerProcess(jobId, child);

        child.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          // Match "[download]  45.2% of 25.12MiB at 4.50MiB/s ETA 00:03"
          const match = text.match(/\[download\]\s+([\d\.]+)%/);
          if (match) {
            const pct = Math.min(99, Math.round(parseFloat(match[1])));
            const etaMatch = text.match(/ETA\s+([\d:]+)/);
            jobQueue.updateProgress(jobId, {
              status: 'running',
              progress: pct,
              stage: `Downloading clip... ${pct}%${etaMatch ? ` (ETA ${etaMatch[1]})` : ''}`,
            });
          }
        });

        child.stderr.on('data', (chunk: Buffer) => {
          const errText = chunk.toString();
          console.warn('[yt-dlp stderr]:', errText);
        });

        child.on('close', (code) => {
          jobQueue.unregisterProcess(jobId);

          if (code === 0 && fs.existsSync(destinationPath)) {
            jobQueue.updateProgress(jobId, {
              status: 'running',
              progress: 95,
              stage: 'Probing clip metadata...',
            });

            const probe = probeMedia(destinationPath);
            const projectName = name?.trim() || `Twitch Clip (${new Date().toLocaleDateString()})`;
            const project = createDefaultProject(projectId, projectName, destinationPath, 'source.mp4', probe);
            project.source.twitchUrl = url;
            saveProject(project);

            jobQueue.updateProgress(jobId, {
              status: 'completed',
              progress: 100,
              stage: 'Clip downloaded and ready!',
              resultUrl: `/editor/${projectId}`,
            });
          } else {
            jobQueue.updateProgress(jobId, {
              status: 'failed',
              stage: 'Download failed',
              error: `yt-dlp exited with code ${code}. Check if clip is private, expired, or invalid.`,
            });
          }
        });

        child.on('error', (err) => {
          jobQueue.unregisterProcess(jobId);
          jobQueue.updateProgress(jobId, {
            status: 'failed',
            stage: 'Failed to launch downloader',
            error: err.message,
          });
        });
      } catch (e: any) {
        jobQueue.updateProgress(jobId, {
          status: 'failed',
          stage: 'Unexpected download error',
          error: e.message,
        });
      }
    })();

    return NextResponse.json({ jobId, projectId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
