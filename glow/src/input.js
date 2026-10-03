export function createInput(canvas) {
  const state = {
    move: { x: 0, y: 0 },
    rise: 0,
    look: { x: 0, y: 0 },
    boost: false,
    dim: false,
    keys: new Set(),
    pointer: false,
    touch: matchMedia("(pointer: coarse)").matches,
    scheme: "classic",
    joy: { x: 0, y: 0 },
  };

  const down = (e) => {
    state.keys.add(e.code);
    if (e.code === "KeyE") state.dim = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") state.boost = true;
  };
  const up = (e) => {
    state.keys.delete(e.code);
    if (e.code === "KeyE") state.dim = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") state.boost = false;
  };

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2) state.dim = true;
    if (e.button === 0 && !state.pointer) {
      canvas.requestPointerLock?.();
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) state.dim = false;
  });
  document.addEventListener("pointerlockchange", () => {
    state.pointer = document.pointerLockElement === canvas;
  });
  window.addEventListener("mousemove", (e) => {
    if (!state.pointer) return;
    state.look.x += e.movementX;
    state.look.y += e.movementY;
  });

  function poll() {
    const k = state.keys;
    let x = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + state.joy.x;
    let y = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0) + state.joy.y;
    if (state.scheme === "one_finger" && state.touch) y = Math.max(y, 0.55);
    const len = Math.hypot(x, y) || 1;
    state.move.x = x / Math.max(1, len);
    state.move.y = y / Math.max(1, len);
    state.rise = (k.has("Space") ? 1 : 0) - (k.has("ControlLeft") || k.has("ControlRight") ? 1 : 0);
    state.boost = state.boost || k.has("ShiftLeft") || k.has("ShiftRight");
    const pads = navigator.getGamepads?.() || [];
    const g = pads[0];
    if (g) {
      const dz = 0.18;
      const lx = Math.abs(g.axes[0]) > dz ? g.axes[0] : 0;
      const ly = Math.abs(g.axes[1]) > dz ? -g.axes[1] : 0;
      state.move.x += lx;
      state.move.y += ly;
      const rx = Math.abs(g.axes[2]) > dz ? g.axes[2] : 0;
      const ry = Math.abs(g.axes[3]) > dz ? g.axes[3] : 0;
      state.look.x += rx * 12;
      state.look.y += ry * 12;
      if (g.buttons[7]?.pressed) state.boost = true;
      if (g.buttons[6]?.pressed) state.dim = true;
      if (g.buttons[5]?.pressed) state.rise += 1;
      if (g.buttons[4]?.pressed) state.rise -= 1;
    }
    return state;
  }

  function consumeLook(sens) {
    const x = state.look.x * sens;
    const y = state.look.y * sens;
    state.look.x = 0;
    state.look.y = 0;
    return { x, y };
  }

  return { state, poll, consumeLook };
}
