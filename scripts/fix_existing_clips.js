const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workspaceDir = path.resolve(__dirname, '..', '.workspace');
if (!fs.existsSync(workspaceDir)) {
  console.log('No workspace found');
  process.exit(0);
}

// Find ffmpeg
let ffmpegExe = 'ffmpeg';
const possibleFfmpegs = [
  'ffmpeg',
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
];
for (const cand of possibleFfmpegs) {
  try {
    execSync(`"${cand}" -version`, { stdio: 'ignore' });
    ffmpegExe = cand;
    break;
  } catch {}
}

console.log(`Using FFmpeg: ${ffmpegExe}`);

const projects = fs.readdirSync(workspaceDir, { withFileTypes: true });

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
      const cmd = `"${ffmpegExe}" -y -ss ${clip.sourceStart.toFixed(3)} -t ${clip.duration.toFixed(3)} -i "${project.source.path}" -c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 192k "${cutSourcePath}"`;
      execSync(cmd, { stdio: 'pipe' });
    }

    if (fs.existsSync(cutSourcePath) && fs.statSync(cutSourcePath).size > 1000) {
      project.source.path = cutSourcePath;
      project.source.originalFileName = `clip_${path.basename(cutSourcePath)}`;
      clip.sourceStart = 0;
      clip.mediaPath = cutSourcePath;

      // Update subtitle styling to clean viral TikTok style
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
      console.log(`✓ Successfully updated and fixed ${project.id}`);
    }
  } catch (err) {
    console.error(`Error fixing project ${entry.name}:`, err.message);
  }
}

console.log('All existing clips processing complete!');
