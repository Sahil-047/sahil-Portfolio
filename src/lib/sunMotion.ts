/** Bridge carousel wheel → Three.js sun tumble */

type SunSpinHandler = (deltaY: number) => void;

let handler: SunSpinHandler | null = null;

export function registerSunSpin(next: SunSpinHandler) {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

/** Notify the active sun (Three.js) to tumble from card scroll */
export function spinSunFromScroll(deltaY: number) {
  if (!deltaY) return;
  handler?.(deltaY);
}
