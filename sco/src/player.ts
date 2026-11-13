import { mountQuiz, type QuizQuestion } from "./quiz";
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
import { mountYouTube, youtubeId, type YouTubeHandle } from "./youtube";

interface CourseItem {
  type?: "video" | "quiz";
  title?: string;
  url?: string;
  videoUrl?: string;
  href?: string;
  questions?: QuizQuestion[];
}

interface CourseLesson {
  title?: string;
  videoUrl?: string;
  href?: string;
  items?: CourseItem[];
}

interface CourseConfig {
  title: string;
  identifier: string;
  version: string;
  lessons?: CourseLesson[];
  videoUrl?: string;
  completionThreshold: number;
  masteryScore: number;
  poster: string | null;
}

declare global {
  interface Window {
    LESSON_INDEX?: number;
    ITEM_INDEX?: number;
  }
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

function resolveItem(config: CourseConfig): { title: string; item: CourseItem } {
  const lessons = Array.isArray(config.lessons) ? config.lessons : [];
  const lessonIndex = Number.isInteger(window.LESSON_INDEX) ? Number(window.LESSON_INDEX) : 0;
  const itemIndex = Number.isInteger(window.ITEM_INDEX) ? Number(window.ITEM_INDEX) : 0;
  const lesson = lessons[lessonIndex] || lessons[0];
  if (lesson && Array.isArray(lesson.items) && lesson.items.length) {
    const item = lesson.items[itemIndex] || lesson.items[0];
    return { title: item.title || lesson.title || config.title, item };
  }
  if (lesson && (lesson.videoUrl || lesson.title)) {
    return {
      title: lesson.title || config.title,
      item: { type: "video", title: lesson.title, url: lesson.videoUrl || "" },
    };
  }
  return {
    title: config.title,
    item: { type: "video", title: config.title, url: config.videoUrl || "" },
  };
}

function startWatch(options: {
  adapter: ScormAdapter | null;
  kind: "1.2" | "2004" | null;
  sessionStart: number;
  threshold: number;
  position: () => { current: number; duration: number };
  hold?: { message: string };
}): {
  note: (current: number, duration: number) => void;
  report: (finish: boolean) => void;
  bookmark: number;
  stop: () => void;
} {
  let bits = emptyBits();
  let stopped = false;
  let bookmark = 0;
  if (options.adapter) {
    const saved = decodeSuspend(options.adapter.getSuspendData());
    if (saved) bits = saved.bits;
    const stored = Number(options.adapter.getBookmark());
    if (Number.isFinite(stored) && stored > 0) bookmark = stored;
    options.adapter.commit();
  }
  let announced = watchedFraction(bits) + 1e-9 >= options.threshold;

  const report = (finish: boolean) => {
    if (options.hold?.message) {
      setStatus(options.hold.message);
      if (finish && options.adapter && !stopped) {
        stopped = true;
        options.adapter.setSessionTime((Date.now() - options.sessionStart) / 1000);
        options.adapter.terminate();
      }
      return;
    }
    const fraction = watchedFraction(bits);
    const reached = fraction + 1e-9 >= options.threshold;
    const percent = Math.round(fraction * 100);
    const { current } = options.position();
    if (!options.adapter) {
      setStatus(`SCORM API not found. Watched ${percent}%${reached ? ". Threshold reached." : "."}`);
      return;
    }
    if (current > 0.05) options.adapter.setBookmark(current.toFixed(2));
    const stored = Number(options.adapter.getBookmark());
    const suspendAt = current > 0 ? current : Number.isFinite(stored) ? stored : bookmark;
    options.adapter.setSuspendData(encodeSuspend(suspendAt, bits));
    options.adapter.setProgress(fraction);
    options.adapter.setScore(percent, 0, 100);
    options.adapter.setSessionTime((Date.now() - options.sessionStart) / 1000);
    options.adapter.setCompletion(reached);
    options.adapter.setSuccess(reached ? true : null);
    if (finish) {
      if (!stopped) {
        stopped = true;
        options.adapter.terminate();
      }
    } else {
      options.adapter.commit();
    }
    const apiName = options.kind === "2004" ? "SCORM 2004" : "SCORM 1.2";
    setStatus(reached ? `Completed. Reported to ${apiName}.` : `Watched ${percent}%. Reporting to ${apiName}.`);
  };

  const note = (current: number, duration: number) => {
    bits = markSegment(bits, current, duration);
    if (!announced && watchedFraction(bits) + 1e-9 >= options.threshold) {
      announced = true;
      report(false);
    }
  };

  const timer = window.setInterval(() => report(false), 15000);
  const onHide = () => {
    if (document.visibilityState === "hidden") report(false);
  };
  const onPageHide = () => {
    window.clearInterval(timer);
    report(true);
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);
  report(false);

  return {
    note,
    report,
    bookmark,
    stop() {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    },
  };
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
  const youtubeFrame = document.getElementById("youtube-frame");
  const quizRoot = document.getElementById("quiz");
  if (!(video instanceof HTMLVideoElement) || !youtubeFrame || !quizRoot) {
    setStatus("The lesson player is missing.");
    return;
  }

  const resolved = resolveItem(config);
  const heading = document.querySelector("h1");
  if (heading) heading.textContent = resolved.title;
  document.title = resolved.title;

  const prefer2004 = String(config.version || "").startsWith("2004");
  const connected = createAdapter(prefer2004);
  let adapter = connected?.adapter || null;
  if (adapter && !adapter.initialize()) adapter = null;
  const sessionStart = Date.now();
  const item = resolved.item;

  if (item.type === "quiz") {
    video.classList.add("off");
    quizRoot.classList.add("on");
    const questions = Array.isArray(item.questions) ? item.questions : [];
    if (!questions.length) {
      setStatus("This quiz has no questions.");
      return;
    }
    const finish = () => {
      if (!adapter) return;
      adapter.setSessionTime((Date.now() - sessionStart) / 1000);
      adapter.terminate();
    };
    window.addEventListener("pagehide", finish);
    mountQuiz(quizRoot, resolved.title, questions, (score) => {
      const mastery = Number(config.masteryScore);
      const passed = score >= mastery;
      if (!adapter) {
        setStatus(`SCORM API not found. Score ${score}.`);
        return;
      }
      adapter.setScore(score, 0, 100);
      adapter.setProgress(score / 100);
      adapter.setSuccess(passed);
      adapter.setCompletion(true);
      adapter.setSessionTime((Date.now() - sessionStart) / 1000);
      adapter.commit();
      const apiName = connected?.kind === "2004" ? "SCORM 2004" : "SCORM 1.2";
      setStatus(
        passed
          ? `Passed with ${score}. Reported to ${apiName}.`
          : `Score ${score}. Mastery is ${mastery}. Reported to ${apiName}.`
      );
    });
    return;
  }

  const url = item.url || item.videoUrl || "";
  if (!url) {
    setStatus("This lesson has no video URL.");
    return;
  }

  const threshold = Number(config.completionThreshold);
  let currentTime = 0;
  let duration = 0;
  const position = () => ({ current: currentTime, duration });

  const videoId = youtubeId(url);
  if (videoId) {
    video.classList.add("off");
    youtubeFrame.classList.add("on");
    const hold = { message: "" };
    const watch = startWatch({
      adapter,
      kind: connected?.kind || null,
      sessionStart,
      threshold,
      position,
      hold,
    });
    let handle: YouTubeHandle | null = null;
    try {
      handle = await mountYouTube({
        elementId: "youtube",
        videoId,
        resume: watch.bookmark,
        onTime: (current, length) => {
          currentTime = current;
          duration = length;
          watch.note(current, length);
        },
        onEnded: () => {
          currentTime = Math.max(0, duration - 0.01);
          watch.note(currentTime, duration);
          watch.report(false);
        },
        onError: (message) => {
          hold.message = message;
          setStatus(message);
        },
      });
    } catch {
      hold.message = "YouTube could not be loaded, so playback could not be tracked.";
      setStatus(hold.message);
    }
    window.addEventListener("pagehide", () => handle?.stop());
    return;
  }

  video.src = url;
  if (config.poster) video.poster = config.poster;
  const watch = startWatch({
    adapter,
    kind: connected?.kind || null,
    sessionStart,
    threshold,
    position,
  });
  const seek = () => {
    if (watch.bookmark > 0) {
      video.currentTime = Math.min(
        watch.bookmark,
        Number.isFinite(video.duration) ? video.duration : watch.bookmark
      );
    }
    video.removeEventListener("loadedmetadata", seek);
  };
  if (video.readyState >= 1) seek();
  else video.addEventListener("loadedmetadata", seek);

  video.addEventListener("timeupdate", () => {
    currentTime = video.currentTime;
    duration = video.duration;
    watch.note(currentTime, duration);
  });
  video.addEventListener("ended", () => {
    currentTime = Math.max(0, video.duration - 0.01);
    duration = video.duration;
    watch.note(currentTime, duration);
    watch.report(false);
  });
  video.addEventListener("error", () => {
    setStatus("The video could not be loaded. Check the URL and that the host allows playback.");
  });
}

void main();
