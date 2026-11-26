// Keyboard (primary) and optional mouse steering. Held keys are read each step; one-shot presses are
// queued as A_* flags and taken once by the loop.
export const A_START = 1, A_PAUSE = 2, A_RESTART = 4, A_INVERT = 8, A_MUTE = 16;

const KEYS = {
  up: ['KeyS', 'ArrowDown'], down: ['KeyW', 'ArrowUp'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  thrUp: ['ShiftLeft', 'ShiftRight', 'KeyE'], thrDown: ['ControlLeft', 'ControlRight', 'KeyQ'], boost: ['Space'],
};
const ONCE = { Enter: A_START, Space: A_START, KeyP: A_PAUSE, Escape: A_PAUSE, KeyR: A_RESTART, KeyI: A_INVERT, KeyM: A_MUTE };
const HANDLED = new Set([...Object.values(KEYS).flat(), ...Object.keys(ONCE)]);

export function createInput(target) {
  const held = new Set();
  let actions = 0, invert = false, mouse = null;
  const any = (list) => list.some((c) => held.has(c));

  window.addEventListener('keydown', (e) => {
    if (!HANDLED.has(e.code)) return;
    e.preventDefault();
    held.add(e.code);
    if (!e.repeat && ONCE[e.code]) actions |= ONCE[e.code];
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', (e) => {
    actions |= A_START;
    mouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', (e) => mouse && ((mouse.x = e.clientX), (mouse.y = e.clientY)));
  window.addEventListener('pointerup', () => (mouse = null));

  return {
    get invert() {
      return invert;
    },
    toggleInvert() {
      invert = !invert;
    },
    /** Fill `out` with this step's controls. */
    read(out) {
      let pitch = (any(KEYS.up) ? 1 : 0) - (any(KEYS.down) ? 1 : 0);
      let roll = (any(KEYS.right) ? 1 : 0) - (any(KEYS.left) ? 1 : 0);
      if (mouse) {
        const c = (v, n) => Math.max(-1, Math.min(1, v / (n * 0.3)));
        if (!roll) roll = c(mouse.x - innerWidth / 2, innerWidth) * 0.7;
        if (!pitch) pitch = c(innerHeight / 2 - mouse.y, innerHeight) * 0.6;
      }
      out.pitch = invert ? -pitch : pitch;
      out.roll = Math.abs(roll) < 0.04 ? 0 : roll;
      out.throttle = (any(KEYS.thrUp) ? 1 : 0) - (any(KEYS.thrDown) ? 1 : 0);
      out.boost = any(KEYS.boost);
      return out;
    },
    take() {
      const a = actions;
      actions = 0;
      return a;
    },
  };
}
