// Every tuning number for KESTREL RUN. Units: metres, seconds, radians (HUD converts to kt/ft).
export const STEP = 1 / 60;
export const KT = 1.94384;
export const FT = 3.28084;

// The terrain grid: x west-east, z south(+)-north(-), one height sample per cell corner.
export const MAP = { x0: -2600, x1: 2600, z0: -8400, z1: 1600, cell: 20 };

// Home strip at the south end (start) and Kestrel Field at the north end (finish), both heading north.
export const RUNWAYS = [
  { x: 130, z: 0, h: 8, len: 800, w: 40 },
  { x: 130, z: -7200, h: 8, len: 800, w: 40 },
];
export const START = { x: 130, z: 360 };

export const RINGS = 12;
export const RING_R = 20;

export const FLIGHT = {
  thrust: 22, // m/s^2 at full throttle
  boost: 19, // extra m/s^2 while boosting
  drag: 0.00112, // top speed ~140 m/s at full throttle, ~190 with boost
  g: 9.8,
  stall: 40, // m/s (~78 kt)
  rotate: 47, // lift-off speed
  maxSpeed: 220,
  rollRate: 2.5,
  maxRoll: 1.35,
  pitchRate: 0.9,
  turn: 0.95, // heading rate at full bank
  maxPitch: 1.2,
  gear: 1.7, // wheel height above ground
  ceiling: 1500,
  throttleRate: 0.7,
  boostDrain: 0.32,
  boostFill: 0.07,
};

export const SCORE = { ring: 400, split: 8, splitPts: 45, par: 140, parPts: 25, touchdown: 1000, lowPass: 400 };
export const BEST_KEY = 'kestrel-run.best';
