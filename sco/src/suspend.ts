export const SEGMENTS = 100;

export function emptyBits(): string {
  return "0".repeat(SEGMENTS);
}

export function markSegment(bits: string, current: number, duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return bits;
  const index = Math.min(SEGMENTS - 1, Math.max(0, Math.floor((current / duration) * SEGMENTS)));
  if (bits.charAt(index) === "1") return bits;
  return `${bits.slice(0, index)}1${bits.slice(index + 1)}`;
}

export function watchedFraction(bits: string): number {
  let watched = 0;
  for (let i = 0; i < bits.length; i += 1) {
    if (bits.charAt(i) === "1") watched += 1;
  }
  return watched / SEGMENTS;
}

export function encodeSuspend(positionSeconds: number, bits: string): string {
  const ms = Math.max(0, Math.round(positionSeconds * 1000));
  return `v1|${ms}|${bits}`;
}

export function decodeSuspend(value: string): { bits: string } | null {
  const parts = value.split("|");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  if (!/^[01]+$/.test(parts[2]) || parts[2].length !== SEGMENTS) return null;
  return { bits: parts[2] };
}
