"use strict";

const { isContentType, isQuizType, canNest, isHostType } = require("./contentTypes");

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function httpsUrl(value) {
  try {
    return Boolean(value) && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function timeToSeconds(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value >= 0 ? value : null;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const parts = text.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function labelOf(item, index) {
  const common = asRecord(item && item.common) || {};
  const name = typeof common.contentName === "string" && common.contentName.trim()
    ? common.contentName.trim()
    : "";
  return name || `Content item ${index + 1}`;
}

function validateOverlayList(list, parentType, label, errors) {
  if (!Array.isArray(list)) return;
  const times = new Set();
  list.forEach(function (entry, index) {
    const overlay = asRecord(entry) || {};
    const childType = overlay.contentType || (asRecord(overlay.contentBody) && asRecord(overlay.contentBody).common
      ? asRecord(asRecord(overlay.contentBody).common).contentType
      : "");
    if (childType && !canNest(parentType, childType)) {
      errors.push(`${label} overlay ${index + 1} cannot nest ${childType}.`);
    }
    const seconds = timeToSeconds(overlay.time);
    if (parentType === "INTERACTIVE_CONTENT" && seconds === 0) {
      errors.push(`${label} overlay ${index + 1} time cannot be 0.`);
    }
    if (seconds != null) {
      const key = String(seconds);
      if (times.has(key)) errors.push(`${label} has two overlays at the same time.`);
      times.add(key);
    }
    const body = asRecord(overlay.contentBody);
    if (body) {
      errors.push.apply(errors, validateContentItem(body, `${label} overlay ${index + 1}`));
    }
  });
}

function validateQuizSpecific(specific, label, errors) {
  const quizType = specific.quizType || "matching";
  if (!isQuizType(quizType)) {
    errors.push(`${label} needs a quiz type.`);
    return;
  }
  if (quizType === "matching") {
    if (!String(specific.question || "").trim()) errors.push(`${label} needs a question.`);
    if (!Array.isArray(specific.pairs) || !specific.pairs.length) {
      errors.push(`${label} needs at least one pair.`);
    }
  } else if (quizType === "ordering" || quizType === "liker" || quizType === "picture") {
    if (!String(specific.question || "").trim()) errors.push(`${label} needs a question.`);
    if (!Array.isArray(specific.options) || specific.options.length < 2) {
      errors.push(`${label} needs at least two options.`);
    }
  } else if (quizType === "scenario") {
    if (!String(specific.scenarioText || "").trim()) errors.push(`${label} needs scenario text.`);
    if (!Array.isArray(specific.questions) || !specific.questions.length) {
      errors.push(`${label} needs at least one question.`);
    }
  } else if (quizType === "hot_spot") {
    if (!String(specific.imageTitle || "").trim()) errors.push(`${label} needs an image title.`);
    if (!String(specific.imageLink || "").trim()) errors.push(`${label} needs an image.`);
    if (!Array.isArray(specific.correctTags) || !specific.correctTags.length) {
      errors.push(`${label} needs at least one correct region.`);
    }
    if (!String(specific.correctFeedback || "").trim()) errors.push(`${label} needs correct feedback.`);
    if (!String(specific.incorrectFeedback || "").trim()) errors.push(`${label} needs incorrect feedback.`);
  } else if (quizType === "phishing_detection") {
    if (!Array.isArray(specific.emails) || !specific.emails.length) {
      errors.push(`${label} needs at least one email.`);
    }
  }
}

function validateSpecific(contentType, specific, label, errors) {
  const body = asRecord(specific) || {};
  if (contentType === "TEXT" || contentType === "MARKDOWN") {
    const text = contentType === "MARKDOWN" ? body.markdownText : body.paragraph || body.title;
    if (!String(text || "").trim() && !String(body.title || "").trim()) {
      // Soft: allow empty for draft packaging from builder; warn lightly only if nothing at all
    }
  }
  if (contentType === "LINK") {
    const url = String(body.url || "").trim();
    if (url && !/^https?:\/\//i.test(url)) errors.push(`${label} link needs an http(s) URL.`);
  }
  if (contentType === "PDF") {
    const link = String(body.pdfLink || body.pdfFileURL || "").trim();
    if (link && !/^https?:\/\//i.test(link) && !link.startsWith("./") && !link.startsWith("media/")) {
      errors.push(`${label} PDF needs a URL or package path.`);
    }
  }
  if (contentType === "QUESTION") {
    if (!String(body.question || "").trim()) errors.push(`${label} needs a question.`);
    if (!Array.isArray(body.options) || body.options.length < 2) {
      errors.push(`${label} needs at least two options.`);
    }
  }
  if (contentType === "VIDEO" || contentType === "ANIMATION") {
    const video = asRecord(body.interactiveVideo) || {};
    const url = String(video.videoUrl || video.processVideoUrl || body.videoUrl || "").trim();
    if (url && !httpsUrl(url) && !/^https?:\/\//i.test(url)) {
      errors.push(`${label} needs an https video URL or YouTube link.`);
    }
  }
  if (contentType === "QUIZ") validateQuizSpecific(body, label, errors);
  if (contentType === "INTERACTIVE_VIDEO") {
    const cards = Array.isArray(body.interactiveVideoByLanguage) ? body.interactiveVideoByLanguage : [];
    if (!cards.length) errors.push(`${label} needs at least one language video.`);
    cards.forEach(function (card, index) {
      const entry = asRecord(card) || {};
      validateOverlayList(entry.contentList, "INTERACTIVE_VIDEO", `${label} video ${index + 1}`, errors);
    });
  }
  if (contentType === "INTERACTIVE_CONTENT") {
    validateOverlayList(body.contentList, "INTERACTIVE_CONTENT", label, errors);
  }
}

function validateContentItem(item, labelOverride) {
  const errors = [];
  const common = asRecord(item && item.common);
  if (!common) {
    errors.push((labelOverride || "Content item") + " needs a common block.");
    return errors;
  }
  const label = labelOverride || labelOf(item, 0);
  const contentType = common.contentType;
  if (!isContentType(contentType)) {
    errors.push(`${label} needs a valid contentType.`);
    return errors;
  }
  if (!String(common.contentName || "").trim() && !labelOverride) {
    // name optional when nested; top-level callers may require title separately
  }
  validateSpecific(contentType, item.specific, label, errors);
  return errors;
}

function validateLessonItems(items) {
  const errors = [];
  if (!Array.isArray(items) || !items.length) {
    errors.push("Add at least one content item.");
    return errors;
  }
  items.forEach(function (item, index) {
    if (item && item.type === "deck") {
      if (!item.deckId) errors.push(`Item ${index + 1} deck needs a PowerPoint upload.`);
      return;
    }
    if (item && item.common && item.specific) {
      errors.push.apply(errors, validateContentItem(item, labelOf(item, index)));
      return;
    }
    // legacy video/quiz checked by app/course/rules
  });
  return errors;
}

module.exports = {
  timeToSeconds,
  validateContentItem,
  validateLessonItems,
  httpsUrl,
  asRecord,
  isHostType,
};
