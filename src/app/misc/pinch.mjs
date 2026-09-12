/**
 * Mac trackpads use Ctrl-wheel in Chromium/Firefox and gesture events in Safari.
 * Ordinary scrolling and keyboard browser zoom stay native.
 * @param {EventTarget} target
 * @param {(direction: "in" | "out", x: number, y: number) => boolean | void} navigate
 */
export function listenForPinch(target, navigate) {
  let scale = 1;
  let handled = false;
  let safariGesture = false;
  let wheelDirection = 0;
  let timer;

  const reset = () => { scale = 1; handled = false; wheelDirection = 0; };
  const update = (value, event) => {
    if (handled || !Number.isFinite(value) || value <= 0) return;
    if (value < 0.82 || value > 1.06) {
      handled = navigate(value < 1 ? "out" : "in", event.clientX, event.clientY) !== false;
    }
  };
  const wheel = (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (safariGesture) return;
    clearTimeout(timer);
    timer = setTimeout(reset, 180);
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
    if (!Number.isFinite(pixels) || pixels === 0) return;
    const direction = Math.sign(pixels);
    // A quick reverse pinch is a new intent, even before the wheel idle timeout.
    if (wheelDirection && direction !== wheelDirection) reset();
    wheelDirection = direction;
    scale *= Math.exp(-pixels / 200);
    update(scale, event);
  };
  const start = (event) => {
    event.preventDefault();
    clearTimeout(timer);
    reset();
    safariGesture = true;
  };
  const change = (event) => {
    event.preventDefault();
    update(event.scale, event);
  };
  const end = (event) => {
    event.preventDefault();
    safariGesture = false;
    reset();
  };

  const listeners = { wheel, gesturestart: start, gesturechange: change, gestureend: end };
  for (const [type, listener] of Object.entries(listeners)) {
    target.addEventListener(type, listener, { passive: false, capture: true });
  }
  return () => {
    clearTimeout(timer);
    for (const [type, listener] of Object.entries(listeners)) {
      target.removeEventListener(type, listener, { capture: true });
    }
  };
}
