// The screenshot scenes behind ?shot=start|play|end. Each plays the real rules forward from a fresh world
// with a simple autopilot (steer for the next ring along its facing, keep clear of the ground, then a low
// pass over Kestrel Field), so the frame is what a real run looks like and one seed always gives one frame.
import { FLIGHT as F, RINGS, RUNWAYS, STEP } from './config.js';
import { wrap } from './world.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const PLAY_RING = 4; // the play shot is staged just before ring 5

export function autopilot(s, terrain, out) {
  let tx, ty, tz, vt = 110;
  if (s.next < RINGS) {
    const r = terrain.rings[s.next];
    const lead = Math.min(Math.hypot(r.x - s.x, r.z - s.z) * 0.4, 160);
    tx = r.x - r.nx * lead;
    ty = r.y - r.ny * lead;
    tz = r.z - r.nz * lead;
  } else {
    const B = RUNWAYS[1], far = s.z > B.z + B.len / 2 + 150;
    tx = B.x;
    tz = Math.min(s.z - 250, B.z + B.len / 2); // a carrot on the centreline
    ty = B.h + (far ? 14 : 9);
    vt = 85;
  }
  const hd = Math.hypot(tx - s.x, tz - s.z);
  const err = wrap(Math.atan2(tx - s.x, s.z - tz) - s.yaw);
  const bank = s.agl < 15 ? 0.3 : 1;
  out.roll = s.grounded ? 0 : clamp((clamp(err * 2.2, -bank, bank) - s.roll) * 2.5, -1, 1);
  let top = 0;
  for (let t = 0.4; t <= 3; t += 0.4) top = Math.max(top, terrain.heightAt(s.x + Math.sin(s.yaw) * s.speed * t, s.z - Math.cos(s.yaw) * s.speed * t));
  const want = Math.max(ty, s.next < RINGS ? top + 28 : ty);
  const pt = clamp(Math.atan2(want - s.y, Math.max(hd, 60)), -0.35, 0.45);
  out.pitch = s.grounded ? (s.speed > F.rotate ? 1 : 0) : clamp((pt - s.pitch) * 3, -1, 1);
  out.throttle = s.speed < vt - 3 ? 1 : s.speed > vt + 3 ? -1 : 0;
  out.boost = s.next < RINGS && !s.grounded && hd > 180 && Math.abs(err) < 0.12 && s.boost > 0.35; // boost on the straights
  return out;
}

/** Set `world` to the named scene and return the screen to show over it. */
export function stageShot(name, world, terrain) {
  world.reset();
  const s = world.state, inp = { pitch: 0, roll: 0, throttle: 0, boost: false };
  if (name !== 'play' && name !== 'end') return 'title';
  for (let i = 0; i < 60 * 240 && !s.crashed && !s.finished; i++) {
    if (name === 'play' && s.next === PLAY_RING) {
      const r = terrain.rings[PLAY_RING];
      if ((s.x - r.x) * r.nx + (s.y - r.y) * r.ny + (s.z - r.z) * r.nz > -16) break;
    }
    world.step(STEP, autopilot(s, terrain, inp), true);
  }
  return name === 'play' ? 'play' : s.finished ? 'finished' : 'crashed';
}
