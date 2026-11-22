"use strict";

const {
  isContentType,
  legacyToContentType,
  isQuizType,
} = require("../../../models/contentTypes");
const { timeToSeconds, asRecord, httpsUrl } = require("../../../models/validate");

function itemHref(lessonNumber, itemNumber, count) {
  if (count <= 1) return `lesson-${lessonNumber}.html`;
  return `lesson-${lessonNumber}-${itemNumber}.html`;
}

function videoUrlFromSpecific(specific) {
  const body = asRecord(specific) || {};
  const video = asRecord(body.interactiveVideo) || {};
  return String(
    video.processVideoUrl || video.videoUrl || body.videoUrl || body.url || ""
  ).trim();
}

function normalizeOverlay(entry) {
  const overlay = asRecord(entry) || {};
  const body = asRecord(overlay.contentBody) || {};
  const common = asRecord(body.common) || {};
  const specific = asRecord(body.specific) || {};
  const contentType = overlay.contentType || common.contentType || "";
  return {
    contentType,
    time: overlay.time != null ? overlay.time : "",
    at: timeToSeconds(overlay.time),
    canSkip: Boolean(overlay.canSkip),
    isDefault: Boolean(overlay.isDefault),
    common,
    specific,
  };
}

function normalizeContentItem(item, href, fallbackTitle) {
  const common = asRecord(item.common) || {};
  const specific = asRecord(item.specific) || {};
  const contentType = common.contentType;
  const title =
    String((item && item.title) || "").trim() ||
    String(common.contentName || "").trim() ||
    fallbackTitle;

  const base = {
    type: "content",
    contentType,
    title,
    href,
    common: {
      contentName: String(common.contentName || title).trim(),
      description: String(common.description || "").trim(),
      contentType,
      status: common.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      author: String(common.author || "").trim(),
      tags: Array.isArray(common.tags) ? common.tags.map(String) : [],
    },
    specific,
  };

  if (contentType === "VIDEO" || contentType === "ANIMATION") {
    base.url = videoUrlFromSpecific(specific);
    if (Array.isArray(item.questions)) base.questions = item.questions;
  }

  if (contentType === "QUIZ") {
    const quizType = isQuizType(specific.quizType) ? specific.quizType : "matching";
    base.specific = Object.assign({}, specific, { quizType });
    if (Array.isArray(item.questions) && item.questions.length) {
      base.questions = item.questions;
      base.legacyQuiz = true;
    }
  }

  if (contentType === "INTERACTIVE_VIDEO") {
    const cards = Array.isArray(specific.interactiveVideoByLanguage)
      ? specific.interactiveVideoByLanguage
      : [];
    base.specific = Object.assign({}, specific, {
      interactiveVideoByLanguage: cards.map(function (card) {
        const entry = asRecord(card) || {};
        return Object.assign({}, entry, {
          contentList: Array.isArray(entry.contentList)
            ? entry.contentList.map(normalizeOverlay)
            : [],
        });
      }),
    });
    const primary =
      cards.find(function (card) {
        return card && card.default;
      }) || cards[0];
    if (primary) {
      base.url = String(primary.processVideoUrl || primary.videoUrl || "").trim();
    }
  }

  if (contentType === "INTERACTIVE_CONTENT") {
    base.specific = Object.assign({}, specific, {
      contentList: Array.isArray(specific.contentList)
        ? specific.contentList.map(normalizeOverlay)
        : [],
    });
  }

  return base;
}

function normalizeLegacyVideo(item, href, fallbackTitle) {
  const title = String((item && item.title) || "").trim() || fallbackTitle;
  const url = String((item && (item.url || item.videoUrl)) || "").trim();
  return {
    type: "video",
    contentType: "VIDEO",
    title,
    href,
    url,
    questions: Array.isArray(item.questions) ? item.questions : [],
    common: {
      contentName: title,
      description: "",
      contentType: "VIDEO",
      status: "PUBLISHED",
      author: "",
      tags: [],
    },
    specific: {
      interactiveVideo: { videoUrl: url, processVideoUrl: "", isProcessing: false, processingStatus: "" },
      captionUrl: "",
      videoLength: "",
    },
  };
}

function normalizeLegacyQuiz(item, href, fallbackTitle) {
  const title = String((item && item.title) || "").trim() || fallbackTitle;
  return {
    type: "quiz",
    contentType: "QUIZ",
    title,
    href,
    questions: Array.isArray(item.questions) ? item.questions : [],
    legacyQuiz: true,
    common: {
      contentName: title,
      description: "",
      contentType: "QUIZ",
      status: "PUBLISHED",
      author: "",
      tags: [],
    },
    specific: { quizType: "legacy" },
  };
}

function normalizeLegacyDeck(item, href, fallbackTitle) {
  const title = String((item && item.title) || "").trim() || fallbackTitle;
  return {
    type: "deck",
    contentType: "DECK",
    title,
    href,
    deckId: String((item && item.deckId) || ""),
    slides: Array.isArray(item.slides) ? item.slides : [],
  };
}

function detectKind(item) {
  if (!item || typeof item !== "object") return "unknown";
  if (item.type === "deck" || item.contentType === "DECK") return "deck";
  if (item.common && item.common.contentType && isContentType(item.common.contentType)) {
    return "content";
  }
  if (item.type === "quiz") return "quiz";
  if (item.type === "video") return "video";
  if (item.type === "content" && isContentType(item.contentType)) return "content";
  const mapped = legacyToContentType(item.type);
  if (mapped === "DECK") return "deck";
  if (mapped) return mapped === "QUIZ" ? "quiz" : "video";
  return "unknown";
}

function normalizeItem(item, lessonIndex, itemIndex, count) {
  const href = itemHref(lessonIndex + 1, itemIndex + 1, count);
  const kind = detectKind(item);
  const fallback =
    kind === "quiz"
      ? `Quiz ${itemIndex + 1}`
      : kind === "deck"
        ? `Slides ${itemIndex + 1}`
        : kind === "content"
          ? `Content ${itemIndex + 1}`
          : `Video ${itemIndex + 1}`;

  if (kind === "deck") return normalizeLegacyDeck(item, href, fallback);
  if (kind === "quiz") return normalizeLegacyQuiz(item, href, fallback);
  if (kind === "content") return normalizeContentItem(item, href, fallback);
  return normalizeLegacyVideo(item, href, fallback);
}

function normalizeLessons(lessons) {
  return (Array.isArray(lessons) ? lessons : []).map(function (lesson, lessonIndex) {
    const sourceItems = Array.isArray(lesson && lesson.items) ? lesson.items : [];
    const items = sourceItems.map(function (item, itemIndex) {
      return normalizeItem(item, lessonIndex, itemIndex, sourceItems.length);
    });
    return {
      title: (lesson && String(lesson.title || "").trim()) || `Lesson ${lessonIndex + 1}`,
      items,
    };
  });
}

function contentErrors(item, label) {
  const errors = [];
  if (!item) return [`${label} is missing.`];
  if (item.type === "deck") {
    if (!item.deckId) errors.push(`${label} needs a PowerPoint upload.`);
    return errors;
  }
  if (item.type === "video" || item.contentType === "VIDEO" || item.contentType === "ANIMATION") {
    const url = String(item.url || videoUrlFromSpecific(item.specific) || "").trim();
    if (url && !httpsUrl(url) && !/^https?:\/\//i.test(url)) {
      errors.push(`${label} needs an https file URL or a YouTube link.`);
    }
    if (!url && (item.type === "video" || item.contentType === "VIDEO" || item.contentType === "ANIMATION")) {
      // allow empty when builder sends draft; packaging validate may still require URL for VIDEO
      if (item.type === "video") errors.push(`${label} needs an https file URL or a YouTube link.`);
    }
  }
  return errors;
}

module.exports = {
  itemHref,
  normalizeLessons,
  normalizeItem,
  detectKind,
  videoUrlFromSpecific,
  contentErrors,
  timeToSeconds,
};
