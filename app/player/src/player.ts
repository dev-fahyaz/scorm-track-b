import {
  createCheckpointSession,
  marksForAnswers,
  mountQuiz,
  readQuestions,
  reviewFromMarks,
  type CheckpointSession,
} from "./quiz";
import { findApi, type InteractionRecord, type ScormAdapter } from "./runtime";
import { Scorm12Adapter } from "./scorm12";
import { Scorm2004Adapter } from "./scorm2004";
import {
  decodeSuspend,
  emptyBits,
  encodeMarks,
  encodeSuspend,
  markSegment,
  watchedFraction,
} from "./suspend";
import { mountDeck, type DeckSlide } from "./deck";
import { mountYouTube, youtubeId, type YouTubeHandle } from "./youtube";
import { isContentItem, mountContentBody } from "./content/router";
import type { CourseItem, MountContext } from "./content/types";

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
  requireQuizPass?: boolean;
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
  quiz?: {
    active: boolean;
    requirePass: boolean;
    mastery: number;
    marks: () => string;
    outcome: () => { score: number | null; passed: boolean | null };
    interactions: () => InteractionRecord[];
  };
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
    const quiz = options.quiz?.active ? options.quiz : null;
    const result = quiz ? quiz.outcome() : { score: null, passed: null };
    const apiName = options.kind === "2004" ? "SCORM 2004" : "SCORM 1.2";
    if (!options.adapter) {
      if (quiz && result.score != null) {
        setStatus(`SCORM API not found. Score ${result.score}.`);
      } else {
        setStatus(`SCORM API not found. Watched ${percent}%${reached ? ". Threshold reached." : "."}`);
      }
      return;
    }
    if (current > 0.05) options.adapter.setBookmark(current.toFixed(2));
    const stored = Number(options.adapter.getBookmark());
    const suspendAt = current > 0 ? current : Number.isFinite(stored) ? stored : bookmark;
    options.adapter.setSuspendData(encodeSuspend(suspendAt, bits, quiz ? quiz.marks() : ""));
    options.adapter.setProgress(fraction);
    options.adapter.setSessionTime((Date.now() - options.sessionStart) / 1000);
    if (quiz) {
      if (result.score != null) options.adapter.setScore(result.score, 0, 100);
      const records = quiz.interactions();
      if (records.length) options.adapter.setInteractions(records);
      const complete = quiz.requirePass ? Boolean(reached && result.passed) : reached;
      options.adapter.setCompletion(complete);
      options.adapter.setSuccess(result.passed);
    } else {
      options.adapter.setScore(percent, 0, 100);
      options.adapter.setCompletion(reached);
      options.adapter.setSuccess(reached ? true : null);
    }
    if (finish) {
      if (!stopped) {
        stopped = true;
        options.adapter.terminate();
      }
    } else {
      options.adapter.commit();
    }
    if (quiz && result.passed === false && quiz.requirePass) {
      setStatus(`Score ${result.score}. Mastery is ${quiz.mastery}. The item stays incomplete.`);
    } else if (quiz && result.score != null && result.passed && reached) {
      setStatus(`Passed with ${result.score}. Reported to ${apiName}.`);
    } else if (quiz && result.score != null && !quiz.requirePass && reached) {
      setStatus(`Score ${result.score}. Reported to ${apiName}.`);
    } else if (quiz && reached && quiz.requirePass) {
      setStatus(`Watched ${percent}%. Answer the questions to complete.`);
    } else if (quiz && reached) {
      setStatus(`Completed. Reported to ${apiName}.`);
    } else if (quiz) {
      setStatus(`Watched ${percent}%. Reporting to ${apiName}.`);
    } else {
      setStatus(reached ? `Completed. Reported to ${apiName}.` : `Watched ${percent}%. Reporting to ${apiName}.`);
    }
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

function makeContentContext(options: {
  root: HTMLElement;
  quizRoot: HTMLElement;
  video: HTMLVideoElement;
  youtubeFrame: HTMLElement;
  item: CourseItem;
  adapter: ScormAdapter | null;
  mastery: number;
  requirePass: boolean;
  threshold: number;
  sessionStart: number;
  apiName: string;
  poster: string | null;
}): MountContext {
  const finish = () => {
    if (!options.adapter) return;
    options.adapter.setSessionTime((Date.now() - options.sessionStart) / 1000);
    options.adapter.terminate();
  };
  window.addEventListener("pagehide", finish);

  const ctx: MountContext = {
    root: options.root,
    quizRoot: options.quizRoot,
    video: options.video,
    youtubeFrame: options.youtubeFrame,
    item: options.item,
    adapter: options.adapter,
    mastery: options.mastery,
    requirePass: options.requirePass,
    threshold: options.threshold,
    sessionStart: options.sessionStart,
    apiName: options.apiName,
    poster: options.poster,
    autoAdvance: true,
    setStatus,
    reportScore(score, passed, complete, interactions) {
      if (complete) disableContentButtons(options.root);
      if (options.adapter) {
        options.adapter.setScore(score, 0, 100);
        options.adapter.setProgress(score / 100);
        if (interactions?.length) options.adapter.setInteractions(interactions);
        options.adapter.setSuccess(passed);
        options.adapter.setCompletion(complete);
        options.adapter.setSessionTime((Date.now() - options.sessionStart) / 1000);
        options.adapter.commit();
        if (complete && ctx.autoAdvance !== false) {
          options.adapter.requestContinue();
          options.adapter.terminate();
          setStatus(`Score ${score}. Moving to the next item…`);
          scheduleAdvanceFallback(setStatus, `Score ${score}. Use the LMS Next control if the course did not advance.`);
          return;
        }
      }
      if (passed) setStatus(`Passed with ${score}. Reported to ${options.apiName}.`);
      else if (complete) setStatus(`Score ${score}. Reported to ${options.apiName}.`);
      else setStatus(`Score ${score}. Mastery is ${options.mastery}. The item stays incomplete.`);
    },
    reportComplete(complete) {
      if (complete) disableContentButtons(options.root);
      if (options.adapter) {
        options.adapter.setProgress(complete ? 1 : 0);
        options.adapter.setCompletion(complete);
        options.adapter.setSuccess(complete ? true : null);
        options.adapter.setSessionTime((Date.now() - options.sessionStart) / 1000);
        options.adapter.commit();
        if (complete && ctx.autoAdvance !== false) {
          options.adapter.requestContinue();
          options.adapter.terminate();
          setStatus("Completed. Moving to the next item…");
          scheduleAdvanceFallback(
            setStatus,
            "Completed. Use the LMS Next control if the course did not advance."
          );
          return;
        }
      }
      if (complete) {
        setStatus(`Completed. Reported to ${options.apiName}.`);
      }
    },
  };
  return ctx;
}

function disableContentButtons(root: HTMLElement): void {
  root.querySelectorAll("button").forEach((node) => {
    (node as HTMLButtonElement).disabled = true;
  });
}

function scheduleAdvanceFallback(setStatus: (message: string) => void, message: string): void {
  window.setTimeout(() => {
    if (document.visibilityState === "visible") setStatus(message);
  }, 800);
}

function videoUrlOf(item: CourseItem): string {
  if (item.url || item.videoUrl) return String(item.url || item.videoUrl || "").trim();
  const specific = item.specific || {};
  const interactive = (specific.interactiveVideo || {}) as Record<string, unknown>;
  return String(interactive.processVideoUrl || interactive.videoUrl || "").trim();
}

async function playVideoItem(options: {
  item: CourseItem;
  config: CourseConfig;
  video: HTMLVideoElement;
  youtubeFrame: HTMLElement;
  quizRoot: HTMLElement;
  adapter: ScormAdapter | null;
  kind: "1.2" | "2004" | null;
  sessionStart: number;
  mastery: number;
  requirePass: boolean;
}): Promise<void> {
  const url = videoUrlOf(options.item);
  if (!url) {
    setStatus("This lesson has no video URL.");
    return;
  }

  const threshold = Number(options.config.completionThreshold);
  const questions = readQuestions(options.item.questions, true);
  let currentTime = 0;
  let duration = 0;
  const position = () => ({ current: currentTime, duration });
  const savedMarks = options.adapter ? decodeSuspend(options.adapter.getSuspendData())?.marks || "" : "";
  let reportWatch: (finish: boolean) => void = () => {};
  let handle: YouTubeHandle | null = null;
  const media = {
    pause() {
      if (handle) handle.pause();
      else options.video.pause();
    },
    play() {
      if (handle) handle.play();
      else void options.video.play();
    },
    seek(seconds: number) {
      if (handle) handle.seek(seconds);
      else options.video.currentTime = seconds;
    },
  };
  const checkpoints: CheckpointSession | null = questions.length
    ? createCheckpointSession({
      questions,
      savedMarks,
      root: options.quizRoot,
      mastery: options.mastery,
      requirePass: options.requirePass,
      media,
      onChange() {
        reportWatch(false);
      },
    })
    : null;
  const quiz = checkpoints
    ? {
      active: true,
      requirePass: options.requirePass,
      mastery: options.mastery,
      marks: () => checkpoints.marks(),
      outcome: () => checkpoints.outcome(),
      interactions: () => checkpoints.interactions(),
    }
    : undefined;
  checkpoints?.resume();

  const videoId = youtubeId(url);
  if (videoId) {
    options.video.classList.add("off");
    options.youtubeFrame.classList.add("on");
    const hold = { message: "" };
    const watch = startWatch({
      adapter: options.adapter,
      kind: options.kind,
      sessionStart: options.sessionStart,
      threshold,
      position,
      hold,
      quiz,
    });
    reportWatch = watch.report;
    try {
      handle = await mountYouTube({
        elementId: "youtube",
        videoId,
        resume: watch.bookmark,
        onTime: (current, length) => {
          currentTime = current;
          duration = length;
          watch.note(current, length);
          checkpoints?.onTime(current, length);
        },
        onEnded: () => {
          currentTime = Math.max(0, duration - 0.01);
          watch.note(currentTime, duration);
          checkpoints?.onEnded();
          watch.report(false);
        },
        onPlay: () => {
          if (checkpoints?.isLocked()) handle?.pause();
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

  options.video.src = url;
  if (options.config.poster) options.video.poster = options.config.poster;
  const watch = startWatch({
    adapter: options.adapter,
    kind: options.kind,
    sessionStart: options.sessionStart,
    threshold,
    position,
    quiz,
  });
  reportWatch = watch.report;
  const seek = () => {
    if (watch.bookmark > 0) {
      options.video.currentTime = Math.min(
        watch.bookmark,
        Number.isFinite(options.video.duration) ? options.video.duration : watch.bookmark
      );
    }
    options.video.removeEventListener("loadedmetadata", seek);
  };
  if (options.video.readyState >= 1) seek();
  else options.video.addEventListener("loadedmetadata", seek);

  options.video.addEventListener("play", () => {
    if (checkpoints?.isLocked()) options.video.pause();
  });
  options.video.addEventListener("seeking", () => {
    checkpoints?.onTime(options.video.currentTime, options.video.duration || 0);
  });
  options.video.addEventListener("timeupdate", () => {
    currentTime = options.video.currentTime;
    duration = options.video.duration;
    watch.note(currentTime, duration);
    checkpoints?.onTime(currentTime, duration);
  });
  options.video.addEventListener("ended", () => {
    currentTime = Math.max(0, options.video.duration - 0.01);
    duration = options.video.duration;
    watch.note(currentTime, duration);
    checkpoints?.onEnded();
    watch.report(false);
  });
  options.video.addEventListener("error", () => {
    setStatus("The video could not be loaded. Check the URL and that the host allows playback.");
  });
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
  const deckRoot = document.getElementById("deck");
  const contentRoot = document.getElementById("content");
  if (!(video instanceof HTMLVideoElement) || !youtubeFrame || !quizRoot || !deckRoot || !contentRoot) {
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

  const mastery = Number(config.masteryScore);
  const requirePass = config.requireQuizPass !== false;
  const apiName = connected?.kind === "2004" ? "SCORM 2004" : "SCORM 1.2";

  const contentType = item.contentType || item.common?.contentType || "";
  if (
    isContentItem(item) ||
    (contentType === "QUIZ" && !item.legacyQuiz && item.type !== "quiz") ||
    (item.type === "content")
  ) {
    video.classList.add("off");
    if (contentType === "VIDEO" || contentType === "ANIMATION") {
      video.classList.remove("off");
      await playVideoItem({
        item: { ...item, url: item.url || "" },
        config,
        video,
        youtubeFrame,
        quizRoot,
        adapter,
        kind: connected?.kind || null,
        sessionStart,
        mastery,
        requirePass,
      });
      return;
    }
    const ctx = makeContentContext({
      root: contentRoot,
      quizRoot,
      video,
      youtubeFrame,
      item,
      adapter,
      mastery,
      requirePass,
      threshold: Number(config.completionThreshold),
      sessionStart,
      apiName,
      poster: config.poster,
    });
    await mountContentBody(ctx);
    return;
  }

  if (item.type === "quiz") {
    video.classList.add("off");
    quizRoot.classList.add("on");
    const questions = readQuestions(item.questions, false);
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
    const savedMarks = adapter ? decodeSuspend(adapter.getSuspendData())?.marks || "" : "";
    const describe = (score: number, passed: boolean, complete: boolean) => {
      if (!adapter) return `SCORM API not found. Score ${score}.`;
      if (passed) return `Passed with ${score}. Reported to ${apiName}.`;
      if (complete) return `Score ${score}. Mastery is ${mastery}. Reported to ${apiName}.`;
      return `Score ${score}. Mastery is ${mastery}. The item stays incomplete.`;
    };
    const clearSaved = () => {
      if (!adapter) return;
      const blank = questions.map(() => ({ state: "." as const, response: "" }));
      adapter.setSuspendData(encodeSuspend(0, emptyBits(), encodeMarks(blank)));
      adapter.commit();
    };
    const offerRetry = () => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Retry quiz";
      button.addEventListener("click", () => {
        clearSaved();
        present(null);
      });
      quizRoot.append(button);
    };
    const present = (review: ReturnType<typeof reviewFromMarks>) => {
      mountQuiz(quizRoot, questions, (result) => {
        const passed = result.score >= mastery;
        const complete = !requirePass || passed;
        if (adapter) {
          adapter.setSuspendData(encodeSuspend(0, emptyBits(), encodeMarks(marksForAnswers(questions, result.answers))));
          adapter.setScore(result.score, 0, 100);
          adapter.setProgress(result.score / 100);
          adapter.setInteractions(result.interactions);
          adapter.setSuccess(passed);
          adapter.setCompletion(complete);
          adapter.setSessionTime((Date.now() - sessionStart) / 1000);
          adapter.commit();
        }
        setStatus(describe(result.score, passed, complete));
        if (!complete) offerRetry();
      }, review ? {
        initial: review.answers,
        locked: true,
        note: `Score ${review.score}. ${review.correct} of ${questions.length} correct.`,
      } : undefined);
      if (!review) return;
      const passed = review.score >= mastery;
      const complete = !requirePass || passed;
      if (adapter) {
        adapter.setScore(review.score, 0, 100);
        adapter.setProgress(review.score / 100);
        adapter.setSuccess(passed);
        adapter.setCompletion(complete);
        adapter.setSessionTime((Date.now() - sessionStart) / 1000);
        adapter.commit();
      }
      setStatus(describe(review.score, passed, complete));
      if (!complete) offerRetry();
    };
    const review = reviewFromMarks(questions, savedMarks);
    if (!review) {
      setStatus(adapter ? "Answer the questions." : "SCORM API not found. Answer the questions.");
    }
    present(review);
    return;
  }

  if (item.type === "deck") {
    video.classList.add("off");
    const slides = Array.isArray(item.slides) ? (item.slides as DeckSlide[]) : [];
    if (!slides.length) {
      setStatus("This deck has no slides.");
      return;
    }
    const place = { current: 0 };
    const watch = startWatch({
      adapter,
      kind: connected?.kind || null,
      sessionStart,
      threshold: Number(config.completionThreshold),
      position: () => ({ current: place.current, duration: 100 }),
    });
    mountDeck({
      root: deckRoot,
      slides,
      video,
      youtubeFrame,
      watch,
      place,
    });
    return;
  }

  await playVideoItem({
    item,
    config,
    video,
    youtubeFrame,
    quizRoot,
    adapter,
    kind: connected?.kind || null,
    sessionStart,
    mastery,
    requirePass,
  });
}

void main();
