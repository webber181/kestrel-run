// All sound synthesized with WebAudio: engine hum following throttle, wind rising with speed, ring chime,
// warning beeps, countdown pips, crash thud and finish fanfare. Starts on the first key or click.
export function createAudio() {
  let ac = null, master, engA, engB, engF, engG, windF, windG, boostG, muted = false, nextBeep = 0;

  function start() {
    if (ac) return void (ac.state === 'suspended' && ac.resume());
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    ac = new C();
    master = ac.createGain();
    master.gain.value = 0.55;
    master.connect(ac.destination);
    const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) d[i] = (((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296) * 2 - 1);
    const src = (n) => Object.assign(ac.createBufferSource(), { buffer: n, loop: true });
    engF = Object.assign(ac.createBiquadFilter(), { type: 'lowpass' });
    engG = ac.createGain();
    engG.gain.value = 0;
    engA = Object.assign(ac.createOscillator(), { type: 'sawtooth' });
    engB = Object.assign(ac.createOscillator(), { type: 'square' });
    engA.connect(engF);
    engB.connect(engF);
    engF.connect(engG).connect(master);
    const wind = src(noise);
    windF = Object.assign(ac.createBiquadFilter(), { type: 'bandpass', Q: { value: 0.7 } });
    windG = ac.createGain();
    windG.gain.value = 0;
    wind.connect(windF).connect(windG).connect(master);
    const roar = src(noise);
    const rf = Object.assign(ac.createBiquadFilter(), { type: 'highpass' });
    rf.frequency.value = 1800;
    boostG = ac.createGain();
    boostG.gain.value = 0;
    roar.connect(rf).connect(boostG).connect(master);
    for (const n of [engA, engB, wind, roar]) n.start();
    master.gain.value = muted ? 0 : 0.55;
  }

  function tone(freq, t0, dur, type = 'sine', vol = 0.2, slide = 0) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const now = () => ac.currentTime;
  return {
    start,
    toggleMute() {
      muted = !muted;
      if (ac) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    /** Continuous layers; level 0 silences the engine (menus). */
    update(s, level) {
      if (!ac) return;
      const t = now(), v = s.speed, p = 55 + s.throttle * 70 + v * 0.25 + (s.boosting ? 25 : 0);
      engA.frequency.setTargetAtTime(p, t, 0.12);
      engB.frequency.setTargetAtTime(p * 1.503, t, 0.12);
      engF.frequency.setTargetAtTime(300 + s.throttle * 900 + v * 4, t, 0.15);
      engG.gain.setTargetAtTime(level * (0.05 + s.throttle * 0.07), t, 0.2);
      windF.frequency.setTargetAtTime(400 + v * 9, t, 0.2);
      windG.gain.setTargetAtTime(level * Math.min(0.5, (v / 160) ** 2 * 0.4), t, 0.25);
      boostG.gain.setTargetAtTime(level && s.boosting ? 0.12 : 0, t, 0.1);
      if (level && (s.stall || s.pullUp) && t > nextBeep) {
        tone(s.pullUp ? 330 : 220, t, 0.16, 'square', 0.09);
        tone(s.pullUp ? 330 : 220, t + 0.2, 0.16, 'square', 0.09);
        nextBeep = t + 0.7;
      }
    },
    ring() {
      if (!ac) return;
      const t = now();
      [880, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.5, 'sine', 0.16));
      tone(2349, t + 0.21, 0.6, 'triangle', 0.05);
    },
    pip(go) {
      if (ac) tone(go ? 1046 : 523, now(), go ? 0.45 : 0.16, 'triangle', 0.18);
    },
    crash() {
      if (!ac) return;
      const t = now(), b = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      const n = ac.createBuffer(1, ac.sampleRate * 1.6, ac.sampleRate), d = n.getChannelData(0);
      let sd = 777;
      for (let i = 0; i < d.length; i++) d[i] = ((sd = (Math.imul(sd, 1103515245) + 12345) >>> 0) / 2147483648 - 1) * (1 - i / d.length) ** 2;
      b.buffer = n;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(1600, t);
      f.frequency.exponentialRampToValueAtTime(120, t + 1.4);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      b.connect(f).connect(g).connect(master);
      b.start(t);
      tone(90, t, 1.2, 'sine', 0.5, 30);
    },
    finish() {
      if (!ac) return;
      const t = now();
      [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.13, 0.35, 'triangle', 0.16));
      [784, 1046, 1318].forEach((f) => tone(f, t + 0.6, 1.1, 'triangle', 0.1));
    },
    boost() {
      if (ac) tone(300, now(), 0.4, 'sawtooth', 0.06, 900);
    },
  };
}
