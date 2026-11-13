import { findApi, type ScormAdapter } from "./runtime";
import { Scorm12Adapter } from "./scorm12";
import { Scorm2004Adapter } from "./scorm2004";
import {
  decodeSuspend,
  emptyBits,
  encodeSuspend,
  markSegment,
  watchedFraction,
} from "./suspend";

interface CourseConfig {
  title: string;
  identifier: string;
  version: string;
  videoUrl: string;
  completionThreshold: number;
  masteryScore: number;
  poster: string | null;
}

function createAdapter(prefer2004: boolean): { adapter: ScormAdapter; kind: "1.2" | "2004" } | null {
  const found = findApi(window, prefer2004);
  if (!found) return null;
  if (found.kind === "2004") {
    return { adapter: new Scorm2004Adapter(found.api), kind: "2004" };
  }
  return { adapter: new Scorm12Adapter(found.api), kind: "1.2" };
}

function setStatus(text: string): void {
  const node = document.getElementById("status");
  if (node) node.textContent = text;
}

async function main(): Promise<void> {
  let config: CourseConfig;
  try {
    const response = await fetch("config.json");
    if (!response.ok) throw new Error(String(response.status));
    config = (await response.json()) as CourseConfig;
  } catch {
    setStatus("Could not read config.json.");
    return;
  }

  const video = document.getElementById("lesson");
  if (!(video instanceof HTMLVideoElement)) {
    setStatus("The lesson player is missing.");
    return;
  }

  if (config.title) {
    const heading = document.querySelector("h1");
    if (heading) heading.textContent = config.title;
    document.title = config.title;
  }
  video.src = config.videoUrl;
  if (config.poster) video.poster = config.poster;

  const prefer2004 = String(config.version || "").startsWith("2004");
  const connected = createAdapter(prefer2004);
  let adapter = connected?.adapter || null;
  const sessionStart = Date.now();
  let bits = emptyBits();
  let stopped = false;

  if (adapter && !adapter.initialize()) adapter = null;

  if (adapter) {
    const saved = decodeSuspend(adapter.getSuspendData());
    if (saved) bits = saved.bits;
    const bookmark = Number(adapter.getBookmark());
    if (Number.isFinite(bookmark) && bookmark > 0) {
      const seek = () => {
        video.currentTime = Math.min(bookmark, Number.isFinite(video.duration) ? video.duration : bookmark);
        video.removeEventListener("loadedmetadata", seek);
      };
      if (video.readyState >= 1) seek();
      else video.addEventListener("loadedmetadata", seek);
    }
    adapter.commit();
  }

  const threshold = Number(config.completionThreshold);
  let announced = watchedFraction(bits) + 1e-9 >= threshold;

  const report = (finish: boolean) => {
    const fraction = watchedFraction(bits);
    const reached = fraction + 1e-9 >= threshold;
    const percent = Math.round(fraction * 100);
    if (!adapter) {
      setStatus(
        `SCORM API not found. Watched ${percent}%${reached ? ". Threshold reached." : "."}`
      );
      return;
    }
    const position = video.currentTime;
    if (position > 0.05) adapter.setBookmark(position.toFixed(2));
    const stored = Number(adapter.getBookmark());
    const suspendAt = position > 0 ? position : Number.isFinite(stored) ? stored : 0;
    adapter.setSuspendData(encodeSuspend(suspendAt, bits));
    adapter.setProgress(fraction);
    adapter.setScore(percent, 0, 100);
    adapter.setSessionTime((Date.now() - sessionStart) / 1000);
    adapter.setCompletion(reached);
    adapter.setSuccess(reached ? true : null);
    if (finish) {
      if (!stopped) {
        stopped = true;
        adapter.terminate();
      }
    } else {
      adapter.commit();
    }
    const apiName = connected?.kind === "2004" ? "SCORM 2004" : "SCORM 1.2";
    setStatus(
      reached
        ? `Completed. Reported to ${apiName}.`
        : `Watched ${percent}%. Reporting to ${apiName}.`
    );
  };

  const mark = () => {
    bits = markSegment(bits, video.currentTime, video.duration);
  };

  video.addEventListener("timeupdate", () => {
    mark();
    if (!announced && watchedFraction(bits) + 1e-9 >= threshold) {
      announced = true;
      report(false);
    }
  });
  video.addEventListener("ended", () => {
    bits = markSegment(bits, Math.max(0, video.duration - 0.01), video.duration);
    report(false);
  });
  video.addEventListener("error", () => {
    setStatus("The video could not be loaded. Check the URL and that the host allows playback.");
  });

  const timer = window.setInterval(() => report(false), 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") report(false);
  });
  window.addEventListener("pagehide", () => {
    window.clearInterval(timer);
    report(true);
  });

  report(false);
}

void main();
