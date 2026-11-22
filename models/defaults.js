"use strict";

const BACKGROUND = Object.freeze({
  textColor: "#000000",
  backgroundColor: "#ffffff00",
  backgroundImage: "",
  backgroundOpacity: 100,
  tone: "LIGHT",
});

const TITLE_FORMATTING = Object.freeze({
  title: "",
  titleColor: "#ffffff",
  titleHighContrastMode: false,
});

const SUBTITLE_FORMATTING = Object.freeze({
  subtitle: "",
  subtitleColor: "#ffffff",
  subtitleHighContrastMode: false,
});

const PARAGRAPH_FORMATTING = Object.freeze({
  paragraph: "",
  paragraphColor: "#ffffff",
  paragraphHighContrastMode: false,
});

const LINK_FORMATTING = Object.freeze({
  linkText: "",
  url: "",
  linkColor: "#ffffff",
});

const BUTTON = Object.freeze({
  buttonText: "",
  buttonTextColor: "#ffffff",
  buttonColor: "#37BE99",
  buttonHoverColor: "#37BE99",
});

const LIKER_OPTIONS = Object.freeze([
  { label: "Strongly Disagree", optionImageLink: "strongly-disagree" },
  { label: "Somewhat Disagree", optionImageLink: "somewhat-disagree" },
  { label: "Neither Disagree or Agree", optionImageLink: "neither-disagree-agree" },
  { label: "Somewhat Agree", optionImageLink: "somewhat-agree" },
  { label: "Strongly Agree", optionImageLink: "strongly-agree" },
]);

const PHISHING = Object.freeze({
  timeLimitSeconds: 180,
  minTimeLimitSeconds: 10,
});

const TAB = Object.freeze({
  tabbedPosition: "COLUMN",
  buttonTextColor: "#ffffff",
  buttonColor: "#ffffff00",
  buttonHoverColor: "#ffffff00",
  displayTime: "00:00",
});

const PROCESSING = Object.freeze({
  processingStatus: "QUEUE",
  isProcessing: false,
});

function withBackground(extra) {
  return Object.assign({}, BACKGROUND, extra || {});
}

module.exports = {
  BACKGROUND,
  TITLE_FORMATTING,
  SUBTITLE_FORMATTING,
  PARAGRAPH_FORMATTING,
  LINK_FORMATTING,
  BUTTON,
  LIKER_OPTIONS,
  PHISHING,
  TAB,
  PROCESSING,
  withBackground,
};
