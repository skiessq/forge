import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Project, ExportSettings } from '../types';
import { buildFFmpegExportCommand } from './builder';
import { findExecutable, checkSystemDependencies } from './systemCheck';
import { probeMedia } from './probe';
import { jobQueue } from '../jobs/queue';

export function runFFmpegExport(
  project: Project,
  jobId: string,
  customSettings?: Partial<ExportSettings>
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const ffmpegExe = findExecutable('ffmpeg');
      const sysCheck = checkSystemDependencies();

      // Resolve hardware encoder if 'auto'
      let chosenHwAccel = customSettings?.hwAccel || project.exportSettings.hwAccel || 'auto';
      if (chosenHwAccel === 'auto') {
        if (sysCheck.ffmpeg.hwAccelSupport?.includes('NVENC (NVIDIA)')) {
          chosenHwAccel = 'nvenc';
        } else if (sysCheck.ffmpeg.hwAccelSupport?.includes('VideoToolbox (Apple)')) {
          chosenHwAccel = 'videotoolbox';
        } else if (sysCheck.ffmpeg.hwAccelSupport?.includes('QSV (Intel)')) {
          chosenHwAccel = 'qsv';
        } else {
          chosenHwAccel = 'cpu';
        }
      }

      const plan = buildFFmpegExportCommand(project, {
        ...customSettings,
        hwAccel: chosenHwAccel,
      });

      // Ensure export directory exists
      const exportDir = path.dirname(plan.outputPath);
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      jobQueue.updateProgress(jobId, {
        status: 'running',
        progress: 2,
        stage: `Starting export with ${chosenHwAccel.toUpperCase()} encoder...`,
      });

      const child = spawn(ffmpegExe, plan.args, { windowsHide: true });
      jobQueue.registerProcess(jobId, child);

      const allTracks = project.tracks || (project as any).timeline?.tracks || [];
      const videoTrack = allTracks.find((t: any) => t.type === 'video');
      const clips = videoTrack?.clips || [];
      const totalDuration = clips.length > 0
        ? clips.reduce((acc: number, c: any) => acc + c.duration, 0)
        : (project.source.probe?.duration || 10);
      let lastErrText = '';

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        lastErrText += text;
        if (lastErrText.length > 2000) lastErrText = lastErrText.slice(-2000);

        // Parse time=00:00:04.25
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const mins = parseInt(timeMatch[2], 10);
          const secs = parseFloat(timeMatch[3]);
          const currentSecs = hours * 3600 + mins * 60 + secs;

          const pct = Math.min(99, Math.max(3, Math.round((currentSecs / totalDuration) * 100)));
          const remainingSecs = Math.max(0, Math.round((totalDuration - currentSecs)));

          jobQueue.updateProgress(jobId, {
            status: 'running',
            progress: pct,
            stage: `Encoding 1080x1920 MP4 (${pct}%)...`,
            etaSeconds: remainingSecs,
          });
        }
      });

      child.on('close', (code) => {
        jobQueue.unregisterProcess(jobId);

        if (code === 0 && fs.existsSync(plan.outputPath)) {
          // Verify with ffprobe
          const outProbe = probeMedia(plan.outputPath);
          const serveUrl = `/api/media/serve?path=${encodeURIComponent(plan.outputPath)}`;

          jobQueue.updateProgress(jobId, {
            status: 'completed',
            progress: 100,
            stage: `Export finished! ${outProbe.width}x${outProbe.height} @ ${outProbe.fps}fps`,
            resultUrl: serveUrl,
          });

          resolve(plan.outputPath);
        } else {
          // If NVENC failed, retry with CPU libx264 automatically as fallback
          if (chosenHwAccel === 'nvenc' || chosenHwAccel === 'qsv') {
            console.warn('Hardware encoding failed, falling back to CPU libx264...');
            jobQueue.updateProgress(jobId, {
              status: 'running',
              progress: 5,
              stage: 'GPU encoder unavailable, falling back to software CPU encoding...',
            });
            runFFmpegExport(project, jobId, { ...customSettings, hwAccel: 'cpu' })
              .then(resolve)
              .catch(reject);
            return;
          }

          const errMsg = `FFmpeg export failed with code ${code}. Error: ${lastErrText.slice(-300)}`;
          jobQueue.updateProgress(jobId, {
            status: 'failed',
            stage: 'Export failed',
            error: errMsg,
          });
          reject(new Error(errMsg));
        }
      });

      child.on('error', (err) => {
        jobQueue.unregisterProcess(jobId);
        jobQueue.updateProgress(jobId, {
          status: 'failed',
          stage: 'Failed to launch FFmpeg',
          error: err.message,
        });
        reject(err);
      });
    } catch (e: any) {
      jobQueue.updateProgress(jobId, {
        status: 'failed',
        stage: 'Export error',
        error: e.message,
      });
      reject(e);
    }
  });
}
