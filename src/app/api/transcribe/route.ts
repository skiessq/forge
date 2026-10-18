import { NextRequest, NextResponse } from 'next/server';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getProject, saveProject } from '@/lib/storage/workspace';
import { findExecutable } from '@/lib/ffmpeg/systemCheck';
import { jobQueue } from '@/lib/jobs/queue';
import { SubtitleItem, SubtitleWord } from '@/lib/types';
import { smartSegmentWords } from '@/lib/subtitles/smartSegmentation';

export const dynamic = 'force-dynamic';

function findPythonExecutable(): string {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
    'C:\\Python311\\python.exe',
    'C:\\Python312\\python.exe',
    'python',
  ];
  for (const cand of candidates) {
    if (cand && fs.existsSync(cand)) return cand;
  }
  return 'python';
}

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
        const tempWavPath = path.join(projectDir, `transcribe_audio_${Date.now()}.wav`);

        // Check if project has a video clip on timeline to extract only that clip range
        const videoTrack = project.tracks.find((t) => t.type === 'video');
        const clip = videoTrack?.clips?.[0];
        let trimArgs = '';
        if (
          clip &&
          ((clip.sourceStart ?? 0) > 0 || ((clip.duration ?? 0) > 0 && (clip.duration ?? 0) < (project.source.probe?.duration || 10) - 0.5))
        ) {
          trimArgs = `-ss ${(clip.sourceStart ?? 0).toFixed(2)} -t ${(clip.duration ?? 0).toFixed(2)}`;
        }

        // Fast direct audio extraction at 16kHz mono (takes <1s, no blocking multi-pass filter)
        execSync(`"${ffmpegExe}" -y ${trimArgs} -i "${project.source.path}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${tempWavPath}"`, { stdio: 'pipe' });

        jobQueue.updateProgress(jobId, {
          status: 'running',
          progress: 20,
          stage: 'Loading Whisper model into GPU memory...',
        });

        const scriptPath = path.resolve(process.cwd(), 'scripts', 'transcribe_whisper.py');
        const pythonCmd = findPythonExecutable();
        const args = ['-u', scriptPath, tempWavPath, language || 'auto', modelSize || 'small'];

        const child = spawn(pythonCmd, args, {
          windowsHide: true,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });
        jobQueue.registerProcess(jobId, child);

        let stdoutData = '';
        let stderrData = '';

        child.stdout.on('data', (c) => {
          const str = c.toString();
          stdoutData += str;
          const match = str.match(/PROGRESS:([0-9.]+):([0-9.]+):([0-9.]+):([0-9.]+)/);
          if (match) {
            const [, curr, total, pct, speed] = match;
            const currentSec = parseFloat(curr);
            const totalSec = parseFloat(total);
            const parsedPct = parseFloat(pct);
            const calculatedPct = totalSec > 0 ? (currentSec / totalSec) * 100 : parsedPct;
            jobQueue.updateProgress(jobId, {
              status: 'running',
              progress: Math.min(95, Math.max(30, Math.round(calculatedPct))),
              stage: `Transcribing at ${speed}x realtime (${currentSec.toFixed(0)}s / ${totalSec.toFixed(0)}s)...`,
            });
          }
        });

        child.stderr.on('data', (c) => {
          const text = c.toString();
          stderrData += text;
          if (text.includes('Loading') && !text.includes('Successfully')) {
            jobQueue.updateProgress(jobId, {
              status: 'running',
              progress: 25,
              stage: 'Initializing Whisper model on GPU...',
            });
          } else if (text.includes('Transcribing')) {
            jobQueue.updateProgress(jobId, {
              status: 'running',
              progress: 35,
              stage: 'Running GPU neural inference...',
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
              let jsonStr = stdoutData.trim();
              if (jsonStr.includes('FINAL_RESULT:')) {
                jsonStr = jsonStr.split('FINAL_RESULT:')[1].trim();
              } else {
                const jsonStart = jsonStr.indexOf('{');
                const jsonEnd = jsonStr.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                  jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
                }
              }
              const parsed = JSON.parse(jsonStr);
              const rawSegments: SubtitleItem[] = parsed.segments || [];

              const allWords: SubtitleWord[] = [];
              for (const s of rawSegments) {
                if (s.words && s.words.length > 0) {
                  allWords.push(...s.words);
                }
              }

              const refinedSubtitles =
                allWords.length > 0
                  ? smartSegmentWords(allWords, {
                      maxWordsPerCue: project.subtitleStyle?.maxWordsPerLine || 4,
                      maxDurationSec: 2.8,
                      pauseThresholdSec: 0.35,
                    })
                  : rawSegments;

              // Update project subtitles
              project.subtitles = refinedSubtitles;
              saveProject(project);

              jobQueue.updateProgress(jobId, {
                status: 'completed',
                progress: 100,
                stage: `Transcription complete! Generated ${refinedSubtitles.length} caption cues.`,
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
