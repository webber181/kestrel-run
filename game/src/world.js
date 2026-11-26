// The rules and the flight model, with no drawing and no browser: an arcade jet with throttle, bank-to-turn,
// auto-level, stall and boost; ground roll and lift-off; ring passing in order, scoring, crash and finish.
// step() advances one fixed step and returns what happened as EV_* bit flags.
import { FLIGHT as F, RINGS, RING_R, RUNWAYS, SCORE, START } from './config.js';

export const EV_RING = 1, EV_CRASH = 2, EV_FINISH = 4, EV_LIFTOFF = 8, EV_TOUCH = 16, EV_NOGO = 32, EV_BOOST = 64;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createWorld(terrain) {
  const s = {};
  const rings = terrain.rings;

  function reset() {
    const rw = RUNWAYS[0];
    Object.assign(s, {
      x: START.x, y: rw.h + F.gear, z: START.z, yaw: 0, pitch: 0, roll: 0, rollVel: 0, pitchVel: 0,
      speed: 0, vy: 0, throttle: 0.62, boost: 1, boosting: false, grounded: true,
      next: 0, time: 0, splitStart: 0, score: 0, ringPts: 0, timeBonus: 0, landBonus: 0, finishType: '',
      crashed: false, finished: false, reason: '', lastGain: 0, agl: 0, stall: false, pullUp: false, out: false, nogo: false,
    });
  }

  const ground = (x, z) => Math.max(0, terrain.heightAt(x, z));

  function crash(why) {
    s.crashed = true;
    s.reason = why;
    s.speed = 0;
    return EV_CRASH;
  }

  function finish(type) {
    s.finished = true;
    s.finishType = type;
    s.timeBonus = Math.max(0, Math.round((SCORE.par - s.time) * SCORE.parPts));
    s.landBonus = type === 'TOUCHDOWN' ? SCORE.touchdown : SCORE.lowPass;
    s.score = s.ringPts + s.timeBonus + s.landBonus;
    return EV_FINISH;
  }

  // Position from heading, pitch and speed; below stall speed the wings stop holding the jet up.
  function move(dt) {
    const cp = Math.cos(s.pitch), py = s.y;
    s.x += Math.sin(s.yaw) * cp * s.speed * dt;
    s.z -= Math.cos(s.yaw) * cp * s.speed * dt;
    s.y += (Math.sin(s.pitch) * s.speed - (s.grounded ? 0 : Math.max(0, F.stall - s.speed) * 0.5)) * dt;
    s.vy = (s.y - py) / dt;
  }

  /** One fixed step. inp = { pitch -1..1 (+ nose up), roll -1..1 (+ right), throttle -1/0/1, boost bool }. */
  function step(dt, inp, active) {
    if (s.crashed) return 0;
    if (s.finished) {
      // Victory lap: roll out on the runway, or climb away in a gentle banked turn.
      if (s.grounded) s.speed = Math.max(0, s.speed - 9 * dt);
      else {
        s.roll += (-0.5 - s.roll) * dt;
        s.pitch += (0.1 - s.pitch) * dt;
        s.yaw = wrap(s.yaw + Math.sin(s.roll) * 0.5 * dt);
        s.speed += (95 - s.speed) * 0.5 * dt;
        s.boosting = false;
      }
      move(dt);
      return 0;
    }
    let ev = 0;
    s.throttle = clamp(s.throttle + inp.throttle * F.throttleRate * dt, 0, 1);
    if (!active) return 0;
    s.time += dt;
    const wasBoosting = s.boosting;
    s.boosting = inp.boost && s.boost > 0.02 && !s.grounded;
    s.boost = clamp(s.boost + (s.boosting ? -F.boostDrain : F.boostFill) * dt, 0, 1);
    if (s.boosting && !wasBoosting) ev |= EV_BOOST;

    const v = s.speed;
    let acc = s.throttle * F.thrust + (s.boosting ? F.boost : 0) - F.drag * v * v - F.g * Math.sin(s.pitch) * 0.9;
    const px = s.x, py = s.y, pz = s.z;

    if (s.grounded) {
      acc -= 0.8 + (s.throttle < 0.15 ? 6 : 0);
      s.roll = 0;
      s.rollVel = 0;
      s.yaw += inp.roll * 0.25 * Math.min(1, v / 20) * dt;
      // Pull to rotate; past lift-off speed the nose lifts by itself so a hands-off take-off still flies.
      const want = v > F.rotate * 0.85 ? Math.max(inp.pitch > 0 ? 0.2 : 0, v > F.rotate + 5 ? 0.13 : 0) : 0;
      s.pitch += clamp(want - s.pitch, -0.5 * dt, 0.5 * dt);
    } else {
      const k = clamp((v - 22) / 34, 0.15, 1); // control authority falls off when slow
      s.rollVel += ((inp.roll ? inp.roll * F.rollRate * k : -s.roll * 2.2) - s.rollVel) * Math.min(1, 9 * dt);
      s.roll = clamp(s.roll + s.rollVel * dt, -F.maxRoll, F.maxRoll);
      s.pitchVel += (inp.pitch * F.pitchRate * k - s.pitchVel) * Math.min(1, 7 * dt);
      const cr = Math.cos(s.roll), sr = Math.sin(s.roll);
      s.pitch += s.pitchVel * cr * dt;
      s.yaw += (s.pitchVel * sr * 0.8 + sr * F.turn * k + inp.roll * 0.1 * k) * dt; // bank to turn (a touch of rudder); pulling in a bank tightens it
      if (!inp.pitch) s.pitch -= s.pitch * 0.55 * dt; // gentle auto-level
      s.pitch -= (1 - cr) * 0.12 * dt;
      if (v < F.stall) s.pitch -= ((F.stall - v) / F.stall) * 1.4 * dt; // stall: the nose drops
      if (s.y > F.ceiling) s.pitch -= 0.6 * dt;
      s.pitch = clamp(s.pitch, -F.maxPitch, F.maxPitch);
      // Leaving the valley: a gentle hand turns the jet back toward the next target.
      const cx = terrain.centre(s.z);
      s.out = Math.abs(s.x - cx) > terrain.halfW(s.z) + 1300 || s.z > 1300 || s.z < -8100;
      if (s.out) {
        const t = rings[Math.min(s.next, RINGS - 1)];
        s.yaw += clamp(wrap(Math.atan2(t.x - s.x, s.z - t.z) - s.yaw), -1, 1) * 0.6 * dt;
      }
    }
    s.yaw = wrap(s.yaw);
    s.speed = clamp(v + acc * dt, 0, F.maxSpeed);
    move(dt);

    // Rings, in order: the segment this step must cross the ring's plane inside its radius.
    if (s.next < RINGS) {
      const r = rings[s.next];
      const a = (px - r.x) * r.nx + (py - r.y) * r.ny + (pz - r.z) * r.nz;
      const b = (s.x - r.x) * r.nx + (s.y - r.y) * r.ny + (s.z - r.z) * r.nz;
      if (a <= 0 && b > 0) {
        const f = a / (a - b);
        const d = Math.hypot(px + (s.x - px) * f - r.x, py + (s.y - py) * f - r.y, pz + (s.z - pz) * f - r.z);
        if (d < RING_R + 1) {
          const split = s.time - s.splitStart - (s.next ? 0 : 6);
          s.lastGain = SCORE.ring + Math.max(0, Math.round((SCORE.split - split) * SCORE.splitPts));
          s.ringPts += s.lastGain;
          s.score = s.ringPts;
          s.splitStart = s.time;
          s.next++;
          ev |= EV_RING;
        }
      }
    }

    const h = terrain.heightAt(s.x, s.z), g = Math.max(0, h), rw = terrain.runwayAt(s.x, s.z);
    s.agl = s.y - F.gear - g;
    if (s.grounded) {
      if (s.pitch > 0.06 && s.speed > F.rotate) {
        s.grounded = false;
        ev |= EV_LIFTOFF;
      } else if (rw < 0 && s.speed > 25) return ev | crash('RAN OFF THE RUNWAY');
      else {
        s.y = g + F.gear;
        s.agl = 0;
      }
    } else if (s.agl <= 0) {
      if (rw < 0 || s.vy < -7 || Math.abs(s.roll) > 0.35 || s.pitch < -0.12) {
        return ev | crash(h < 0 ? 'SPLASHDOWN IN THE RIVER' : rw >= 0 ? 'HARD LANDING' : 'TERRAIN IMPACT');
      }
      ev |= EV_TOUCH;
      s.grounded = true;
      s.y = g + F.gear;
      s.pitch = Math.max(0, s.pitch);
      s.agl = 0;
      if (rw === 1 && s.next >= RINGS) return ev | finish('TOUCHDOWN');
    }

    // Kestrel Field: a low pass over its midpoint also finishes the course.
    const B = RUNWAYS[1];
    if (rw === 1 && !s.grounded && (pz - B.z) * (s.z - B.z) <= 0) {
      if (s.next >= RINGS && s.agl < 25) return ev | finish('LOW PASS');
      if (s.next < RINGS) ev |= EV_NOGO;
    }

    const cp = Math.cos(s.pitch), fx = Math.sin(s.yaw) * cp, fz = -Math.cos(s.yaw) * cp;
    const ahead = ground(s.x + fx * s.speed * 2.2, s.z + fz * s.speed * 2.2);
    s.stall = !s.grounded && s.speed < F.stall + 5;
    s.pullUp = !s.grounded && rw < 0 && ((s.agl < 40 && s.vy < -5) || ahead > s.y + Math.sin(s.pitch) * s.speed * 2.2 - 12);
    return ev;
  }

  reset();
  return { state: s, reset, step };
}
