"use strict";

/** Stored contentType values from docs/content-types.md */
const CONTENT_TYPES = Object.freeze([
  "TEXT",
  "LINK",
  "PDF",
  "QUESTION",
  "SLIDE",
  "TAB",
  "VIDEO",
  "ANIMATION",
  "MARKDOWN",
  "STORY_BLOCK",
  "SLIDER_LEVEL",
  "QUIZ",
  "INTERACTIVE_VIDEO",
  "INTERACTIVE_CONTENT",
]);

const CONTENT_TYPE_SET = new Set(CONTENT_TYPES);

/** Authoring labels → stored contentType (JSON so Vite can import it as ESM) */
const CONTENT_TYPE_LABELS = Object.freeze(require("./contentTypeLabels.json"));

const QUIZ_TYPES = Object.freeze([
  "matching",
  "ordering",
  "liker",
  "picture",
  "scenario",
  "hot_spot",
  "ransomware_simulator",
  "password_compliance",
  "phishing_detection",
]);

const QUIZ_TYPE_SET = new Set(QUIZ_TYPES);

const QUIZ_TYPE_LABELS = Object.freeze({
  matching: "Matching",
  ordering: "Ordering/Sequencing Answer",
  liker: "Liker Scale Question",
  picture: "Picture Choice",
  scenario: "Scenario-based/Case Study",
  hot_spot: "Hot spot Quiz",
  ransomware_simulator: "Ransomware Simulator Quiz",
  password_compliance: "Password Compliance Quiz",
  phishing_detection: "Phishing Detection Quiz",
});

/** Legacy Track B question kinds still supported on VIDEO/QUIZ launch files */
const LEGACY_QUESTION_KINDS = Object.freeze(["choice", "true-false", "multi", "fill-in"]);

const HOST_TYPES = Object.freeze(["INTERACTIVE_VIDEO", "INTERACTIVE_CONTENT"]);

/** Nested overlays cannot be these */
const NEST_FORBIDDEN = Object.freeze([
  "INTERACTIVE_VIDEO",
  "INTERACTIVE_CONTENT",
  "QUESTION",
  "none",
  "NONE",
]);

/** Extra nest bans on interactive video only */
const INTERACTIVE_VIDEO_NEST_FORBIDDEN = Object.freeze(["VIDEO", "ANIMATION"]);

function isContentType(value) {
  return typeof value === "string" && CONTENT_TYPE_SET.has(value);
}

function isQuizType(value) {
  return typeof value === "string" && QUIZ_TYPE_SET.has(value);
}

function isHostType(value) {
  return HOST_TYPES.includes(value);
}

function canNest(parentType, childType) {
  if (!isContentType(childType) && childType !== "QUIZ") return false;
  if (NEST_FORBIDDEN.includes(childType)) return false;
  if (parentType === "INTERACTIVE_VIDEO" && INTERACTIVE_VIDEO_NEST_FORBIDDEN.includes(childType)) {
    return false;
  }
  return true;
}

/** Map legacy dashboard item.type → contentType */
function legacyToContentType(type) {
  if (type === "quiz") return "QUIZ";
  if (type === "deck") return "DECK";
  if (type === "video") return "VIDEO";
  if (isContentType(type)) return type;
  return "";
}

module.exports = {
  CONTENT_TYPES,
  CONTENT_TYPE_SET,
  CONTENT_TYPE_LABELS,
  QUIZ_TYPES,
  QUIZ_TYPE_SET,
  QUIZ_TYPE_LABELS,
  LEGACY_QUESTION_KINDS,
  HOST_TYPES,
  NEST_FORBIDDEN,
  INTERACTIVE_VIDEO_NEST_FORBIDDEN,
  isContentType,
  isQuizType,
  isHostType,
  canNest,
  legacyToContentType,
};
