import { asRecord } from "./dom";
import type { MountContext } from "./types";
import { mountText, mountLink, mountPdf, mountMarkdown } from "./reading";
import { mountQuestionBlock } from "./questionBlock";
import { mountTabs, mountSliderShow } from "./tabsSlides";
import {
  mountMatching,
  mountOrdering,
  mountLiker,
  mountPicture,
  mountScenario,
} from "./quizAdvanced";
import { mountHotSpot } from "./hotSpot";
import { mountStoryBlock, mountSliderLevel } from "./story";
import {
  mountPasswordCompliance,
  mountRansomwareSimulator,
  mountPhishingDetection,
} from "./modules";
import { mountInteractiveContent, mountInteractiveVideo } from "./hosts";

export async function mountContentBody(ctx: MountContext): Promise<void> {
  const contentType = String(
    ctx.item.contentType || ctx.item.common?.contentType || ""
  ).toUpperCase();
  const specific = asRecord(ctx.item.specific);
  const quizType = String(specific.quizType || "");

  switch (contentType) {
    case "TEXT":
      mountText(ctx);
      return;
    case "LINK":
      mountLink(ctx);
      return;
    case "PDF":
      mountPdf(ctx);
      return;
    case "MARKDOWN":
      mountMarkdown(ctx);
      return;
    case "QUESTION":
      mountQuestionBlock(ctx);
      return;
    case "TAB":
      mountTabs(ctx);
      return;
    case "SLIDE":
      mountSliderShow(ctx);
      return;
    case "STORY_BLOCK":
      mountStoryBlock(ctx);
      return;
    case "SLIDER_LEVEL":
      mountSliderLevel(ctx);
      return;
    case "INTERACTIVE_CONTENT":
      await mountInteractiveContent(ctx);
      return;
    case "INTERACTIVE_VIDEO":
      await mountInteractiveVideo(ctx);
      return;
    case "QUIZ":
      if (quizType === "matching") return void mountMatching(ctx);
      if (quizType === "ordering") return void mountOrdering(ctx);
      if (quizType === "liker") return void mountLiker(ctx);
      if (quizType === "picture") return void mountPicture(ctx);
      if (quizType === "scenario") return void mountScenario(ctx);
      if (quizType === "hot_spot") return void mountHotSpot(ctx);
      if (quizType === "password_compliance") return void mountPasswordCompliance(ctx);
      if (quizType === "ransomware_simulator") return void mountRansomwareSimulator(ctx);
      if (quizType === "phishing_detection") return void mountPhishingDetection(ctx);
      ctx.setStatus(`Unsupported quiz type: ${quizType || "unknown"}.`);
      return;
    case "VIDEO":
    case "ANIMATION":
      ctx.setStatus("Use the video launcher for this item.");
      return;
    default:
      ctx.setStatus(`Unsupported content type: ${contentType || "unknown"}.`);
  }
}

export function isContentItem(item: { type?: string; contentType?: string; common?: { contentType?: string }; legacyQuiz?: boolean }): boolean {
  if (item.type === "content") return true;
  if (item.legacyQuiz) return false;
  const type = item.contentType || item.common?.contentType || "";
  if (!type || type === "DECK") return false;
  if (type === "VIDEO" || type === "ANIMATION") return false;
  if (type === "QUIZ" && item.type === "quiz") return false;
  return Boolean(type);
}
