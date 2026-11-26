// Everything three.js draws: gradient sky with a sun, fog, the faceted valley terrain, the river, two
// marked runways with buildings, pines, clouds, the glowing numbered rings, the jet and the chase camera.
import * as THREE from 'three';
import { MAP, RINGS, RING_R, RUNWAYS } from './config.js';
import { createRandom } from './rng.js';
import { createJet, glowTexture } from './aircraft.js';
import { smooth } from './terrain.js';

const SUN = new THREE.Vector3(-0.8, 0.34, -0.5).normalize();
const HORIZON = 0xcfdbe4;
const hash = (x, z) => {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const lin = (c) => c.map((v) => v ** 2.2);
const PAL = {
  sand: lin([0.79, 0.73, 0.55]), mud: lin([0.42, 0.38, 0.3]), forest: lin([0.2, 0.36, 0.17]), rock: lin([0.5, 0.47, 0.43]),
  crag: lin([0.62, 0.6, 0.57]), snow: lin([0.95, 0.96, 0.99]), meadow: lin([0.42, 0.6, 0.25]),
  fields: [[0.5, 0.66, 0.28], [0.74, 0.68, 0.36], [0.56, 0.47, 0.3], [0.35, 0.55, 0.24], [0.63, 0.71, 0.33], [0.45, 0.62, 0.3]].map(lin),
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function terrainMesh(terrain) {
  const { nx, nz, heights } = terrain, { x0, z0, cell } = MAP;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = x0 + i * cell, z = z0 + j * cell, h = heights[k];
      const sx = (heights[k + (i < nx - 1 ? 1 : 0)] - heights[k - (i > 0 ? 1 : 0)]) / (2 * cell);
      const sz = (heights[k + (j < nz - 1 ? nx : 0)] - heights[k - (j > 0 ? nx : 0)]) / (2 * cell);
      const slope = Math.hypot(sx, sz), n = hash(x, z), m = Math.sin(x / 170) * Math.sin(z / 130) + Math.sin((x + z) / 90) * 0.5;
      // Valley floor: a patchwork of fields; slopes go to forest, then rock, then snow on the peaks.
      const fx = Math.floor((x + z * 0.35) / 120), fz = Math.floor(z / 85);
      let c = h < 30 ? PAL.fields[Math.floor(hash(fx, fz) * 6)] : PAL.meadow;
      c = mix(c, PAL.meadow, smooth(18, 40, h));
      c = mix(c, PAL.forest, smooth(0.1, 0.32, slope) * (1 - smooth(300, 420, h)) * (0.7 + 0.3 * m));
      c = mix(c, h > 360 ? PAL.crag : PAL.rock, Math.max(smooth(0.55, 0.95, slope), smooth(330, 460, h + n * 40)));
      c = mix(c, PAL.snow, smooth(560, 640, h + n * 70) * (1 - smooth(1.1, 1.6, slope)));
      c = mix(c, PAL.sand, smooth(4, 1.5, h));
      if (h < 0) c = PAL.mud;
      const b = 0.9 + n * 0.2;
      pos.set([x, h, z], k * 3);
      col.set([c[0] * b, c[1] * b, c[2] * b], k * 3);
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      idx.set([a, a + nx, a + 1, a + 1, a + nx, a + nx + 1], p);
      p += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.96 }));
  m.receiveShadow = true;
  return m;
}

function runwayTexture(home) {
  return canvasTexture(128, 2048, (g, w, h) => {
    g.fillStyle = '#3a3d42';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${hash(i, 1) > 0.5 ? '255,255,255' : '0,0,0'},0.06)`;
      g.fillRect(hash(i, 2) * w, hash(i, 3) * h, 2, 3);
    }
    g.fillStyle = '#f2f2ea';
    g.fillRect(5, 0, 4, h);
    g.fillRect(w - 9, 0, 4, h);
    for (let y = 300; y < h - 300; y += 90) g.fillRect(62, y, 4, 50);
    for (const end of [0, 1]) {
      g.save();
      if (end) g.translate(w, h), g.rotate(Math.PI);
      for (let i = 0; i < 8; i++) g.fillRect(14 + i * 13 + (i > 3 ? 4 : 0), h - 150, 7, 120);
      g.font = 'bold 64px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(end ? '18' : '36', w / 2, h - 175);
      for (const s of [-1, 1]) g.fillRect(w / 2 + s * 26 - 6, h - 420, 12, 70);
      g.restore();
    }
    if (!home) {
      g.fillStyle = '#ffd23f';
      for (let y = 560; y < h - 560; y += 120) g.fillRect(20, y, 88, 6);
    }
  });
}

function buildings(group, x, z, h, rnd) {
  const wall = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.8 }), roof = new THREE.MeshStandardMaterial({ color: 0xb4532c, roughness: 0.7 });
  const put = (geo, m, px, py, pz) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(px, py, pz);
    o.castShadow = o.receiveShadow = true;
    group.add(o);
  };
  put(new THREE.BoxGeometry(30, 9, 26), wall, x, h + 4.5, z);
  put(new THREE.CylinderGeometry(15, 15, 26, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.45, 1), roof, x, h + 9, z);
  put(new THREE.CylinderGeometry(2.6, 3.2, 16, 10), wall, x - 4, h + 8, z - 70);
  put(new THREE.BoxGeometry(8, 4, 8), new THREE.MeshStandardMaterial({ color: 0x173248, metalness: 0.8, roughness: 0.1 }), x - 4, h + 18, z - 70);
  put(new THREE.BoxGeometry(9, 0.6, 9), roof, x - 4, h + 20.3, z - 70);
  for (let i = 0; i < 3; i++) put(new THREE.CylinderGeometry(3, 3, 5, 12), wall, x + 6 + i * 8, h + 2.5, z + 40 + rnd() * 6);
}

export function createScene(canvas, terrain, shot) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!shot, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HORIZON, 700, 7400);
  scene.background = new THREE.Color(HORIZON);
  const camera = new THREE.PerspectiveCamera(64, 1, 0.8, 15000);
  const rnd = createRandom(terrain.seed * 977 + 3);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: SUN }, top: { value: new THREE.Color(0x2c66b8) }, mid: { value: new THREE.Color(0x8ab6df) }, hor: { value: new THREE.Color(HORIZON) } },
    vertexShader: 'varying vec3 d;\nvoid main(){ d = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 sun, top, mid, hor; varying vec3 d;
void main(){ vec3 n = normalize(d); float y = max(n.y, 0.0);
vec3 c = mix(hor, mid, smoothstep(0.0, 0.2, y)); c = mix(c, top, smoothstep(0.2, 0.95, y));
float s = max(dot(n, sun), 0.0); c += vec3(1.0, 0.78, 0.5) * (pow(s, 10.0) * 0.4 + pow(s, 80.0) * 0.6) + vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9996, s) * 6.0;
gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xd6e8ff, 0x5c633c, 1.6));
  const sun = new THREE.DirectionalLight(0xffe0b0, 3.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 1600 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);

  scene.add(terrainMesh(terrain));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a8fb5, emissive: 0x123f55, roughness: 0.12, metalness: 0.2 }));
  water.position.set((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2);
  water.receiveShadow = true;
  scene.add(water);

  // Runways, edge lights and buildings.
  const lightGeo = new THREE.SphereGeometry(0.55, 8, 6), lightMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, toneMapped: false });
  const edge = new THREE.InstancedMesh(lightGeo, lightMat, 160);
  const mtx = new THREE.Matrix4();
  let ne = 0;
  RUNWAYS.forEach((rw, i) => {
    const tex = runwayTexture(i === 0);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rw.w, rw.len).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.set(rw.x, rw.h + 0.25, rw.z);
    m.receiveShadow = true;
    scene.add(m);
    for (let z = -rw.len / 2; z <= rw.len / 2; z += 50) for (const s of [-1, 1]) edge.setMatrixAt(ne++, mtx.makeTranslation(rw.x + s * (rw.w / 2 + 1.5), rw.h + 0.6, rw.z + z));
    buildings(scene, rw.x + 78, rw.z + 120, rw.h, rnd);
  });
  edge.count = ne;
  scene.add(edge);

  // Pines: one tiered lathe silhouette, instanced with per-tree size and tint.
  const tr = terrain.trees, nt = tr.length / 5;
  const pine = new THREE.LatheGeometry([[0.2, 0], [0.2, 1.6], [1.7, 1.6], [0.5, 4.3], [1.3, 4.3], [0.35, 6.8], [0.9, 6.8], [0, 9.6]].map(([r, y]) => new THREE.Vector2(r, y)), 6);
  const trees = new THREE.InstancedMesh(pine, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), nt);
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < nt; i++) {
    const [x, y, z, s, tint] = tr.slice(i * 5, i * 5 + 5);
    q.setFromAxisAngle(up, tint * 6.28);
    trees.setMatrixAt(i, mtx.compose(v.set(x, y - 0.4, z), q, sc.set(s * 1.1, s * (1.1 + tint * 0.6), s * 1.1)));
    trees.setColorAt(i, col.setRGB(0.12 + tint * 0.14, 0.27 + tint * 0.16, 0.13 + tint * 0.05, THREE.SRGBColorSpace));
  }
  trees.receiveShadow = true;
  scene.add(trees);

  // Clouds: clusters of flattened faceted puffs above the ridgelines.
  const puff = new THREE.IcosahedronGeometry(1, 1), cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9aaabb, emissiveIntensity: 0.35, flatShading: true, roughness: 1 });
  for (let c = 0; c < 22; c++) {
    const z = MAP.z0 + 600 + rnd() * (MAP.z1 - MAP.z0 - 600), x = terrain.centre(z) + (rnd() * 2 - 1) * 1300, y = 430 + rnd() * 320;
    for (let p = 0, n = 5 + Math.floor(rnd() * 6); p < n; p++) {
      const m = new THREE.Mesh(puff, cloudMat), r = 26 + rnd() * 42;
      m.position.set(x + (rnd() - 0.5) * 160, y + (rnd() - 0.3) * 24, z + (rnd() - 0.5) * 90);
      m.scale.set(r * 1.3, r * 0.55, r);
      scene.add(m);
    }
  }

  // Rings: a lit core, an additive halo, a faint gate disc and a number badge; the next ring gets a light pillar.
  const coreGeo = new THREE.TorusGeometry(RING_R, 1.3, 10, 72), haloGeo = new THREE.TorusGeometry(RING_R, 4, 10, 72), discGeo = new THREE.CircleGeometry(RING_R - 1, 48);
  const rings = terrain.rings.map((r) => {
    const g = new THREE.Group();
    g.position.set(r.x, r.y, r.z);
    g.lookAt(r.x + r.nx, r.y + r.ny, r.z + r.nz);
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, fog: false }));
    const halo = new THREE.Mesh(haloGeo, additive(0xffffff, 0.3)), disc = new THREE.Mesh(discGeo, additive(0xffffff, 0.06));
    disc.material.side = THREE.DoubleSide;
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ toneMapped: false, fog: false, map: canvasTexture(128, 128, (c) => {
      c.fillStyle = 'rgba(8,18,28,0.85)';
      c.beginPath();
      c.arc(64, 64, 56, 0, 7);
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = '#fff';
      c.stroke();
      c.fillStyle = '#fff';
      c.font = 'bold 66px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(r.index + 1), 64, 68);
    }) }));
    badge.position.y = RING_R + 9;
    badge.scale.setScalar(11);
    g.add(core, halo, disc, badge);
    scene.add(g);
    return { g, core, halo, disc, badge };
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,230,150,0.9)', 'rgba(255,190,50,0.25)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, opacity: 0.55 }));
  glow.scale.setScalar(RING_R * 4.2);
  scene.add(glow);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 600, 10, 1, true).translate(0, 300, 0), additive(0xffc531, 0.28));
  scene.add(pillar);
  // Finish gate over Kestrel Field's threshold: lights up green once all 12 rings are flown.
  const B = RUNWAYS[1], gateMat = additive(0x44ff88, 0.2), gate = new THREE.Group();
  for (const [w, h, x, y] of [[3, 34, -32, 17], [3, 34, 32, 17], [67, 3, 0, 34]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), gateMat);
    m.position.set(x, y, 0);
    gate.add(m);
  }
  gate.position.set(B.x, B.h, B.z + B.len / 2);
  scene.add(gate);

  const jet = createJet();
  scene.add(jet.group);

  // Explosion: a fireball and rising smoke puffs, run from the crash time.
  const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), additive(0xff7a1a, 1));
  const smoke = Array.from({ length: 8 }, () => new THREE.Mesh(puff, new THREE.MeshStandardMaterial({ color: 0x2b2522, transparent: true, flatShading: true })));
  scene.add(fire, ...smoke);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,220,1)', 'rgba(255,120,30,0.6)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scene.add(flash);

  const off = new THREE.Vector3(), want = new THREE.Vector3(), look = new THREE.Vector3(), camUp = new THREE.Vector3();
  let haveOff = false, fov = 64;
  const size = [0, 0];
  const RING_COL = [0x38d9ff, 0xffc531, 0x5cff8a];

  /** Place everything for this frame and render. view: { screen, t, dt, crashAge } */
  function render(s, view) {
    const { screen, t, dt } = view;
    jet.update(s, t);
    jet.group.visible = !s.crashed;
    rings.forEach((r, i) => {
      const st = i < s.next ? 2 : i === s.next ? 1 : 0, pulse = st === 1 ? 1 + 0.06 * Math.sin(t * 5) : 1;
      r.core.material.color.setHex(RING_COL[st]);
      r.core.material.opacity = st === 2 ? 0.35 : 1;
      r.halo.material.color.setHex(RING_COL[st]);
      r.halo.material.opacity = st === 2 ? 0.06 : st === 1 ? 0.42 + 0.12 * Math.sin(t * 5) : 0.22;
      r.disc.visible = st === 1;
      r.badge.material.opacity = st === 2 ? 0.4 : 1;
      r.g.scale.setScalar(pulse);
    });
    const nr = terrain.rings[s.next];
    pillar.visible = !!nr;
    glow.visible = !!nr;
    if (nr) pillar.position.set(nr.x, nr.y + RING_R + 10, nr.z), glow.position.set(nr.x, nr.y, nr.z);
    gateMat.opacity = s.next >= RINGS ? 0.45 + 0.2 * Math.sin(t * 4) : 0.1;

    // Camera.
    const cp = Math.cos(s.pitch), fx = Math.sin(s.yaw) * cp, fy = Math.sin(s.pitch), fz = -Math.cos(s.yaw) * cp;
    camUp.set(0, 1, 0);
    if (screen === 'title' || screen === 'finished' || screen === 'crashed') {
      const title = screen === 'title', a = title ? 0.55 + 0.35 * Math.sin(t * 0.12) : 3.5 - s.yaw + t * 0.12, r = title ? 26 : 46;
      want.set(Math.sin(a) * r, title ? 1.6 : 13, Math.cos(a) * r);
      camera.position.set(s.x + want.x, s.y + want.y, s.z + want.z);
      // Frame the jet off-centre: low in the open band on the title, left of the score card at the end.
      if (title) look.set(s.x - Math.sin(a) * 40, s.y + 7, s.z - 150);
      else look.set(s.x + want.z * 0.45, s.y + 2, s.z - want.x * 0.45);
      haveOff = false;
    } else {
      const back = 21 + s.speed * 0.035;
      want.set(-fx * back, -fy * back + 6.2, -fz * back);
      if (!haveOff || !dt) off.copy(want);
      else off.lerp(want, 1 - Math.exp(-dt * 4));
      haveOff = true;
      camera.position.set(s.x + off.x, s.y + off.y, s.z + off.z);
      look.set(s.x + fx * 30, s.y + fy * 30 + 2.5, s.z + fz * 30);
      const a = s.roll * 0.35;
      camUp.set(Math.cos(s.yaw) * Math.sin(a), Math.cos(a), Math.sin(s.yaw) * Math.sin(a));
    }
    const floor = Math.max(0, terrain.heightAt(camera.position.x, camera.position.z)) + 2.5;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.up.copy(camUp);
    camera.lookAt(look);
    const f = screen === 'play' ? 62 + Math.min(16, Math.max(0, (s.speed - 60) * 0.12)) + (s.boosting ? 5 : 0) : 60;
    fov = dt ? fov + (f - fov) * Math.min(1, dt * 3) : f;
    camera.fov = fov;
    camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.updateProjectionMatrix();

    // Explosion.
    const age = view.crashAge, boom = s.crashed && age < 6;
    fire.visible = flash.visible = boom && age < 1.4;
    smoke.forEach((m, i) => {
      m.visible = boom;
      if (!boom) return;
      const k = Math.min(1, age / 4);
      m.position.set(s.x + Math.sin(i * 2.4) * (4 + age * 3), s.y + 2 + age * (5 + i * 1.5), s.z + Math.cos(i * 2.4) * (4 + age * 3));
      m.scale.setScalar(3 + age * 4 + i * 0.6);
      m.material.opacity = 0.75 * (1 - k * 0.8);
    });
    if (fire.visible) {
      fire.position.set(s.x, s.y + 2, s.z);
      fire.scale.setScalar(4 + age * 20);
      fire.material.opacity = Math.max(0, 1 - age / 1.4);
      flash.position.copy(fire.position);
      flash.scale.setScalar(30 + age * 50);
      flash.material.opacity = fire.material.opacity;
    }

    sun.target.position.set(s.x, s.y, s.z);
    sun.position.set(s.x + SUN.x * 700, s.y + SUN.y * 700, s.z + SUN.z * 700);
    sky.position.copy(camera.position);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== size[0] || h !== size[1]) renderer.setSize(w, h, false), (size[0] = w), (size[1] = h);
    renderer.render(scene, camera);
  }

  const pv = new THREE.Vector3(), dir = new THREE.Vector3();
  /** World point to screen pixels (CSS) plus whether it lies behind the camera. */
  function project(x, y, z) {
    pv.set(x, y, z);
    camera.getWorldDirection(dir);
    const behind = pv.clone().sub(camera.position).dot(dir) < 0;
    pv.project(camera);
    return { x: (pv.x + 1) * 0.5 * canvas.clientWidth, y: (1 - pv.y) * 0.5 * canvas.clientHeight, behind };
  }

  return { render, project };
}
