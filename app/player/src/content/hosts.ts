import { asRecord, clear, el, textOf } from "./dom";
import type { CourseItem, MountContext } from "./types";

function overlayItem(overlay: Record<string, unknown>): CourseItem {
  const body = asRecord(overlay.contentBody);
  const bodyCommon = asRecord(body.common);
  const bodySpecific = asRecord(body.specific);
  const flatCommon = asRecord(overlay.common);
  const flatSpecific = asRecord(overlay.specific);
  const common = Object.keys(flatCommon).length ? flatCommon : bodyCommon;
  const specific = Object.keys(flatSpecific).length ? flatSpecific : bodySpecific;
  return {
    type: "content",
    contentType: textOf(overlay.contentType, common.contentType as string),
    title: textOf(common.contentName as string, "Overlay"),
    common: common as CourseItem["common"],
    specific,
  };
}

async function mountChild(ctx: MountContext): Promise<void> {
  const { mountContentBody } = await import("./router");
  await mountContentBody(ctx);
}

export async function mountInteractiveContent(ctx: MountContext): Promise<void> {
  const specific = asRecord(ctx.item.specific);
  const list = Array.isArray(specific.contentList) ? specific.contentList.map(asRecord) : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "panel" });
  panel.append(el("h2", {}, textOf(ctx.item.title, "Interactive content")));
  const host = el("div");
  panel.append(host);
  ctx.root.append(panel);

  let index = 0;

  async function showNext(): Promise<void> {
    if (index >= list.length) {
      ctx.reportComplete(true);
      ctx.setStatus(`Completed. Reported to ${ctx.apiName}.`);
      return;
    }
    const overlay = list[index];
    const item = overlayItem(overlay);
    const nested: MountContext = {
      ...ctx,
      root: host,
      item,
      autoAdvance: false,
      reportComplete: (complete) => {
        if (complete) {
          index += 1;
          void showNext();
        }
      },
      reportScore: (score, passed, complete, interactions) => {
        if (ctx.adapter) {
          ctx.adapter.setScore(score, 0, 100);
          if (interactions?.length) ctx.adapter.setInteractions(interactions);
          ctx.adapter.setSuccess(passed);
          ctx.adapter.commit();
        }
        ctx.setStatus(passed ? `Passed with ${score}.` : `Score ${score}.`);
        if (complete || overlay.canSkip) {
          index += 1;
          void showNext();
        }
      },
    };
    ctx.setStatus(`Overlay ${index + 1} of ${list.length}`);
    await mountChild(nested);
  }

  if (!list.length) {
    ctx.reportComplete(true);
    ctx.setStatus("No overlays were provided.");
    return;
  }
  await showNext();
}

export async function mountInteractiveVideo(ctx: MountContext): Promise<void> {
  const specific = asRecord(ctx.item.specific);
  const cards = Array.isArray(specific.interactiveVideoByLanguage)
    ? specific.interactiveVideoByLanguage.map(asRecord)
    : [];
  const primary = cards.find((card) => card.default) || cards[0] || {};
  const url = textOf(primary.processVideoUrl as string, primary.videoUrl as string, ctx.item.url);
  const list = Array.isArray(primary.contentList) ? primary.contentList.map(asRecord) : [];

  clear(ctx.root);
  ctx.video.classList.remove("off");
  if (!url) {
    ctx.setStatus("This interactive video has no URL.");
    return;
  }

  const { youtubeId, mountYouTube } = await import("../youtube");
  const videoId = youtubeId(url);
  const shown = new Set<number>();

  const openOverlay = async (overlayIndex: number) => {
    if (shown.has(overlayIndex)) return;
    shown.add(overlayIndex);
    const overlay = list[overlayIndex];
    ctx.video.pause();
    const item = overlayItem(overlay);
    ctx.quizRoot.classList.add("on", "overlay");
    clear(ctx.quizRoot);
    const nested: MountContext = {
      ...ctx,
      root: ctx.quizRoot,
      item,
      autoAdvance: false,
      reportComplete: () => {
        ctx.quizRoot.classList.remove("on", "overlay");
        clear(ctx.quizRoot);
        void ctx.video.play();
      },
      reportScore: (score, passed, complete, interactions) => {
        if (ctx.adapter) {
          ctx.adapter.setScore(score, 0, 100);
          if (interactions?.length) ctx.adapter.setInteractions(interactions);
          ctx.adapter.setSuccess(passed);
          ctx.adapter.commit();
        }
        ctx.setStatus(passed ? `Passed with ${score}.` : `Score ${score}.`);
        ctx.quizRoot.classList.remove("on", "overlay");
        clear(ctx.quizRoot);
        void ctx.video.play();
      },
    };
    await mountChild(nested);
  };

  const onTime = (time: number) => {
    list.forEach((overlay, index) => {
      const at = typeof overlay.at === "number" ? overlay.at : Number(overlay.time);
      if (!Number.isFinite(at)) return;
      if (Math.abs(time - at) < 0.75) void openOverlay(index);
    });
  };

  if (videoId) {
    ctx.video.classList.add("off");
    ctx.youtubeFrame.classList.add("on");
    try {
      await mountYouTube({
        elementId: "youtube",
        videoId,
        resume: 0,
        onTime: (time) => onTime(time),
        onEnded: () => ctx.reportComplete(true),
        onPlay: () => undefined,
        onError: (message) => ctx.setStatus(message),
      });
    } catch {
      ctx.setStatus("YouTube could not be loaded.");
    }
    return;
  }

  ctx.video.src = url;
  if (ctx.poster) ctx.video.poster = ctx.poster;
  ctx.video.addEventListener("timeupdate", () => onTime(ctx.video.currentTime));
  ctx.video.addEventListener("ended", () => {
    ctx.reportComplete(true);
  });
  ctx.setStatus("Watch the video. Overlays appear at their times.");
}
