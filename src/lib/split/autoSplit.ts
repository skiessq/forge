import { Project } from '../types';

export interface ShortCandidate {
  id: string;
  title: string;
  start: number;
  end: number;
  duration: number;
  snippet: string;
}

export function generateAutoSplitCandidates(
  project: Project,
  targetDuration = 30
): ShortCandidate[] {
  const totalDuration = project.source.probe?.duration || 10;
  const candidates: ShortCandidate[] = [];

  if (!project.subtitles || project.subtitles.length === 0) {
    // Split purely based on duration chunks if no transcript
    let currentStart = 0;
    let segIdx = 1;
    while (currentStart < totalDuration) {
      const end = Math.min(totalDuration, currentStart + targetDuration);
      if (end - currentStart >= 5) {
        candidates.push({
          id: `seg_${segIdx}`,
          title: `Short #${segIdx} (${Math.round(currentStart)}s - ${Math.round(end)}s)`,
          start: currentStart,
          end,
          duration: end - currentStart,
          snippet: `Gameplay Highlight Part ${segIdx}`,
        });
      }
      currentStart += targetDuration;
      segIdx++;
    }
    return candidates;
  }

  // If subtitles exist, cluster around subtitle boundaries
  let chunkStart = project.subtitles[0].start;
  let chunkText: string[] = [];
  let chunkIdx = 1;

  for (let i = 0; i < project.subtitles.length; i++) {
    const sub = project.subtitles[i];
    chunkText.push(sub.text);
    const elapsed = sub.end - chunkStart;

    if (elapsed >= targetDuration || i === project.subtitles.length - 1) {
      candidates.push({
        id: `seg_${chunkIdx}`,
        title: `Short #${chunkIdx}: ${sub.text.slice(0, 28)}...`,
        start: chunkStart,
        end: sub.end,
        duration: sub.end - chunkStart,
        snippet: chunkText.slice(0, 3).join(' ') + '...',
      });
      chunkIdx++;
      if (i + 1 < project.subtitles.length) {
        chunkStart = project.subtitles[i + 1].start;
        chunkText = [];
      }
    }
  }

  return candidates;
}
