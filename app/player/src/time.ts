export function formatScorm12(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe - hours * 3600 - minutes * 60;
  const hh = String(hours).padStart(4, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = seconds.toFixed(2).padStart(5, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatScorm2004(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `PT${hours}H${minutes}M${seconds}S`;
}
