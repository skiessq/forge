import { TimelineClip, TimelineTrack } from '../types';

export function splitClip(
  track: TimelineTrack,
  clipId: string,
  splitTime: number
): { track: TimelineTrack; splitClipId?: string } {
  const clipIndex = track.clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) return { track };

  const clip = track.clips[clipIndex];
  const clipEnd = clip.start + clip.duration;

  // Split point must be inside the clip
  if (splitTime <= clip.start + 0.05 || splitTime >= clipEnd - 0.05) {
    return { track };
  }

  const duration1 = splitTime - clip.start;
  const duration2 = clip.duration - duration1;

  const clip1: TimelineClip = {
    ...clip,
    duration: duration1,
    sourceDuration: duration1,
  };

  const newClipId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const clip2: TimelineClip = {
    ...clip,
    id: newClipId,
    start: splitTime,
    duration: duration2,
    sourceStart: clip.sourceStart + duration1,
    sourceDuration: duration2,
  };

  const newClips = [...track.clips];
  newClips.splice(clipIndex, 1, clip1, clip2);

  return {
    track: {
      ...track,
      clips: newClips,
    },
    splitClipId: newClipId,
  };
}

export function trimClip(
  track: TimelineTrack,
  clipId: string,
  newStart: number,
  newDuration: number
): TimelineTrack {
  const newClips = track.clips.map((clip) => {
    if (clip.id !== clipId) return clip;

    const clampedDuration = Math.max(0.1, newDuration);
    const startDelta = newStart - clip.start;

    return {
      ...clip,
      start: newStart,
      duration: clampedDuration,
      sourceStart: Math.max(0, clip.sourceStart + startDelta),
      sourceDuration: clampedDuration,
    };
  });

  return {
    ...track,
    clips: newClips,
  };
}

export function deleteClip(
  track: TimelineTrack,
  clipId: string,
  ripple = true
): TimelineTrack {
  const clipIndex = track.clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) return track;

  const clip = track.clips[clipIndex];
  const gapDuration = clip.duration;

  let newClips = track.clips.filter((c) => c.id !== clipId);

  if (ripple) {
    newClips = newClips.map((c) => {
      if (c.start > clip.start) {
        return {
          ...c,
          start: Math.max(0, c.start - gapDuration),
        };
      }
      return c;
    });
  }

  return {
    ...track,
    clips: newClips,
  };
}

export function duplicateClip(
  track: TimelineTrack,
  clipId: string
): { track: TimelineTrack; duplicatedClipId?: string } {
  const clip = track.clips.find((c) => c.id === clipId);
  if (!clip) return { track };

  const newId = `clip_dup_${Date.now()}`;
  const duplicated: TimelineClip = {
    ...clip,
    id: newId,
    start: clip.start + clip.duration + 0.1,
  };

  return {
    track: {
      ...track,
      clips: [...track.clips, duplicated].sort((a, b) => a.start - b.start),
    },
    duplicatedClipId: newId,
  };
}
