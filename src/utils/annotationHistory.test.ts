import test from 'node:test';
import assert from 'node:assert/strict';
import { simplifyPoints, buildSvgPathFromPoints } from '../components/AnnotationLayer';

test('simplifyPoints: preserves small point arrays without alteration', () => {
  const points = [
    { x: 0.1, y: 0.1 },
    { x: 0.2, y: 0.2 },
    { x: 0.3, y: 0.3 },
  ];
  const simplified = simplifyPoints(points, 200);
  assert.equal(simplified.length, 3);
  assert.deepEqual(simplified, points);
});

test('simplifyPoints: reduces collinear points down to endpoints', () => {
  // 50 collinear points on line y = x
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= 50; i++) {
    points.push({ x: i / 50, y: i / 50 });
  }
  const simplified = simplifyPoints(points, 10);
  assert.ok(simplified.length <= 10);
  assert.deepEqual(simplified[0], { x: 0, y: 0 });
  assert.deepEqual(simplified[simplified.length - 1], { x: 1, y: 1 });
});

test('simplifyPoints: clamps large stroke arrays under maxPoints threshold', () => {
  // 500 noisy points
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 500; i++) {
    const t = i / 500;
    points.push({
      x: t,
      y: 0.5 + Math.sin(t * 10) * 0.2,
    });
  }
  const simplified = simplifyPoints(points, 200);
  assert.ok(simplified.length <= 200);
  assert.equal(simplified[0].x, 0);
  assert.equal(simplified[simplified.length - 1].x, points[points.length - 1].x);
});

test('buildSvgPathFromPoints: maps normalized points to SVG 0..1000 coordinate space', () => {
  const pts = [
    { x: 0.1, y: 0.2 },
    { x: 0.5, y: 0.6 },
    { x: 0.9, y: 0.8 },
  ];
  const d = buildSvgPathFromPoints(pts);
  assert.equal(d, 'M 100 200 L 500 600 L 900 800');
});

test('buildSvgPathFromPoints: handles empty array gracefully', () => {
  assert.equal(buildSvgPathFromPoints([]), '');
});
