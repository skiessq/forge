import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { SystemCheckResult, MediaProbe } from '../types';

// Helper to find executable on Windows or Unix
export function findExecutable(name: string): string {
  // If explicitly in PATH
  try {
    const cmd = process.platform === 'win32' ? `where.exe ${name}` : `which ${name}`;
    const out = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstLine = out.split(/\r?\n/)[0];
    if (firstLine && fs.existsSync(firstLine)) return firstLine;
  } catch {}

  // Check common Windows locations
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const userProfile = process.env.USERPROFILE || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';

    const candidates = [
      path.join(localAppData, 'Microsoft', 'WindowsApps', `${name}.exe`),
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', `${name}.exe`),
      path.join(userProfile, 'AppData', 'Roaming', 'Python', 'Python311', 'Scripts', `${name}.exe`),
      path.join(programFiles, 'ffmpeg', 'bin', `${name}.exe`),
      path.join('C:\\ffmpeg', 'bin', `${name}.exe`),
    ];

    // Check WinGet Packages
    const wingetDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetDir)) {
      try {
        const pkgs = fs.readdirSync(wingetDir);
        for (const pkg of pkgs) {
          if (pkg.toLowerCase().includes('ffmpeg')) {
            const pkgPath = path.join(wingetDir, pkg);
            // Search subdirectories for bin/ffmpeg.exe
            const subEntries = fs.readdirSync(pkgPath, { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.isDirectory()) {
                const candBin = path.join(pkgPath, sub.name, 'bin', `${name}.exe`);
                if (fs.existsSync(candBin)) return candBin;
                const direct = path.join(pkgPath, sub.name, `${name}.exe`);
                if (fs.existsSync(direct)) return direct;
              }
            }
          }
        }
      } catch {}
    }

    for (const cand of candidates) {
      if (fs.existsSync(cand)) return cand;
    }
  }

  return name; // fallback to plain name
}

export function checkSystemDependencies(): SystemCheckResult {
  const result: SystemCheckResult = {
    ffmpeg: { installed: false },
    ffprobe: { installed: false },
    ytDlp: { installed: false },
    whisper: { installed: false, engine: 'none' },
  };

  // 1. FFmpeg
  try {
    const ffmpegExe = findExecutable('ffmpeg');
    const out = execSync(`"${ffmpegExe}" -version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const match = out.match(/ffmpeg version ([^\s]+)/i);
    result.ffmpeg.installed = true;
    result.ffmpeg.version = match ? match[1] : 'detected';

    // Check hardware acceleration
    const hwAccels: string[] = [];
    if (/nvenc/i.test(out)) hwAccels.push('NVENC (NVIDIA)');
    if (/qsv/i.test(out)) hwAccels.push('QSV (Intel)');
    if (/videotoolbox/i.test(out)) hwAccels.push('VideoToolbox (Apple)');
    if (/amf/i.test(out)) hwAccels.push('AMF (AMD)');
    result.ffmpeg.hwAccelSupport = hwAccels;
  } catch {}

  // 2. FFprobe
  try {
    const ffprobeExe = findExecutable('ffprobe');
    const out = execSync(`"${ffprobeExe}" -version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const match = out.match(/ffprobe version ([^\s]+)/i);
    result.ffprobe.installed = true;
    result.ffprobe.version = match ? match[1] : 'detected';
  } catch {}

  // 3. yt-dlp (standalone or python module)
  try {
    const ytDlpExe = findExecutable('yt-dlp');
    const out = execSync(`"${ytDlpExe}" --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    result.ytDlp.installed = true;
    result.ytDlp.version = out.trim().split(/\r?\n/)[0];
  } catch {
    try {
      const out = execSync(`python -m yt_dlp --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      result.ytDlp.installed = true;
      result.ytDlp.version = out.trim().split(/\r?\n/)[0] + ' (python module)';
    } catch {}
  }

  // 4. Whisper
  try {
    execSync(`python -c "import faster_whisper"`, { stdio: ['pipe', 'pipe', 'ignore'] });
    result.whisper.installed = true;
    result.whisper.engine = 'faster-whisper';
  } catch {
    try {
      execSync(`python -c "import whisper"`, { stdio: ['pipe', 'pipe', 'ignore'] });
      result.whisper.installed = true;
      result.whisper.engine = 'whisper';
    } catch {}
  }

  return result;
}
