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

export interface StoredMark {
  state: "." | "0" | "1";
  response: string;
}

export function encodeMarks(marks: StoredMark[]): string {
  return marks
    .map((mark) => (mark.state === "." ? "." : `${mark.state}:${encodeURIComponent(mark.response)}`))
    .join(";");
}

export function decodeMarks(value: string, count: number): StoredMark[] {
  const blank = (): StoredMark => ({ state: ".", response: "" });
  const tokens = value ? value.split(";") : [];
  if (tokens.length !== count) return Array.from({ length: count }, blank);
  return tokens.map((token) => {
    if (token === "." || (token[0] !== "0" && token[0] !== "1") || token[1] !== ":") return blank();
    try {
      return { state: token[0], response: decodeURIComponent(token.slice(2)) };
    } catch {
      return blank();
    }
  });
}

export function encodeSuspend(positionSeconds: number, bits: string, marks = ""): string {
  const ms = Math.max(0, Math.round(positionSeconds * 1000));
  if (!marks) return `v1|${ms}|${bits}`;
  return `v2|${ms}|${bits}|${encodeURIComponent(marks)}`;
}

export function decodeSuspend(value: string): { bits: string; marks: string } | null {
  const parts = value.split("|");
  const bitsOk = /^[01]+$/.test(parts[2] || "") && parts[2].length === SEGMENTS;
  if (!bitsOk) return null;
  if (parts.length === 3 && parts[0] === "v1") return { bits: parts[2], marks: "" };
  if (parts.length === 4 && parts[0] === "v2") {
    try {
      return { bits: parts[2], marks: decodeURIComponent(parts[3]) };
    } catch {
      return { bits: parts[2], marks: "" };
    }
  }
  return null;
}
