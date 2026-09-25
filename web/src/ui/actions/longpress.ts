import type { Action } from 'svelte/action';

const HOLD_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/**
 * Hold a finger (or right click on a computer) to open a menu, as on WhatsApp. Moving the finger
 * cancels it: the user was scrolling.
 */
export const longpress: Action<HTMLElement, (() => void) | undefined> = (node, handler) => {
  let current = handler;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | null = null;
  let fired = false;

  const cancel = () => {
    clearTimeout(timer);
    start = null;
  };
  const down = (event: PointerEvent) => {
    if (!current || event.button > 0) return;
    fired = false;
    start = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      fired = true;
      start = null;
      current?.();
    }, HOLD_MS);
  };
  const move = (event: PointerEvent) => {
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
  };
  const contextmenu = (event: MouseEvent) => {
    if (!current) return;
    event.preventDefault();
    if (!fired) current();
    cancel();
  };
  // The tap that ends a long press must not also press what is under the finger.
  const click = (event: MouseEvent) => {
    if (!fired) return;
    event.preventDefault();
    event.stopPropagation();
    fired = false;
  };

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('contextmenu', contextmenu);
  node.addEventListener('click', click, true);
  return {
    update(next) {
      current = next;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('contextmenu', contextmenu);
      node.removeEventListener('click', click, true);
    },
  };
};
