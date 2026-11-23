export function raySphere(origin, direction, center, radius, range) {
  const x = origin.x - center.x, y = origin.y - center.y, z = origin.z - center.z;
  const b = x * direction.x + y * direction.y + z * direction.z, c = x * x + y * y + z * z - radius * radius;
  const discriminant = b * b - c; if (discriminant < 0) return null;
  const first = -b - Math.sqrt(discriminant), second = -b + Math.sqrt(discriminant);
  const t = first >= 0 ? first : second; return t >= 0 && t <= range ? t : null;
}
export function rayVehicle(origin, direction, vehicle, range) {
  const cos = Math.cos(vehicle.yaw), sin = Math.sin(vehicle.yaw), dx = origin.x - vehicle.x, dz = origin.z - vehicle.z;
  const start = [dx * cos - dz * sin, origin.y - vehicle.y, -dx * sin - dz * cos];
  const dir = [direction.x * cos - direction.z * sin, direction.y, -direction.x * sin - direction.z * cos];
  const min = [-vehicle.config.width / 2, 0.15, -vehicle.config.length / 2], max = [vehicle.config.width / 2, vehicle.config.height, vehicle.config.length / 2];
  let low = 0, high = range;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-8) { if (start[i] < min[i] || start[i] > max[i]) return null; continue; }
    let a = (min[i] - start[i]) / dir[i], b = (max[i] - start[i]) / dir[i]; if (a > b) [a, b] = [b, a];
    low = Math.max(low, a); high = Math.min(high, b); if (low > high) return null;
  }
  return low;
}
