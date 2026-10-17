import test from 'node:test';
import assert from 'node:assert';

interface SnapParams {
  rawCropY: number;
  startAtTop: boolean;
  unlockedTop: boolean;
  startAtBottom: boolean;
  unlockedBottom: boolean;
  bottomBarrier: number;
  centerBarrierY: number;
  startAtCenterY: boolean;
}

function computeSnappingY(params: SnapParams) {
  const SNAP_ZONE = 0.038;
  const BREAKAWAY = 0.075;

  let newCropY = params.rawCropY;
  let snappedGuide: string | null = null;
  let unlockedTop = params.unlockedTop;
  let unlockedBottom = params.unlockedBottom;

  if (params.startAtTop) {
    // Started at top barrier -> pass through past 0!
    newCropY = params.rawCropY;
  } else if (!unlockedTop && params.rawCropY <= SNAP_ZONE && params.rawCropY >= -BREAKAWAY) {
    // Snap to 0!
    newCropY = 0;
    snappedGuide = 'Top Barrier (Snapped)';
  } else if (params.rawCropY < -BREAKAWAY) {
    unlockedTop = true;
    newCropY = params.rawCropY + BREAKAWAY;
  } else if (!params.startAtCenterY && Math.abs(params.rawCropY - params.centerBarrierY) <= SNAP_ZONE * 0.75) {
    newCropY = params.centerBarrierY;
    snappedGuide = 'Center Y (Snapped)';
  } else if (params.startAtBottom) {
    newCropY = params.rawCropY;
  } else if (
    !unlockedBottom &&
    (Math.abs(params.rawCropY - params.bottomBarrier) <= SNAP_ZONE ||
      (params.rawCropY > params.bottomBarrier && params.rawCropY <= params.bottomBarrier + BREAKAWAY))
  ) {
    newCropY = params.bottomBarrier;
    snappedGuide = 'Bottom Barrier (Snapped)';
  } else if (params.rawCropY > params.bottomBarrier + BREAKAWAY) {
    unlockedBottom = true;
    newCropY = params.rawCropY - BREAKAWAY;
  }

  return { newCropY, snappedGuide, unlockedTop, unlockedBottom };
}

test('Drag towards top barrier first snaps to 0', () => {
  // Crop moving from inside video (e.g. 0.15) up towards 0.0
  const result = computeSnappingY({
    rawCropY: 0.02, // within snap zone (0.038)
    startAtTop: false,
    unlockedTop: false,
    startAtBottom: false,
    unlockedBottom: false,
    bottomBarrier: 0.4375,
    centerBarrierY: 0.218,
    startAtCenterY: false,
  });

  assert.strictEqual(result.newCropY, 0, 'Snaps directly to top barrier (0.0)');
  assert.strictEqual(result.snappedGuide, 'Top Barrier (Snapped)');
});

test('Dragging again when starting at top barrier goes past 0', () => {
  // User released at 0, and now starts a second drag ("if i do it again it then should go past the barrier")
  const result = computeSnappingY({
    rawCropY: -0.06, // moving past top barrier
    startAtTop: true, // initial crop was 0.0
    unlockedTop: false,
    startAtBottom: false,
    unlockedBottom: false,
    bottomBarrier: 0.4375,
    centerBarrierY: 0.218,
    startAtCenterY: false,
  });

  assert.strictEqual(result.newCropY, -0.06, 'Allows moving past top barrier into negative range on second drag');
  assert.strictEqual(result.snappedGuide, null, 'No lock guideline when passing through');
});

test('Drag towards bottom barrier first snaps to bottom edge', () => {
  const bottomBarrier = 0.4375;
  const result = computeSnappingY({
    rawCropY: 0.445, // slightly past bottom barrier within snap zone
    startAtTop: false,
    unlockedTop: false,
    startAtBottom: false,
    unlockedBottom: false,
    bottomBarrier,
    centerBarrierY: 0.218,
    startAtCenterY: false,
  });

  assert.strictEqual(result.newCropY, bottomBarrier, 'Snaps to bottom barrier edge');
  assert.strictEqual(result.snappedGuide, 'Bottom Barrier (Snapped)');
});

test('Dragging again when starting at bottom barrier goes past bottom edge', () => {
  const bottomBarrier = 0.4375;
  const result = computeSnappingY({
    rawCropY: 0.55, // moving past bottom barrier
    startAtTop: false,
    unlockedTop: false,
    startAtBottom: true, // initial crop was at bottom barrier
    unlockedBottom: false,
    bottomBarrier,
    centerBarrierY: 0.218,
    startAtCenterY: false,
  });

  assert.strictEqual(result.newCropY, 0.55, 'Allows moving past bottom barrier on second drag');
});
