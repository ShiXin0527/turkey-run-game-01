// Keyboard and pointer input. Held keys give a slide; one-shot presses (jump, start or
// restart, pause, mute) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A click / tap on the canvas
// jumps; the on-screen JUMP and SLIDE buttons do the same for mouse-only play.

export const ACTION_JUMP = 1;
export const ACTION_CONFIRM = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;
export const ACTION_SLIDE = 16;

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
const SLIDE = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas, buttons) {
  let sliding = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP | ACTION_CONFIRM;
    } else if (SLIDE.has(event.code)) {
      sliding = true;
      if (!event.repeat) actions |= ACTION_SLIDE;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (SLIDE.has(event.code)) sliding = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    sliding = false;
  });

  // Click / tap anywhere on the field jumps (and starts / restarts the game).
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    actions |= ACTION_JUMP | ACTION_CONFIRM;
  });

  // On-screen buttons, for mouse-only play.
  if (buttons && buttons.jump) {
    buttons.jump.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions |= ACTION_JUMP | ACTION_CONFIRM;
    });
  }
  if (buttons && buttons.slide) {
    buttons.slide.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      sliding = true;
      actions |= ACTION_SLIDE;
    });
    const release = () => {
      sliding = false;
    };
    buttons.slide.addEventListener('pointerup', release);
    buttons.slide.addEventListener('pointerleave', release);
    buttons.slide.addEventListener('pointercancel', release);
  }

  return {
    /** True while the slide key or button is held. */
    isSliding() {
      return sliding;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
