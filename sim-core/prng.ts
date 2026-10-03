/** Mulberry32, with explicit 32-bit state. No clock, global random, or I/O. */
export class Random {
  constructor(private state: number) { this.state >>>= 0; }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let n = this.state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  pick<T>(items: readonly T[]): T { return items[this.int(0, items.length - 1)]; }
  between(min: number, max: number): number { return min + this.next() * (max - min); }
}
export function hashText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
/** Independent keyed random streams keep rendering and unrelated actors isolated. */
export function sample(seed: number, ...keys: (number | string)[]): number {
  return new Random(parseInt(hashText([seed, ...keys].join(':')), 16)).next();
}
export const clamp = (n: number, min = 0, max = 1): number => Math.max(min, Math.min(max, n));
export const quantize = (n: number): number => Math.round(n * 100) / 100;
