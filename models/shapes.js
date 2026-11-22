"use strict";

const { LIKER_OPTIONS, PHISHING, TAB, withBackground } = require("./defaults");

function id() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function common(contentType, name) {
  return {
    contentName: name || "",
    description: "",
    contentType: contentType,
    status: "DRAFT",
    author: "",
    chapterIds: [],
    tags: [],
  };
}

function textFormatting() {
  return {
    title: "",
    titleColor: "#ffffff",
    titleHighContrastMode: false,
    subtitle: "",
    subtitleColor: "#ffffff",
    subtitleHighContrastMode: false,
    paragraph: "",
    paragraphColor: "#ffffff",
    paragraphHighContrastMode: false,
  };
}

function emptyText() {
  return withBackground(Object.assign(textFormatting(), { featureImageLink: "" }));
}

function emptyLink() {
  return withBackground(
    Object.assign(textFormatting(), {
      featureImageLink: "",
      linkText: "",
      url: "",
      linkColor: "#ffffff",
    })
  );
}

function emptyPdf() {
  return withBackground(
    Object.assign(textFormatting(), {
      featureImageLink: "",
      pdfText: "",
      pdfLink: "",
      pdfTextColor: "#ffffff",
      pdfIsRequired: false,
      pdfFileName: "",
      pdfFileURL: "",
      metadata: { additionalProp1: {} },
    })
  );
}

function emptyQuestion() {
  return {
    question: "",
    scorable: false,
    score: "",
    options: [
      { id: id(), option: "", isCorrect: true },
      { id: id(), option: "", isCorrect: false },
    ],
  };
}

function emptySlide() {
  return withBackground(
    Object.assign(textFormatting(), {
      featureImageLink: "",
      slides: [],
      slideAdditionalProperties: {
        buttonText: "",
        buttonTextColor: "#ffffff",
        buttonColor: "#37BE99",
        buttonHoverColor: "#37BE99",
      },
    })
  );
}

function emptyTab() {
  return withBackground(
    Object.assign(textFormatting(), {
      tabSections: [],
      additionalProperties: {
        tabbedPosition: TAB.tabbedPosition,
        buttonTextColor: TAB.buttonTextColor,
        buttonColor: TAB.buttonColor,
        buttonHoverColor: TAB.buttonHoverColor,
        audioUrl: "",
      },
    })
  );
}

function emptyVideo() {
  return {
    interactiveVideo: {
      videoUrl: "",
      videoFile: null,
      isProcessing: false,
      processingStatus: "",
      processVideoUrl: "",
    },
    captionUrl: "",
    videoLength: "",
    metadata: { additionalProp1: { videoText: "" } },
  };
}

function emptyMarkdown() {
  return withBackground({
    markdownText: "",
    headingColor: "#ffffff",
    textColor: "#ffffff",
    linkColor: "#ffffff",
  });
}

function emptyStoryBlock() {
  return withBackground({ steps: [] });
}

function emptySliderLevel() {
  return withBackground({ steps: [] });
}

function emptyMatching() {
  return withBackground({
    quizType: "matching",
    question: "",
    labelLeft: "",
    labelRight: "",
    pairs: [{ inputTypeLeft: "text", inputTypeRight: "text", valueLeft: "", valueRight: "", linkLeft: "", linkRight: "" }],
  });
}

function emptyOrdering() {
  return withBackground({
    quizType: "ordering",
    question: "",
    options: [
      { id: id(), index: 0, optionText: "", optionImage: "", optionImageLink: "" },
      { id: id(), index: 1, optionText: "", optionImage: "", optionImageLink: "" },
    ],
  });
}

function emptyLiker() {
  return withBackground({
    quizType: "liker",
    question: "",
    options: LIKER_OPTIONS.map(function (entry, index) {
      return {
        id: id(),
        index: index,
        optionText: entry.label,
        optionImage: "",
        optionImageLink: entry.optionImageLink,
      };
    }),
  });
}

function emptyPicture() {
  return withBackground({
    quizType: "picture",
    question: "",
    options: [
      { id: id(), index: 0, optionText: "", optionImage: "", optionImageLink: "", isCorrect: true },
      { id: id(), index: 1, optionText: "", optionImage: "", optionImageLink: "", isCorrect: false },
    ],
  });
}

function emptyScenario() {
  return withBackground({
    quizType: "scenario",
    scenarioText: "",
    questions: [
      {
        id: id(),
        question: "",
        options: [
          { id: id(), option: "", isCorrect: true },
          { id: id(), option: "", isCorrect: false },
        ],
      },
    ],
  });
}

function emptyHotSpot() {
  return withBackground({
    quizType: "hot_spot",
    imageLink: "",
    imageTitle: "",
    annotations: [],
    correctTags: [],
    correctFeedback: "",
    incorrectFeedback: "",
    showAutoFeedback: false,
  });
}

function emptyInteractiveModule(quizType) {
  return withBackground({
    quizType: quizType,
    question: "",
  });
}

function emptyPhishing() {
  return withBackground({
    quizType: "phishing_detection",
    question: "",
    timeLimitSeconds: PHISHING.timeLimitSeconds,
    emails: [
      {
        senderName: "",
        senderEmail: "",
        subject: "",
        date: "",
        time: "",
        avatar: "",
        body: "",
        isPhishing: true,
        explanation: "",
        links: [],
      },
    ],
  });
}

function emptyQuiz(quizType) {
  const type = quizType || "matching";
  if (type === "matching") return emptyMatching();
  if (type === "ordering") return emptyOrdering();
  if (type === "liker") return emptyLiker();
  if (type === "picture") return emptyPicture();
  if (type === "scenario") return emptyScenario();
  if (type === "hot_spot") return emptyHotSpot();
  if (type === "phishing_detection") return emptyPhishing();
  if (type === "ransomware_simulator" || type === "password_compliance") {
    return emptyInteractiveModule(type);
  }
  return emptyMatching();
}

function emptyInteractiveVideo() {
  return withBackground({
    interactiveVideoByLanguage: [
      {
        cardTitle: "Video Card",
        language: "en",
        default: true,
        videoUrl: "",
        videoLength: "",
        isProcessing: false,
        processingStatus: "QUEUE",
        processVideoUrl: "",
        contentList: [],
      },
    ],
  });
}

function emptyInteractiveContent() {
  return withBackground({ contentList: [] });
}

function emptySpecific(contentType, quizType) {
  switch (contentType) {
    case "TEXT":
      return emptyText();
    case "LINK":
      return emptyLink();
    case "PDF":
      return emptyPdf();
    case "QUESTION":
      return emptyQuestion();
    case "SLIDE":
      return emptySlide();
    case "TAB":
      return emptyTab();
    case "VIDEO":
    case "ANIMATION":
      return emptyVideo();
    case "MARKDOWN":
      return emptyMarkdown();
    case "STORY_BLOCK":
      return emptyStoryBlock();
    case "SLIDER_LEVEL":
      return emptySliderLevel();
    case "QUIZ":
      return emptyQuiz(quizType);
    case "INTERACTIVE_VIDEO":
      return emptyInteractiveVideo();
    case "INTERACTIVE_CONTENT":
      return emptyInteractiveContent();
    default:
      return {};
  }
}

function emptyContentItem(contentType, quizType) {
  return {
    common: common(contentType, ""),
    specific: emptySpecific(contentType, quizType),
  };
}

module.exports = {
  id,
  common,
  emptySpecific,
  emptyContentItem,
  emptyText,
  emptyLink,
  emptyPdf,
  emptyQuestion,
  emptySlide,
  emptyTab,
  emptyVideo,
  emptyMarkdown,
  emptyStoryBlock,
  emptySliderLevel,
  emptyQuiz,
  emptyInteractiveVideo,
  emptyInteractiveContent,
};
