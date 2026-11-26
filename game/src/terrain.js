// The valley, built from the seed alone with no three.js in it: a winding floor with a river, ridged
// mountains either side, two flattened runways, the 12-ring course and the pine scatter. heightAt()
// samples the same grid the terrain mesh is built from, so collisions match what is drawn.
import { MAP, RUNWAYS, RINGS, RING_R } from './config.js';
import { createRandom } from './rng.js';

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const G = [1, 0, -1, 0, 0, 1, 0, -1, 0.7071, 0.7071, -0.7071, 0.7071, 0.7071, -0.7071, -0.7071, -0.7071];

// 2D gradient noise over a seeded permutation, roughly -1..1.
function makeNoise(random) {
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const g = (h, x, y) => G[(h & 7) * 2] * x + G[(h & 7) * 2 + 1] * y;
  const f = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x), Y = Math.floor(y);
    x -= X;
    y -= Y;
    const xi = X & 255, yi = Y & 255, u = f(x), v = f(y);
    const a = p[xi] + yi, b = p[xi + 1] + yi;
    const g00 = g(p[a], x, y), g01 = g(p[a + 1], x, y - 1);
    const n0 = g00 + u * (g(p[b], x - 1, y) - g00);
    const n1 = g01 + u * (g(p[b + 1], x - 1, y - 1) - g01);
    return n0 + v * (n1 - n0);
  };
}

export function createTerrain(seed) {
  const random = createRandom(seed * 7919 + 17);
  const noise = makeNoise(random);
  const fbm = (x, y, o) => {
    let s = 0, a = 1, f = 1;
    for (let i = 0; i < o; i++, a *= 0.5, f *= 2.03) s += a * noise(x * f, y * f);
    return s;
  };
  const ridged = (x, y) => {
    let s = 0, a = 0.6, f = 1, w = 1;
    for (let i = 0; i < 4; i++, a *= 0.5, f *= 2.1) {
      let n = 1 - Math.abs(noise(x * f + 31.7, y * f - 11.3));
      n *= n * w;
      w = Math.min(1, n * 1.6);
      s += n * a;
    }
    return s;
  };
  const ph = [random() * 6.283, random() * 6.283, random() * 6.283];
  const [A, B] = RUNWAYS;
  // 0 at the runways (straight, aligned valley there), 1 along the winding middle.
  const env = (z) => smooth(A.z - 250, A.z - 1150, z) * smooth(B.z + 250, B.z + 1150, z);
  const centre = (z) => env(z) * (360 * Math.sin(z / 880 + ph[0]) + 150 * Math.sin(z / 400 + ph[1]));
  const river = (z) => centre(z) - 55 + env(z) * 75 * Math.sin(z / 230 + ph[2]);
  const halfW = (z) => 340 + 80 * noise(z / 650, 3.7) + (1 - env(z)) * 160;

  function raw(x, z) {
    const w = halfW(z);
    const d = Math.abs(x - centre(z)) + 140 * noise(x / 520 + 5.1, z / 520);
    const t = smooth(w * 0.6, w + 950, d);
    const r = ridged(x / 760, z / 760);
    let h = 7 + 3.5 * fbm(x / 240, z / 240, 3);
    h += t ** 1.6 * (230 + 560 * r) + t * 45 * fbm(x / 110, z / 110, 3);
    h += (1 - t) * Math.max(0, fbm(x / 380 + 9, z / 380, 2)) * 34; // low knolls on the floor
    h += (smooth(A.z + 750, A.z + 1700, z) + smooth(B.z - 750, B.z - 1700, z)) * (260 + 360 * r); // end walls
    const ch = 1 - smooth(14, 58, Math.abs(x - river(z)));
    h += (-5 - h) * ch;
    for (const rw of RUNWAYS) {
      const m = (1 - smooth(rw.w / 2 + 25, rw.w / 2 + 120, Math.abs(x - rw.x))) * (1 - smooth(rw.len / 2 + 40, rw.len / 2 + 260, Math.abs(z - rw.z)));
      h += (rw.h - h) * m;
    }
    return h;
  }

  const { x0, z0, cell } = MAP;
  const nx = Math.round((MAP.x1 - x0) / cell) + 1, nz = Math.round((MAP.z1 - z0) / cell) + 1;
  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = raw(x0 + i * cell, z0 + j * cell);

  function heightAt(x, z) {
    const fx = Math.min(nx - 1.001, Math.max(0, (x - x0) / cell)), fz = Math.min(nz - 1.001, Math.max(0, (z - z0) / cell));
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * nx + i;
    const a = heights[k] + (heights[k + 1] - heights[k]) * u;
    const b = heights[k + nx] + (heights[k + nx + 1] - heights[k + nx]) * u;
    return a + (b - a) * v;
  }
  // Index of the runway under (x, z), or -1.
  const runwayAt = (x, z) => RUNWAYS.findIndex((rw) => Math.abs(x - rw.x) < rw.w / 2 + 4 && Math.abs(z - rw.z) < rw.len / 2);

  // The course: 12 rings up the valley, alternating sides and heights, each facing along the route.
  const rr = createRandom(seed * 31 + 5);
  const rings = [];
  for (let k = 0; k < RINGS; k++) {
    const z = A.z - 650 - k * 515;
    const side = (k % 2 ? 1 : -1) * (0.15 + rr() * 0.35);
    const x = centre(z) + side * halfW(z);
    let top = 0;
    for (let s = -1; s <= 1; s++) top = Math.max(top, heightAt(x + s * RING_R, z), heightAt(x, z + s * RING_R));
    const y = top + RING_R + 14 + (k === RINGS - 1 ? 4 : rr() * 70 + (k % 3 === 1 ? 45 : 0));
    rings.push({ x, y, z, nx: 0, ny: 0, nz: -1, index: k });
  }
  for (let k = 0; k < RINGS; k++) {
    const p = k ? rings[k - 1] : { x: A.x, y: A.h + 40, z: A.z - 300 };
    const q = k < RINGS - 1 ? rings[k + 1] : { x: B.x, y: B.h + 10, z: B.z + B.len / 2 };
    let dx = q.x - p.x, dy = (q.y - p.y) * 0.4, dz = q.z - p.z;
    const l = Math.hypot(dx, dy, dz);
    Object.assign(rings[k], { nx: dx / l, ny: dy / l, nz: dz / l });
  }

  // Pines: clumped forests on the floor and lower slopes, kept off the river, runways and buildings.
  const tr = createRandom(seed * 131 + 9);
  const trees = [];
  for (let n = 0; n < 40000 && trees.length < 5200 * 5; n++) {
    const z = z0 + 500 + tr() * (MAP.z1 - z0 - 1000);
    const x = centre(z) + (tr() * 2 - 1) * (halfW(z) + 800);
    const h = heightAt(x, z);
    if (h < 3 || h > 340 || Math.abs(x - river(z)) < 42) continue;
    const slope = Math.abs(heightAt(x + 10, z) - heightAt(x - 10, z)) + Math.abs(heightAt(x, z + 10) - heightAt(x, z - 10));
    if (slope > 16 || fbm(x / 320 + 40, z / 320, 2) < -0.08 + h / 1400) continue;
    if (RUNWAYS.some((rw) => Math.abs(x - rw.x) < 100 && Math.abs(z - rw.z) < rw.len / 2 + 140)) continue;
    trees.push(x, h, z, 0.75 + tr() * 0.7, tr());
  }

  return { seed, heights, nx, nz, heightAt, runwayAt, centre, river, halfW, rings, trees };
}
