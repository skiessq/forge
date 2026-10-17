import { NextRequest, NextResponse } from 'next/server';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getProject, saveProject } from '@/lib/storage/workspace';
import { findExecutable } from '@/lib/ffmpeg/systemCheck';
import { jobQueue } from '@/lib/jobs/queue';
import { SubtitleItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { projectId, language, modelSize } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const jobId = `job_transcribe_${Date.now()}`;
    jobQueue.createJob(jobId, 'transcription', projectId, 'Extracting audio for Whisper AI...');

    (async () => {
      try {
        const ffmpegExe = findExecutable('ffmpeg');
        const projectDir = path.dirname(project.source.path);
        const tempWavPath = path.join(projectDir, 'transcribe_audio.wav');

        // Extract 16kHz mono WAV for Whisper
        execSync(`"${ffmpegExe}" -y -i "${project.source.path}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${tempWavPath}"`, { stdio: 'pipe' });

        jobQueue.updateProgress(jobId, {
          status: 'running',
          progress: 25,
          stage: 'Transcribing speech with faster-whisper...',
        });

        const scriptPath = path.resolve(process.cwd(), 'scripts', 'transcribe_whisper.py');
        const pythonCmd = 'python';
        const args = [scriptPath, tempWavPath, language || 'auto', modelSize || 'base'];

        const child = spawn(pythonCmd, args, { windowsHide: true });
        jobQueue.registerProcess(jobId, child);

        let stdoutData = '';
        let stderrData = '';

        child.stdout.on('data', (c) => (stdoutData += c.toString()));
        child.stderr.on('data', (c) => {
          const text = c.toString();
          stderrData += text;
          if (text.includes('Loading') || text.includes('Transcribing')) {
            jobQueue.updateProgress(jobId, {
              status: 'running',
              progress: 55,
              stage: text.trim().slice(0, 80),
            });
          }
        });

        child.on('close', (code) => {
          jobQueue.unregisterProcess(jobId);
          // Cleanup temp wav
          try {
            if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
          } catch {}

          if (code === 0) {
            try {
              const parsed = JSON.parse(stdoutData.trim());
              const segments: SubtitleItem[] = parsed.segments || [];

              // Update project subtitles
              project.subtitles = segments;
              saveProject(project);

              jobQueue.updateProgress(jobId, {
                status: 'completed',
                progress: 100,
                stage: `Transcription complete! Generated ${segments.length} caption cues.`,
              });
            } catch (err: any) {
              jobQueue.updateProgress(jobId, {
                status: 'failed',
                stage: 'Failed to parse transcription output',
                error: err.message,
              });
            }
          } else {
            jobQueue.updateProgress(jobId, {
              status: 'failed',
              stage: 'Transcription failed',
              error: `Whisper script failed (code ${code}): ${stderrData.slice(-300)}`,
            });
          }
        });

        child.on('error', (err) => {
          jobQueue.unregisterProcess(jobId);
          jobQueue.updateProgress(jobId, {
            status: 'failed',
            stage: 'Failed to launch python',
            error: err.message,
          });
        });
      } catch (e: any) {
        jobQueue.updateProgress(jobId, {
          status: 'failed',
          stage: 'Transcription setup error',
          error: e.message,
        });
      }
    })();

    return NextResponse.json({ jobId, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
