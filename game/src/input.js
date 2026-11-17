// Keyboard and mouse input. Held keys give movement and steering; one-shot
// presses (enter a car, shoot, pause, save, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost.
export const ACTION_ENTER = 1;
export const ACTION_SHOOT = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_SAVE = 16;
export const ACTION_MUTE = 32;

const KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let mouse = { x: 0, y: 0 };

  window.addEventListener('keydown', (event) => {
    const name = KEYS[event.code];
    if (name) {
      held[name] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'Space') { actions |= ACTION_SHOOT; event.preventDefault(); }
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyQ') actions |= ACTION_SAVE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYS[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    actions |= ACTION_CONFIRM;
  });

  return {
    held,
    mouse() { return mouse; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
