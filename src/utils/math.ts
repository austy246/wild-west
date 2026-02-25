/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation between a and b */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Random float between min (inclusive) and max (exclusive) */
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Random integer between min and max (both inclusive) */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
