import { spawn } from 'child_process';
import { findExecutable } from './systemCheck';

export interface SilenceInterval {
  start: number;
  end: number;
  duration: number;
}

export function detectSilences(
  filePath: string,
  noiseThresholdDb = -30,
  minDuration = 0.5
): Promise<SilenceInterval[]> {
  return new Promise((resolve, reject) => {
    const ffmpegExe = findExecutable('ffmpeg');
    const args = [
      '-i', filePath,
      '-af', `silencedetect=noise=${noiseThresholdDb}dB:d=${minDuration}`,
      '-f', 'null',
      '-',
    ];

    const child = spawn(ffmpegExe, args, { windowsHide: true });
    let stderrData = '';

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      const silences: SilenceInterval[] = [];
      const lines = stderrData.split(/\r?\n/);

      let currentStart: number | null = null;

      for (const line of lines) {
        const startMatch = line.match(/silence_start:\s+([\d\.]+)/);
        if (startMatch) {
          currentStart = parseFloat(startMatch[1]);
        }

        const endMatch = line.match(/silence_end:\s+([\d\.]+)\s+\|\s+silence_duration:\s+([\d\.]+)/);
        if (endMatch && currentStart !== null) {
          const end = parseFloat(endMatch[1]);
          const duration = parseFloat(endMatch[2]);
          silences.push({
            start: currentStart,
            end,
            duration,
          });
          currentStart = null;
        }
      }

      resolve(silences);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
