/**
 * Mac trackpads use Ctrl-wheel in Chromium/Firefox and gesture events in Safari.
 * Ordinary scrolling and keyboard browser zoom stay native.
 * @param {EventTarget} target
 * @param {(direction: "in" | "out", x: number, y: number) => void} navigate
 */
export function listenForPinch(target, navigate) {
  let scale = 1;
  let handled = false;
  let safariGesture = false;
  let timer;

  const reset = () => { scale = 1; handled = false; };
  const update = (value, event) => {
    if (handled || !Number.isFinite(value) || value <= 0) return;
    if (value < 0.82 || value > 1.18) {
      handled = true;
      navigate(value < 1 ? "out" : "in", event.clientX, event.clientY);
    }
  };
  const wheel = (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (safariGesture) return;
    clearTimeout(timer);
    timer = setTimeout(reset, 180);
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
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
    target.addEventListener(type, listener, { passive: false });
  }
  return () => {
    clearTimeout(timer);
    for (const [type, listener] of Object.entries(listeners)) {
      target.removeEventListener(type, listener);
    }
  };
}
