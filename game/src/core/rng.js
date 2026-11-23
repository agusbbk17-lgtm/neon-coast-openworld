export function hashSeed(value = 'solmar') {
  let hash = 2166136261;
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export class Random {
  constructor(seed) { this.state = hashSeed(seed); this.seed = String(seed); }
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let word = this.state; word = Math.imul(word ^ (word >>> 15), word | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return ((word ^ (word >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + this.next() * (max - min); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(values) { return values[Math.floor(this.next() * values.length)]; }
  fork(label) { return new Random(this.seed + ':' + label); }
}
