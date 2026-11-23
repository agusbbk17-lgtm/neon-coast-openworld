export const TAU = Math.PI * 2;
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damping = (rate, dt) => 1 - Math.exp(-rate * Math.max(0, dt));
export const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const dampAngle = (a, b, rate, dt) => a + angleDelta(a, b) * damping(rate, dt);
export const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const forward = yaw => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
export const heading = (x, z) => Math.atan2(-x, -z);
export function interpolateTransform(previous, current, alpha) {
  return { x: lerp(previous.x, current.x, alpha), y: lerp(previous.y, current.y, alpha),
    z: lerp(previous.z, current.z, alpha), yaw: previous.yaw + angleDelta(previous.yaw, current.yaw) * alpha };
}
