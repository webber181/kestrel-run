// Boot and the loop. The world advances in fixed 1/60 s steps; the scene and HUD paint every frame.
// Screens: title, countdown, play, paused, crashed, finished. ?seed=N picks the valley (default 1);
// ?shot=start|play|end stages a deterministic scene for screenshots and sets window.__shotReady.
import { BEST_KEY, RINGS, STEP } from './config.js';
import { createTerrain } from './terrain.js';
import { createWorld, EV_BOOST, EV_CRASH, EV_FINISH, EV_LIFTOFF, EV_NOGO, EV_RING } from './world.js';
import { createScene } from './scene.js';
import { createHud, num } from './hud.js';
import { A_INVERT, A_MUTE, A_PAUSE, A_RESTART, A_START, createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const sp = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(sp) ? sp >>> 0 : 1;

const status = document.getElementById('status');
const hudCanvas = document.getElementById('hud');
const terrain = createTerrain(seed);
const world = createWorld(terrain);
const scene = createScene(document.getElementById('view'), terrain, shot);
const hud = createHud(hudCanvas, document.getElementById('overlay'), terrain);
const s = world.state;

function readBest() {
  try {
    return Number.parseInt(localStorage.getItem(`${BEST_KEY}.${seed}`) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(v) {
  try {
    localStorage.setItem(`${BEST_KEY}.${seed}`, String(v));
  } catch {
    // storage may be off: the best then lasts this visit only
  }
}

function runShot(name) {
  document.body.classList.add('shot');
  const screen = stageShot(name, world, terrain);
  const view = { screen, t: 0, dt: 0, crashAge: 9, still: true, countdown: -1, project: scene.project };
  hud.setScreen(screen, s, { best: screen === 'finished' ? s.score : 0, seed, newBest: true, invert: false });
  const paint = () => {
    scene.render(s, view);
    hud.draw(s, view);
  };
  paint();
  requestAnimationFrame(() => {
    paint();
    requestAnimationFrame(() => {
      paint();
      window.__shotReady = true;
    });
  });
}

function runGame() {
  const input = createInput(hudCanvas), audio = createAudio(), inp = { pitch: 0, roll: 0, throttle: 0, boost: false };
  let screen = 'title', resume = 'play', best = readBest(), newBest = false;
  let acc = 0, last = performance.now(), t = 0, cd = -1, endT = 0, toast = '', toastT = 99, toastColor = '';
  const say = (m) => (status.textContent = m);
  const pop = (m, c) => ((toast = m), (toastT = 0), (toastColor = c));

  function startRun() {
    world.reset();
    screen = 'countdown';
    cd = 3;
    acc = 0;
    newBest = false;
    toastT = 99;
    say('Get ready. Three, two, one.');
  }
  function end(next) {
    screen = next;
    endT = t;
    newBest = s.finished && s.score > best;
    if (s.score > best) saveBest((best = s.score));
    say(next === 'finished' ? `Course complete. Score ${s.score}.` : `Crashed: ${s.reason}. Score ${s.score}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    t += dt;
    toastT += dt;
    const a = input.take();
    if (a) audio.start();
    if (a & A_MUTE) pop(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON', '#8dffc4');
    if (a & A_INVERT) input.toggleInvert(), pop(input.invert ? 'PITCH INVERTED' : 'PITCH NORMAL', '#8dffc4');
    const flying = screen === 'play' || screen === 'countdown';
    if (screen === 'title' && a & A_START) startRun();
    else if ((screen === 'crashed' || screen === 'finished') && (a & A_RESTART || (a & A_START && t - endT > 1.2))) startRun();
    else if ((flying || screen === 'paused') && a & A_RESTART) startRun();
    else if (flying && a & A_PAUSE) (resume = screen), (screen = 'paused'), say('Paused.');
    else if (screen === 'paused' && a & (A_PAUSE | A_START)) (screen = resume), (last = now), say('Flying.');

    if (screen === 'countdown') {
      const before = Math.ceil(cd);
      cd -= dt;
      world.step(dt, input.read(inp), false);
      if (Math.ceil(cd) !== before) audio.pip(cd <= 0);
      if (cd <= 0) screen = 'play';
    } else if (screen === 'play') {
      cd -= dt;
      acc += dt;
      while (acc >= STEP && screen === 'play') {
        acc -= STEP;
        const ev = world.step(STEP, input.read(inp), true);
        if (ev & EV_RING) audio.ring(), pop(`+${num(s.lastGain)}  RING ${s.next}/${RINGS}`), say(`Ring ${s.next} of ${RINGS}.`);
        if (ev & EV_NOGO) pop(`${RINGS - s.next} RING${RINGS - s.next > 1 ? 'S' : ''} STILL TO FLY`, '#ff5040');
        if (ev & EV_LIFTOFF && s.time < 15) pop('AIRBORNE', '#8dffc4');
        if (ev & EV_BOOST) audio.boost();
        if (ev & EV_CRASH) audio.crash(), end('crashed');
        if (ev & EV_FINISH) audio.finish(), end('finished');
      }
    } else if (screen === 'finished') world.step(dt, inp, true); // victory lap
    audio.update(s, screen === 'play' || screen === 'countdown' ? 1 : screen === 'finished' ? 0.5 : 0);
    const view = { screen, t, dt: screen === 'paused' ? 0 : dt, crashAge: t - endT, countdown: cd, toast, toastAge: toastT, toastColor, project: scene.project };
    scene.render(s, view);
    hud.draw(s, view);
    hud.setScreen(screen, s, { best, seed, newBest, invert: input.invert });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (screen === 'play' || screen === 'countdown')) (resume = screen), (screen = 'paused');
  });
  say('Kestrel Run. Press Enter or Space to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
