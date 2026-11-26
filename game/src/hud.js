// The cockpit HUD on a 2D canvas over the 3D view (lit instruments on dark glass panels) plus the DOM
// menu panels. Layout is in a 1280x720-scaled logical space anchored to the window edges.
import { FT, KT, MAP, RINGS, RUNWAYS } from './config.js';

const LIT = '#8dffc4', AMBER = '#ffc94d', RED = '#ff5040', CYAN = '#5fe3ff', DIM = 'rgba(200,255,228,0.62)';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const MAPV = { x0: -1300, x1: 1300, z0: -7900, z1: 900 };
const h1 = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
export const num = (n) => Math.round(n).toLocaleString('en-US');

function minimapImage(terrain) {
  const w = (MAPV.x1 - MAPV.x0) / 20, h = (MAPV.z1 - MAPV.z0) / 20, c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = MAPV.x0 + i * 20, z = MAPV.z0 + j * 20, e = terrain.heightAt(x, z);
      const shade = Math.max(-1, Math.min(1, (terrain.heightAt(x - 20, z - 20) - e) / 25));
      let r, gg, b;
      if (e < 0) [r, gg, b] = [40, 120, 170];
      else if (e < 40) [r, gg, b] = [70, 120, 60];
      else if (e < 400) [r, gg, b] = [70 + e * 0.15, 105 - e * 0.05, 55 + e * 0.05];
      else [r, gg, b] = [190, 190, 195];
      const k = (j * w + i) * 4, f = 1 + shade * 0.35;
      img.data.set([r * f, gg * f, b * f, 255], k);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function createHud(canvas, overlay, terrain) {
  const g = canvas.getContext('2d');
  const map = minimapImage(terrain);
  let W = 1280, H = 720, k = 1;
  let lastScreen = '';

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = canvas.clientWidth, ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    k = Math.min(cw / 1280, ch / 720);
    W = cw / k;
    H = ch / k;
    g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  }

  function text(s, x, y, size, color, align = 'left', font = MONO, glow = true) {
    g.font = `700 ${size}px ${font}`;
    g.textAlign = align;
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = glow ? 9 : 0;
    g.fillText(s, x, y);
    g.shadowBlur = 0;
  }
  function panel(x, y, w, h, edge = 'rgba(141,255,196,0.35)') {
    g.beginPath();
    g.roundRect(x, y, w, h, 10);
    g.fillStyle = 'rgba(3,12,18,0.66)';
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = edge;
    g.stroke();
  }
  function bar(x, y, w, h, f, color) {
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(x, y, w, h);
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 8;
    g.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.strokeRect(x, y, w, h);
  }

  function speedLines(s, t) {
    const f = Math.max(0, (s.speed - 75) / 110) + (s.boosting ? 0.5 : 0);
    if (f <= 0) return;
    const cx = W / 2, cy = H / 2, d = Math.hypot(W, H) / 2, n = Math.floor(14 + f * 34), fr = Math.floor(t * 14);
    g.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      const sd = i * 7.13 + fr * 3.7, a = h1(sd) * 6.283, r0 = (0.32 + 0.4 * h1(sd + 1)) * d, len = (40 + 120 * h1(sd + 2)) * Math.min(1.6, f);
      g.strokeStyle = `rgba(235,248,255,${(0.12 + 0.25 * h1(sd + 3)) * Math.min(1, f)})`;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      g.stroke();
    }
  }

  function compass(s) {
    const w = 460, x = W / 2 - w / 2, y = 14, hdg = ((s.yaw * 180) / Math.PI + 360) % 360;
    panel(x, y, w, 46);
    g.save();
    g.beginPath();
    g.rect(x + 6, y, w - 12, 46);
    g.clip();
    for (let d = Math.floor(hdg - 50); d <= hdg + 50; d++) {
      if (d % 5) continue;
      const px = W / 2 + (d - hdg) * 4.4, dd = ((d % 360) + 360) % 360, major = dd % 30 === 0;
      g.fillStyle = major ? LIT : DIM;
      g.fillRect(px - 0.75, y + 30 - (major ? 10 : dd % 10 ? 4 : 7), 1.5, major ? 10 : dd % 10 ? 4 : 7);
      if (major) text(['N', 'E', 'S', 'W'][dd / 90] ?? String(dd / 10).padStart(2, '0'), px, y + 17, dd % 90 ? 12 : 15, dd % 90 ? LIT : AMBER, 'center');
    }
    g.restore();
    g.beginPath();
    g.roundRect(W / 2 - 30, y + 30, 60, 24, 5);
    g.fillStyle = 'rgba(4,14,20,0.92)';
    g.fill();
    g.strokeStyle = LIT;
    g.stroke();
    text(`${String(Math.round(hdg) % 360).padStart(3, '0')}°`, W / 2, y + 48, 15, LIT, 'center');
  }

  function attitude(s) {
    const cx = W / 2, cy = H - 84, r = 64, pp = 2.6; // px per degree of pitch
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.fillStyle = 'rgba(4,14,20,0.7)';
    g.fill();
    g.clip();
    g.translate(cx, cy);
    g.rotate(-s.roll);
    g.translate(0, (s.pitch * 180 / Math.PI) * pp);
    g.fillStyle = 'rgba(40,120,200,0.75)';
    g.fillRect(-150, -400, 300, 400);
    g.fillStyle = 'rgba(130,85,40,0.8)';
    g.fillRect(-150, 0, 300, 400);
    g.fillStyle = '#fff';
    g.fillRect(-150, -1, 300, 2);
    for (let p = -30; p <= 30; p += 10) if (p) {
      g.fillRect(-16, -p * pp - 0.6, 32, 1.2);
      text(String(Math.abs(p)), 24, -p * pp + 4, 9, '#fff', 'left', MONO, false);
    }
    g.restore();
    g.lineWidth = 3;
    g.strokeStyle = AMBER;
    g.shadowColor = AMBER;
    g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(cx - 34, cy);
    g.lineTo(cx - 12, cy);
    g.lineTo(cx - 6, cy + 7);
    g.lineTo(cx, cy);
    g.lineTo(cx + 6, cy + 7);
    g.lineTo(cx + 12, cy);
    g.lineTo(cx + 34, cy);
    g.stroke();
    g.shadowBlur = 0;
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(141,255,196,0.6)';
    g.stroke();
    for (const a of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) {
      const t = ((a - 90) * Math.PI) / 180;
      g.beginPath();
      g.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
      g.lineTo(cx + Math.cos(t) * (r - (a % 30 ? 5 : 9)), cy + Math.sin(t) * (r - (a % 30 ? 5 : 9)));
      g.strokeStyle = LIT;
      g.stroke();
    }
    const t = -Math.PI / 2 - s.roll;
    g.fillStyle = AMBER;
    g.beginPath();
    g.moveTo(cx + Math.cos(t) * (r - 10), cy + Math.sin(t) * (r - 10));
    g.lineTo(cx + Math.cos(t + 0.09) * (r - 20), cy + Math.sin(t + 0.09) * (r - 20));
    g.lineTo(cx + Math.cos(t - 0.09) * (r - 20), cy + Math.sin(t - 0.09) * (r - 20));
    g.fill();
  }

  function minimap(s) {
    const w = 104, h = 352, x = W - w - 18, y = 16, sx = w / (MAPV.x1 - MAPV.x0), sz = h / (MAPV.z1 - MAPV.z0);
    panel(x - 6, y - 4, w + 12, h + 26);
    g.globalAlpha = 0.85;
    g.drawImage(map, x, y, w, h);
    g.globalAlpha = 1;
    const px = (wx) => x + (wx - MAPV.x0) * sx, pz = (wz) => y + (wz - MAPV.z0) * sz;
    g.fillStyle = '#e8e8e8';
    for (const rw of RUNWAYS) g.fillRect(px(rw.x) - 2, pz(rw.z - rw.len / 2), 4, rw.len * sz);
    terrain.rings.forEach((r, i) => {
      g.beginPath();
      g.arc(px(r.x), pz(r.z), i === s.next ? 4 : 2.6, 0, 7);
      g.fillStyle = i < s.next ? '#5cff8a' : i === s.next ? AMBER : CYAN;
      g.fill();
    });
    g.save();
    g.translate(Math.max(x, Math.min(x + w, px(s.x))), Math.max(y, Math.min(y + h, pz(s.z))));
    g.rotate(s.yaw);
    g.fillStyle = '#fff';
    g.shadowColor = '#fff';
    g.shadowBlur = 6;
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 5);
    g.lineTo(0, 2);
    g.lineTo(-5, 5);
    g.fill();
    g.restore();
    g.shadowBlur = 0;
    text('VALLEY', x + w / 2, y + h + 16, 10, DIM, 'center');
  }

  function target(s, project) {
    const r = terrain.rings[s.next], B = RUNWAYS[1];
    const [tx, ty, tz, label] = r ? [r.x, r.y, r.z, `RING ${s.next + 1}`] : [B.x, B.h + 5, B.z + B.len / 2, 'FINISH'];
    const p = project(tx, ty, tz), d = Math.hypot(tx - s.x, ty - s.y, tz - s.z);
    const dist = d > 1000 ? `${(d / 1000).toFixed(1)} KM` : `${Math.round(d)} M`;
    const x = p.x / k, y = p.y / k, m = 70, col = r ? AMBER : '#5cff8a';
    if (!p.behind && x > m && x < W - m && y > m && y < H - m) {
      const b = Math.max(14, Math.min(60, 9000 / d));
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.shadowColor = col;
      g.shadowBlur = 8;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.beginPath();
        g.moveTo(x + sx * b, y + sy * (b - 8));
        g.lineTo(x + sx * b, y + sy * b);
        g.lineTo(x + sx * (b - 8), y + sy * b);
        g.stroke();
      }
      g.shadowBlur = 0;
      text(`${label} · ${dist}`, x, y - b - 8, 12, col, 'center');
      return;
    }
    // Off-screen arrow on an ellipse round the centre, pointing toward the target.
    let dx = x - W / 2, dy = y - H / 2;
    if (p.behind) (dx = -dx), (dy = -dy);
    if (p.behind && Math.abs(dy) < 1 && Math.abs(dx) < 1) dy = 1;
    const a = Math.atan2(dy, dx), ex = W / 2 + Math.cos(a) * (W / 2 - 150), ey = H / 2 + Math.sin(a) * (H / 2 - 120);
    g.save();
    g.translate(ex, ey);
    g.rotate(a);
    g.fillStyle = col;
    g.shadowColor = col;
    g.shadowBlur = 12;
    g.beginPath();
    g.moveTo(22, 0);
    g.lineTo(-8, -14);
    g.lineTo(-2, 0);
    g.lineTo(-8, 14);
    g.fill();
    g.restore();
    g.shadowBlur = 0;
    text(`${label} ${dist}`, ex, ey + 32, 12, col, 'center');
  }

  function reticle(s, project) {
    const cp = Math.cos(s.pitch), p = project(s.x + Math.sin(s.yaw) * cp * 400, s.y + Math.sin(s.pitch) * 400, s.z - Math.cos(s.yaw) * cp * 400);
    const x = p.behind ? W / 2 : p.x / k, y = p.behind ? H / 2 : p.y / k;
    g.strokeStyle = LIT;
    g.lineWidth = 2;
    g.shadowColor = LIT;
    g.shadowBlur = 8;
    g.beginPath();
    g.arc(x, y, 9, 0, 7);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      g.moveTo(x + a * 14, y + b * 14);
      g.lineTo(x + a * 24, y + b * 24);
    }
    g.stroke();
    g.fillStyle = LIT;
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
    g.shadowBlur = 0;
  }

  /** One frame of HUD. v: { screen, t, project, countdown, toast, toastAge } */
  function draw(s, v) {
    if (canvas.width !== Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))) resize();
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.restore();
    if (v.screen === 'title') return;
    const { t, project } = v;
    if (!s.crashed) speedLines(s, t);
    if (v.screen === 'play' || v.screen === 'countdown') {
      reticle(s, project);
      target(s, project);
    }
    // Course panel.
    panel(16, 16, 220, 104);
    text('RING', 30, 44, 13, DIM);
    text(`${Math.min(s.next + (s.finished ? 0 : 1), RINGS)}/${RINGS}`, 30, 78, 32, AMBER);
    text('SCORE', 222, 44, 13, DIM, 'right');
    text(num(s.score), 222, 78, 26, LIT, 'right');
    text(`TIME ${clock(s.time)}`, 30, 106, 15, LIT);
    compass(s);
    if (s.crashed || s.finished) return;
    minimap(s);
    // Airspeed + throttle + boost.
    let y = H - 172;
    panel(16, y, 236, 156);
    text('AIRSPEED', 30, y + 24, 12, DIM);
    text(String(Math.round(s.speed * KT)), 30, y + 68, 44, s.stall ? RED : LIT);
    text('KT', 132, y + 68, 16, DIM);
    text(`${s.boosting ? 'BOOST' : ''}`, 238, y + 24, 12, CYAN, 'right');
    text('THR', 30, y + 98, 12, DIM);
    bar(70, y + 88, 166, 11, s.throttle, AMBER);
    text(`${Math.round(s.throttle * 100)}%`, 238, y + 116, 11, AMBER, 'right');
    text('BST', 30, y + 138, 12, DIM);
    bar(70, y + 128, 166, 11, s.boost, CYAN);
    // Altitude + vertical speed + height above ground.
    const x = W - 252;
    panel(x, y, 236, 156);
    text('ALTITUDE', x + 14, y + 24, 12, DIM);
    text(num(s.y * FT), x + 14, y + 68, 44, s.pullUp ? RED : LIT);
    text('FT', x + 200, y + 68, 16, DIM);
    const vs = Math.round((s.vy * FT * 60) / 50) * 50;
    text(`VS  ${vs > 0 ? '+' : ''}${num(vs)} FPM`, x + 14, y + 104, 14, LIT);
    text(`AGL ${num(Math.max(0, s.agl) * FT)} FT`, x + 14, y + 132, 14, s.agl < 60 && !s.grounded ? AMBER : LIT);
    attitude(s);
    // Warnings, toasts, countdown.
    const blink = Math.floor(t * 4) % 2 === 0;
    const warn = s.crashed || s.finished ? '' : s.pullUp ? 'PULL UP' : s.stall ? 'STALL' : s.out ? 'RETURN TO COURSE' : '';
    if (warn && (blink || v.still)) {
      g.font = `800 28px ${SANS}`;
      const w = g.measureText(warn).width + 40;
      panel(W / 2 - w / 2, H / 2 + 60, w, 46, RED);
      text(warn, W / 2, H / 2 + 93, 28, RED, 'center', SANS);
    }
    if (v.toast && v.toastAge < 1.8) {
      g.globalAlpha = Math.min(1, (1.8 - v.toastAge) * 2);
      text(v.toast, W / 2, H / 2 - 110 - v.toastAge * 12, 30, v.toastColor || AMBER, 'center', SANS);
      g.globalAlpha = 1;
    }
    if ((v.screen === 'countdown' || v.screen === 'play') && v.countdown > -0.7) {
      const c = v.countdown, label = c > 0 ? String(Math.ceil(c)) : 'GO!', f = c > 0 ? c % 1 : 1 + c;
      g.globalAlpha = Math.max(0, Math.min(1, f * 1.4));
      text(label, W / 2, H / 2 - 40, 96 + (1 - f) * 30, c > 0 ? AMBER : LIT, 'center', SANS);
      g.globalAlpha = 1;
    }
  }

  const KEYS = `<div class="keys">
<span><b>S</b>/<b>↓</b> pull up · <b>W</b>/<b>↑</b> nose down</span><span><b>A</b>/<b>D</b> or <b>←</b>/<b>→</b> bank &amp; turn</span>
<span><b>Shift</b>/<b>E</b> throttle up · <b>Ctrl</b>/<b>Q</b> down</span><span><b>Space</b> boost · <b>P</b>/<b>Esc</b> pause</span>
<span><b>I</b> invert pitch · <b>M</b> mute</span><span>Mouse: hold button &amp; drag to steer</span></div>`;

  /** Swap the DOM panel when the screen changes. d: { best, seed, newBest, invert } */
  function setScreen(screen, s, d) {
    const key = `${screen}|${d.best}|${d.invert}`;
    if (key === lastScreen) return;
    lastScreen = key;
    overlay.className = screen;
    const row = (a, b) => `<div class="row"><span>${a}</span><b>${b}</b></div>`;
    if (screen === 'title') {
      overlay.innerHTML = `<div class="logo"><h1>KESTREL<em>RUN</em></h1><p>Thread twelve lit rings down a mountain valley, then put it down on Kestrel Field.</p></div>
<div class="card bottom">${KEYS}<div class="prompt">PRESS ENTER OR SPACE TO FLY</div><div class="meta">BEST ${d.best ? num(d.best) : '—'} · VALLEY SEED ${d.seed}${d.invert ? ' · PITCH INVERTED' : ''}</div></div>`;
    } else if (screen === 'paused') {
      overlay.innerHTML = `<div class="card mid"><h2>PAUSED</h2>${KEYS}<div class="prompt">PRESS P OR ESC TO RESUME</div></div>`;
    } else if (screen === 'crashed') {
      overlay.innerHTML = `<div class="card mid"><h2 class="bad">CRASHED</h2><div class="reason">${s.reason}</div>
${row('Rings flown', `${s.next} / ${RINGS}`)}${row('Flight time', clock(s.time))}${row('Score', num(s.score))}${row('Best', num(d.best))}
<div class="prompt">PRESS R TO FLY AGAIN</div></div>`;
    } else if (screen === 'finished') {
      overlay.innerHTML = `<div class="card mid"><h2 class="good">COURSE COMPLETE</h2><div class="reason">${s.finishType} AT KESTREL FIELD${d.newBest ? ' · <span class="nb">NEW BEST</span>' : ''}</div>
<div class="big">${num(s.score)}</div>${row('Rings 12 / 12', num(s.ringPts))}${row(`Time ${clock(s.time)}`, `+${num(s.timeBonus)}`)}${row(s.finishType === 'TOUCHDOWN' ? 'Touchdown bonus' : 'Low pass bonus', `+${num(s.landBonus)}`)}${row('Best', num(d.best))}
<div class="prompt">PRESS R TO FLY AGAIN</div></div>`;
    } else overlay.innerHTML = '';
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, setScreen };
}
