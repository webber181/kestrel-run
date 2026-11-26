// The Kestrel: a small procedural jet (lathe fuselage, swept wings, tail, canopy, nozzle and an engine
// glow that grows with throttle and turns blue-white on boost). Nose points -Z, 11.6 m long.
import * as THREE from 'three';

const mat = (color, metalness, roughness, extra) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
};
// A flat shape (x across, y along the body) extruded into a thin horizontal plate.
function plate(points, depth) {
  const sh = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.5, bevelSegments: 1 });
  return g.rotateX(Math.PI / 2).translate(0, depth / 2, 0);
}

export function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, inner);
  r.addColorStop(0.35, outer);
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createJet() {
  const jet = new THREE.Group();
  const body = new THREE.Group(); // pitch/roll pivot sits on the jet's centre of mass
  jet.add(body);
  const paint = mat(0xece6da, 0.35, 0.42), accent = mat(0xd9541e, 0.3, 0.45), dark = mat(0x262b33, 0.7, 0.35);
  const glass = mat(0x10283f, 0.9, 0.06, { emissive: 0x0b3a5c, emissiveIntensity: 0.5 });

  const prof = [[0, 0], [0.22, 0.35], [0.5, 1.3], [0.75, 2.8], [0.9, 4.8], [0.95, 7], [0.88, 9.4], [0.66, 11.1], [0.58, 11.6]];
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).rotateX(Math.PI / 2).translate(0, 0, -6);
  add(body, lathe(prof, 20).scale(1, 0.85, 1), paint);
  add(body, lathe(prof.slice(0, 3).map(([r, y]) => [r * 1.04, y]), 20).scale(1, 0.85, 1), accent); // nose cone
  add(body, new THREE.CylinderGeometry(0.965, 0.965, 0.6, 20).rotateX(Math.PI / 2).scale(1, 0.86, 1), accent, 0, 0, 1); // belly band

  // Main wing, low-mounted and swept; tips painted.
  add(body, plate([[0, -1.6], [4.7, 2.0], [4.7, 3.0], [1, 3.7], [-1, 3.7], [-4.7, 3.0], [-4.7, 2.0]], 0.22), paint, 0, -0.35, 0);
  for (const sx of [-1, 1]) {
    add(body, new THREE.BoxGeometry(0.16, 0.5, 1.5), accent, sx * 4.72, -0.2, 2.5);
    add(body, plate([[0, 3.7], [2.3, 5.3], [2.3, 5.9], [0, 6.0]].map(([x, y]) => [x * sx, y]), 0.14), accent, 0, 0.05, 0);
    add(body, new THREE.BoxGeometry(0.5, 0.62, 2.2), dark, sx * 0.86, -0.12, -0.6); // intakes
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xff3030 : 0x30ff60 }));
    nav.position.set(sx * 4.8, -0.2, 2.1);
    body.add(nav);
  }
  // Tail fin: a swept plate stood on edge.
  const fin = plate([[0, 2.3], [2.9, 5.2], [3.1, 6.1], [0, 5.9]], 0.16).rotateZ(Math.PI / 2);
  add(body, fin, accent, 0.08, 0.45, 0);
  add(body, new THREE.SphereGeometry(0.62, 18, 12).scale(0.95, 0.85, 2.6), glass, 0, 0.5, -2.5); // canopy
  add(body, new THREE.TorusGeometry(0.6, 0.06, 6, 20, Math.PI).scale(0.95, 0.9, 1), dark, 0, 0.45, -2.2); // canopy frame
  add(body, new THREE.BoxGeometry(0.5, 0.42, 4.2), paint, 0, 0.62, 1.2); // dorsal spine
  add(body, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5).rotateX(Math.PI / 2), dark, 0, 0, -6.5); // pitot
  for (const sx of [-1, 1]) add(body, new THREE.BoxGeometry(0.1, 0.7, 1.4).rotateZ(sx * 0.5), accent, sx * 0.55, -0.85, 4.6); // ventral fins
  add(body, new THREE.CylinderGeometry(0.5, 0.6, 0.9, 18, 1, true).rotateX(Math.PI / 2), dark, 0, 0, 5.9);
  // Landing gear, lowered near the ground.
  const gear = new THREE.Group(), tyre = mat(0x15171a, 0, 0.9);
  for (const [x, z] of [[0, -4.1], [-1.35, 1.6], [1.35, 1.6]]) {
    add(gear, new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), dark, x, -1, z);
    add(gear, new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12).rotateZ(Math.PI / 2), tyre, x, -1.4, z);
  }
  body.add(gear);

  // Engine glow: an additive flame cone, a hot core and a soft sprite.
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flame = add(body, new THREE.ConeGeometry(0.46, 1, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), flameMat, 0, 0, 6.2);
  flame.castShadow = false;
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.44, 18), new THREE.MeshBasicMaterial({ color: 0xfff1c0, toneMapped: false }));
  core.position.z = 6.3;
  body.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,240,200,1)', 'rgba(255,140,40,0.55)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.position.z = 6.6;
  body.add(halo);

  jet.traverse((o) => o.isMesh && (o.receiveShadow = true));
  function update(s, t) {
    jet.position.set(s.x, s.y, s.z);
    jet.rotation.set(0, -s.yaw, 0);
    body.rotation.set(s.pitch, 0, -s.roll, 'YXZ');
    gear.visible = s.agl < 25;
    const p = 0.35 + s.throttle * 0.9 + (s.boosting ? 1.2 : 0), flick = 0.92 + 0.08 * Math.sin(t * 61);
    flame.scale.set(1, 1, (1.2 + p * 3.2) * flick);
    flameMat.color.setHex(s.boosting ? 0x8fc8ff : 0xff8a2a);
    halo.scale.setScalar((2.2 + p * 2.2) * flick);
  }
  return { group: jet, update };
}
