import test from 'node:test';
import assert from 'node:assert/strict';
import { FlipQueue, FlipStep } from './flipQueue';

test('FlipQueue: executes sequential forward flips in strict order with no overlap', async () => {
  const startEvents: FlipStep[] = [];
  const endEvents: FlipStep[] = [];
  const pageChanges: number[] = [];

  const queue = new FlipQueue({
    initialIndex: 0,
    pageCount: 5,
    flipDuration: 20, // fast duration for test
    reducedMotionDuration: 10,
    onFlipStart: (step) => startEvents.push({ ...step }),
    onFlipEnd: (step) => endEvents.push({ ...step }),
    onPageChange: (idx) => pageChanges.push(idx),
  });

  // Enqueue jump from page 0 to 3 (should decompose into 0->1, 1->2, 2->3)
  queue.enqueue(3);

  assert.equal(queue.isFlipping(), true);
  assert.equal(startEvents.length, 1);
  assert.equal(startEvents[0].fromIndex, 0);
  assert.equal(startEvents[0].toIndex, 1);
  assert.equal(startEvents[0].direction, 'forward');

  // Wait for all queued flips to complete (3 steps * 20ms = ~60ms)
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(queue.isFlipping(), false);
  assert.equal(queue.getCurrentIndex(), 3);

  // Check 3 starts in strict sequence
  assert.equal(startEvents.length, 3);
  assert.deepEqual(
    startEvents.map((s) => ({ from: s.fromIndex, to: s.toIndex, dir: s.direction })),
    [
      { from: 0, to: 1, dir: 'forward' },
      { from: 1, to: 2, dir: 'forward' },
      { from: 2, to: 3, dir: 'forward' },
    ]
  );

  // Check 3 ends in strict sequence
  assert.equal(endEvents.length, 3);
  assert.deepEqual(
    endEvents.map((s) => ({ from: s.fromIndex, to: s.toIndex, dir: s.direction })),
    [
      { from: 0, to: 1, dir: 'forward' },
      { from: 1, to: 2, dir: 'forward' },
      { from: 2, to: 3, dir: 'forward' },
    ]
  );

  // Check page changes
  assert.deepEqual(pageChanges, [1, 2, 3]);
});

test('FlipQueue: executes backward flips when navigating to earlier page', async () => {
  const startEvents: FlipStep[] = [];
  const endEvents: FlipStep[] = [];

  const queue = new FlipQueue({
    initialIndex: 3,
    pageCount: 5,
    flipDuration: 20,
    onFlipStart: (step) => startEvents.push({ ...step }),
    onFlipEnd: (step) => endEvents.push({ ...step }),
  });

  queue.enqueue(1); // 3 -> 2 -> 1
  await new Promise((resolve) => setTimeout(resolve, 70));

  assert.equal(queue.getCurrentIndex(), 1);
  assert.equal(startEvents.length, 2);
  assert.deepEqual(
    startEvents.map((s) => ({ from: s.fromIndex, to: s.toIndex, dir: s.direction })),
    [
      { from: 3, to: 2, dir: 'backward' },
      { from: 2, to: 1, dir: 'backward' },
    ]
  );
  assert.deepEqual(
    endEvents.map((s) => ({ from: s.fromIndex, to: s.toIndex, dir: s.direction })),
    [
      { from: 3, to: 2, dir: 'backward' },
      { from: 2, to: 1, dir: 'backward' },
    ]
  );
});

test('FlipQueue: buffers additional enqueue calls while already flipping', async () => {
  const stepsTaken: string[] = [];

  const queue = new FlipQueue({
    initialIndex: 0,
    pageCount: 6,
    flipDuration: 25,
    onFlipStart: (s) => stepsTaken.push(`start ${s.fromIndex}->${s.toIndex}`),
    onFlipEnd: (s) => stepsTaken.push(`end ${s.fromIndex}->${s.toIndex}`),
  });

  // Start flip to page 1
  queue.enqueue(1);
  assert.equal(queue.isFlipping(), true);

  // Rapid user click while flipping: add page 3
  queue.enqueue(3);

  // Wait for all steps to finish (total 3 steps * 25ms = ~75ms)
  await new Promise((resolve) => setTimeout(resolve, 120));

  assert.equal(queue.getCurrentIndex(), 3);
  assert.deepEqual(stepsTaken, [
    'start 0->1',
    'end 0->1',
    'start 1->2',
    'end 1->2',
    'start 2->3',
    'end 2->3',
  ]);
});

test('FlipQueue: prefers-reduced-motion replaces duration with 150ms reduced timing', async () => {
  const queue = new FlipQueue({
    initialIndex: 0,
    pageCount: 3,
    flipDuration: 450,
    reducedMotionDuration: 150,
    isReducedMotion: false,
  });

  assert.equal(queue.getDuration(), 450);

  queue.setReducedMotion(true);
  assert.equal(queue.getDuration(), 150);

  let capturedStep: FlipStep | null = null;
  const testQueue = new FlipQueue({
    initialIndex: 0,
    pageCount: 3,
    flipDuration: 450,
    reducedMotionDuration: 150,
    isReducedMotion: true,
    onFlipStart: (s) => {
      capturedStep = s;
    },
  });

  testQueue.enqueue(1);
  assert.ok(capturedStep);
  const step: FlipStep = capturedStep;
  assert.equal(step.duration, 150);
  assert.equal(step.isReducedMotion, true);

  testQueue.cancel();
  queue.cancel();
});

test('FlipQueue: clamps out of bound target requests cleanly', async () => {
  const queue = new FlipQueue({
    initialIndex: 2,
    pageCount: 4,
    flipDuration: 10,
  });

  // Attempt to enqueue page 999
  queue.enqueue(999);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(queue.getCurrentIndex(), 3);

  // Attempt to enqueue negative page
  queue.enqueue(-10);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(queue.getCurrentIndex(), 0);
});

test('FlipQueue: jumpTo immediately updates index and cancels pending queue', () => {
  let idleReported = -1;
  const queue = new FlipQueue({
    initialIndex: 0,
    pageCount: 5,
    flipDuration: 100,
    onQueueIdle: (idx) => {
      idleReported = idx;
    },
  });

  queue.enqueue(4); // would take 4 * 100ms
  assert.equal(queue.isFlipping(), true);

  // Instant jump
  queue.jumpTo(2);
  assert.equal(queue.isFlipping(), false);
  assert.equal(queue.getCurrentIndex(), 2);
  assert.equal(idleReported, 2);
});
