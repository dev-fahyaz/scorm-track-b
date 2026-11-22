"use strict";

const { isContentType } = require("../../models/contentTypes");
const { validateContentItem, asRecord } = require("../../models/validate");
const {
  normalizeLessons: normalizeContentLessons,
  videoUrlFromSpecific,
} = require("./content/normalize");

const VERSIONS = new Set(["1.2", "2004 3rd Edition", "2004 4th Edition"]);
const DURATION = /^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/;
const LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const IDENTIFIER = /^[A-Za-z0-9._:-]+$/;
const PACKAGE_VERSION = /^[0-9A-Za-z._-]+$/;
const POSTER = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;
const QUESTION_KINDS = new Set(["choice", "true-false", "multi", "fill-in"]);

function durationOk(value) {
  return typeof value === "string" && value.trim() !== "PT" && DURATION.test(value.trim());
}

function httpsUrl(value) {
  try {
    return Boolean(value) && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function questionKind(question) {
  if (question && QUESTION_KINDS.has(question.kind)) return question.kind;
  if (question && (Array.isArray(question.choices) || Number.isInteger(question.correctIndex))) return "choice";
  return "";
}

function questionErrors(question, label) {
  const errors = [];
  const kind = questionKind(question);
  const prompt = question && typeof question.prompt === "string" ? question.prompt.trim() : "";
  if (!prompt) errors.push(`${label} needs a prompt.`);
  if (!kind) {
    errors.push(`${label} needs a question type.`);
    return errors;
  }
  if (kind === "fill-in") {
    const answers = question && Array.isArray(question.answers)
      ? question.answers.map((answer) => String(answer || "").trim()).filter(Boolean)
      : [];
    if (!answers.length || answers.length > 6) {
      errors.push(`${label} needs 1 to 6 accepted answers.`);
    }
    return errors;
  }
  if (kind === "true-false") {
    const indexes = question && Array.isArray(question.correctIndexes) ? question.correctIndexes : [];
    if (indexes.length !== 1 || (indexes[0] !== 0 && indexes[0] !== 1)) {
      errors.push(`${label} needs true or false marked correct.`);
    }
    return errors;
  }
  const choices = question && Array.isArray(question.choices)
    ? question.choices.map((choice) => String(choice || "").trim())
    : [];
  if (choices.length < 2 || choices.length > 6 || choices.some((choice) => !choice)) {
    errors.push(`${label} needs 2 to 6 choices.`);
  }
  const indexes = question && Array.isArray(question.correctIndexes)
    ? question.correctIndexes
    : Number.isInteger(question && question.correctIndex) ? [question.correctIndex] : [];
  const marked = indexes.filter((index, position) => (
    Number.isInteger(index) && index >= 0 && index < choices.length && indexes.indexOf(index) === position
  ));
  if (kind === "multi") {
    if (!marked.length) errors.push(`${label} needs at least one correct choice.`);
  } else if (marked.length !== 1) {
    errors.push(`${label} needs one correct choice.`);
  }
  return errors;
}

function isContentPayload(item) {
  return Boolean(item && asRecord(item.common) && isContentType(item.common.contentType));
}

function itemKind(item) {
  if (item && item.type === "deck") return "deck";
  if (item && item.type === "quiz") return "quiz";
  if (isContentPayload(item)) return "content";
  if (item && item.type === "content") return "content";
  return "video";
}

function lessonErrors(lessons, options) {
  const checkQuizzes = Boolean(options && options.quizzes);
  const errors = [];
  if (!Array.isArray(lessons) || lessons.length === 0) {
    errors.push("Add at least one lesson.");
    return errors;
  }
  lessons.forEach((lesson, lessonIndex) => {
    const items = lesson && Array.isArray(lesson.items) ? lesson.items : null;
    const label = `Lesson ${lessonIndex + 1}`;
    if (!items || items.length === 0) {
      errors.push(`${label} needs at least one content item.`);
      return;
    }
    items.forEach((item, itemIndex) => {
      const kind = itemKind(item);
      const itemLabel = `${label} item ${itemIndex + 1}`;

      if (kind === "deck") {
        if (!item.deckId || typeof item.deckId !== "string") {
          errors.push(`${itemLabel} needs a PowerPoint upload.`);
        }
        return;
      }

      if (kind === "content") {
        const contentType = item.common.contentType;
        errors.push(...validateContentItem(item, itemLabel));
        if (contentType === "VIDEO" || contentType === "ANIMATION") {
          const url = videoUrlFromSpecific(item.specific);
          if (!httpsUrl(url) && !/^https?:\/\//i.test(url)) {
            errors.push(`${itemLabel} needs an https file URL or a YouTube link.`);
          }
        }
        if (contentType === "QUIZ" && Array.isArray(item.questions) && checkQuizzes) {
          item.questions.forEach((question, questionIndex) => {
            errors.push(...questionErrors(question, `${itemLabel} question ${questionIndex + 1}`));
          });
        }
        return;
      }

      if (kind === "video") {
        const url = item && typeof (item.url || item.videoUrl) === "string"
          ? String(item.url || item.videoUrl).trim()
          : "";
        if (!httpsUrl(url)) {
          errors.push(`${itemLabel} needs an https file URL or a YouTube link.`);
        }
      }

      if (!checkQuizzes) return;
      const questions = item && Array.isArray(item.questions) ? item.questions : [];
      if (kind === "quiz" && (!questions.length || questions.length > 20)) {
        errors.push(`${itemLabel} needs between 1 and 20 questions.`);
        return;
      }
      if (kind === "video" && questions.length > 20) {
        errors.push(`${itemLabel} can hold up to 20 questions.`);
        return;
      }
      questions.forEach((question, questionIndex) => {
        const questionLabel = `${itemLabel} question ${questionIndex + 1}`;
        errors.push(...questionErrors(question, questionLabel));
        if (kind !== "video") return;
        const rawAt = question ? question.at : null;
        if (rawAt == null || rawAt === "") return;
        if (timeValue(rawAt) == null) {
          errors.push(`${questionLabel} needs a time in minutes and seconds, or no time to ask after the video.`);
        }
      });
    });
  });
  return errors;
}

function timeValue(value) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(number) || number < 0 || number > 86400) return null;
  return number;
}

function normalizeQuestion(question, withTime) {
  const kind = questionKind(question) || "choice";
  const prompt = String((question && question.prompt) || "").trim();
  const at = withTime ? timeValue(question && question.at) : null;
  if (kind === "fill-in") {
    const answers = (question && Array.isArray(question.answers) ? question.answers : [])
      .map((answer) => String(answer || "").trim())
      .filter(Boolean);
    return { kind, prompt, choices: [], correctIndexes: [], answers, at };
  }
  if (kind === "true-false") {
    const indexes = question && Array.isArray(question.correctIndexes) ? question.correctIndexes : [];
    return {
      kind,
      prompt,
      choices: ["True", "False"],
      correctIndexes: [indexes[0] === 1 ? 1 : 0],
      answers: [],
      at,
    };
  }
  const choices = (question && Array.isArray(question.choices) ? question.choices : [])
    .map((choice) => String(choice || "").trim());
  const source = question && Array.isArray(question.correctIndexes)
    ? question.correctIndexes
    : Number.isInteger(question && question.correctIndex) ? [question.correctIndex] : [];
  const correctIndexes = source.filter((index, position) => (
    Number.isInteger(index) && index >= 0 && index < choices.length && source.indexOf(index) === position
  ));
  return {
    kind,
    prompt,
    choices,
    correctIndexes: kind === "choice" ? correctIndexes.slice(0, 1) : correctIndexes,
    answers: [],
    at,
  };
}

function normalizeLessons(lessons) {
  const normalized = normalizeContentLessons(lessons);
  return normalized.map((lesson) => ({
    ...lesson,
    items: lesson.items.map((item) => {
      if (item.type === "deck") return item;
      if (Array.isArray(item.questions)) {
        const withTime = item.type === "video" || item.contentType === "VIDEO" || item.contentType === "ANIMATION";
        return {
          ...item,
          questions: item.questions.map((question) => normalizeQuestion(question, withTime)),
        };
      }
      return item;
    }),
  }));
}

function validate(body) {
  const errors = [];
  if (!body || typeof body !== "object") return ["Send a course record."];
  if (!VERSIONS.has(body.version)) {
    errors.push("Choose SCORM 1.2, 2004 3rd Edition, or 2004 4th Edition.");
  }
  if (typeof body.title !== "string" || !body.title.trim()) errors.push("Enter a course title.");
  if (typeof body.organization !== "string" || !body.organization.trim()) {
    errors.push("Enter an organization.");
  }
  if (typeof body.identifier !== "string" || !body.identifier.trim()) {
    errors.push("Enter an identifier.");
  } else if (!IDENTIFIER.test(body.identifier.trim())) {
    errors.push("Identifier may use letters, numbers, dots, hyphens, or underscores.");
  }
  if (typeof body.language !== "string" || !LANGUAGE.test(body.language.trim())) {
    errors.push("Enter a language code such as en or fr-FR.");
  }
  if (typeof body.masteryScore !== "number" || body.masteryScore < 0 || body.masteryScore > 100) {
    errors.push("Enter a mastery score from 0 to 100.");
  }
  if (typeof body.requireQuizPass !== "boolean") {
    errors.push("Choose whether a failed quiz blocks completion.");
  }
  errors.push(...lessonErrors(body.lessons, { quizzes: true }));

  if (
    typeof body.completionThreshold !== "number" ||
    !Number.isInteger(body.completionThreshold) ||
    body.completionThreshold < 1 ||
    body.completionThreshold > 100
  ) {
    errors.push("Enter a completion threshold from 1 to 100.");
  }

  const pkg = body.package;
  if (!pkg || typeof pkg !== "object") {
    errors.push("Package metadata is missing.");
    return errors;
  }
  if (!durationOk(pkg.duration)) errors.push("Use a duration like PT0H5M0S.");
  if (!durationOk(pkg.typicalDuration)) errors.push("Use a typical duration like PT0H5M0S.");
  const packageVersion = typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : "";
  if (!PACKAGE_VERSION.test(packageVersion)) errors.push("Use a package version such as 1.0.0.");
  if (pkg.vcard && pkg.vcard.url) {
    try {
      const contact = new URL(pkg.vcard.url);
      if (contact.protocol !== "https:" && contact.protocol !== "http:") {
        errors.push("Contact URL must start with http or https.");
      }
    } catch {
      errors.push("Contact URL must start with http or https.");
    }
  }
  if (body.posterDataUrl) {
    const match = POSTER.exec(body.posterDataUrl);
    if (!match) errors.push("Poster must be a JPEG, PNG, or WebP image.");
    else {
      const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
      if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) {
        errors.push("Poster must be 2 MB or smaller.");
      }
    }
  }
  return errors;
}

module.exports = { lessonErrors, validate, normalizeLessons, POSTER, normalizeQuestion };
