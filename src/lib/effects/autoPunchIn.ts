import { Project, EffectConfig } from '../types';

export interface PunchInCandidate {
  id: string;
  time: number;
  label: string;
  duration: number;
  scale: number;
  accepted: boolean;
}

export function detectAutoPunchIns(project: Project): PunchInCandidate[] {
  const candidates: PunchInCandidate[] = [];

  if (!project.subtitles || project.subtitles.length === 0) {
    // If no subtitles, generate periodic energetic punch-in markers every ~4 seconds
    const totalDuration = project.source.probe?.duration || 10;
    for (let t = 2.0; t < totalDuration - 1.5; t += 3.5) {
      candidates.push({
        id: `punch_${Math.round(t * 100)}`,
        time: parseFloat(t.toFixed(2)),
        label: `Moment at ${t.toFixed(1)}s`,
        duration: 1.0,
        scale: 1.15,
        accepted: true,
      });
    }
    return candidates;
  }

  // Generate punch-in at the beginning of each subtitle phrase
  project.subtitles.forEach((sub, idx) => {
    // Alternate punch-in on key sentences to avoid constant zooming
    if (idx % 2 === 0) {
      candidates.push({
        id: `punch_${sub.id}`,
        time: sub.start,
        label: sub.text.slice(0, 24) + (sub.text.length > 24 ? '...' : ''),
        duration: Math.min(1.2, sub.end - sub.start),
        scale: 1.18,
        accepted: true,
      });
    }
  });

  return candidates;
}
