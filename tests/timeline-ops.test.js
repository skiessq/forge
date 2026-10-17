const test = require('node:test');
const assert = require('node:assert');
const {
  splitClip,
  trimClip,
  deleteClip,
  duplicateClip,
} = require('../src/lib/timeline/operations.ts');

test('splitClip splits a clip at playhead into two valid segments', () => {
  const track = {
    id: 'track_1',
    name: 'Video Track',
    type: 'video',
    order: 0,
    clips: [
      {
        id: 'clip_orig',
        type: 'video',
        trackId: 'track_1',
        start: 0,
        duration: 10,
        sourceStart: 0,
        sourceDuration: 10,
      },
    ],
  };

  const { track: updatedTrack, splitClipId } = splitClip(track, 'clip_orig', 4.0);

  assert.strictEqual(updatedTrack.clips.length, 2);
  const clip1 = updatedTrack.clips[0];
  const clip2 = updatedTrack.clips[1];

  assert.strictEqual(clip1.id, 'clip_orig');
  assert.strictEqual(clip1.start, 0);
  assert.strictEqual(clip1.duration, 4.0);
  assert.strictEqual(clip1.sourceStart, 0);
  assert.strictEqual(clip1.sourceDuration, 4.0);

  assert.strictEqual(clip2.id, splitClipId);
  assert.strictEqual(clip2.start, 4.0);
  assert.strictEqual(clip2.duration, 6.0);
  assert.strictEqual(clip2.sourceStart, 4.0);
  assert.strictEqual(clip2.sourceDuration, 6.0);
});

test('trimClip updates clip start, duration, and sourceStart', () => {
  const track = {
    id: 'track_1',
    name: 'Video Track',
    type: 'video',
    order: 0,
    clips: [
      {
        id: 'clip_1',
        type: 'video',
        trackId: 'track_1',
        start: 0,
        duration: 10,
        sourceStart: 0,
        sourceDuration: 10,
      },
    ],
  };

  const updatedTrack = trimClip(track, 'clip_1', 2.0, 6.0);
  const clip = updatedTrack.clips[0];

  assert.strictEqual(clip.start, 2.0);
  assert.strictEqual(clip.duration, 6.0);
  assert.strictEqual(clip.sourceStart, 2.0);
  assert.strictEqual(clip.sourceDuration, 6.0);
});

test('deleteClip with ripple removes clip and shifts subsequent clips left', () => {
  const track = {
    id: 'track_1',
    name: 'Video Track',
    type: 'video',
    order: 0,
    clips: [
      { id: 'c1', type: 'video', trackId: 'track_1', start: 0, duration: 3, sourceStart: 0, sourceDuration: 3 },
      { id: 'c2', type: 'video', trackId: 'track_1', start: 3, duration: 4, sourceStart: 3, sourceDuration: 4 },
      { id: 'c3', type: 'video', trackId: 'track_1', start: 7, duration: 5, sourceStart: 7, sourceDuration: 5 },
    ],
  };

  // Delete middle clip c2 (duration 4)
  const updated = deleteClip(track, 'c2', true);

  assert.strictEqual(updated.clips.length, 2);
  assert.strictEqual(updated.clips[0].id, 'c1');
  assert.strictEqual(updated.clips[0].start, 0);

  assert.strictEqual(updated.clips[1].id, 'c3');
  // c3 originally started at 7, shifted left by 4 -> start 3
  assert.strictEqual(updated.clips[1].start, 3);
});

test('duplicateClip appends cloned clip', () => {
  const track = {
    id: 'track_1',
    name: 'Video Track',
    type: 'video',
    order: 0,
    clips: [
      { id: 'c1', type: 'video', trackId: 'track_1', start: 0, duration: 3, sourceStart: 0, sourceDuration: 3 },
    ],
  };

  const { track: updated, duplicatedClipId } = duplicateClip(track, 'c1');

  assert.strictEqual(updated.clips.length, 2);
  assert.ok(duplicatedClipId);
  const dup = updated.clips.find((c) => c.id === duplicatedClipId);
  assert.ok(dup);
  assert.strictEqual(dup.duration, 3);
});
