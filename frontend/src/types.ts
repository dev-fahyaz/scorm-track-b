export type ScormVersion = "1.2" | "2004 3rd Edition" | "2004 4th Edition";

export type QuestionKind = "choice" | "true-false" | "multi" | "fill-in";

export const QUESTION_KINDS: QuestionKind[] = ["choice", "true-false", "multi", "fill-in"];

export interface QuizChoice {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  kind: QuestionKind;
  prompt: string;
  choices: QuizChoice[];
  correctIds: string[];
  answers: string[];
  at: string;
}

export interface VideoItem {
  id: string;
  type: "video";
  title: string;
  url: string;
  questions: QuizQuestion[];
}

export interface QuizItem {
  id: string;
  type: "quiz";
  title: string;
  questions: QuizQuestion[];
}

export interface SlideLink {
  text: string;
  url: string;
  type: "youtube" | "mp4" | "link";
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DeckSlide {
  title: string;
  notes: string;
  links: SlideLink[];
}

export interface DeckItem {
  id: string;
  type: "deck";
  title: string;
  deckId: string;
  slides: DeckSlide[];
}

export interface ContentCommon {
  contentName: string;
  description?: string;
  contentType: string;
  status?: string;
  author?: string;
  tags?: string[];
}

/** Content-types payload from the external course builder */
export interface ContentItem {
  id: string;
  type: "content";
  title: string;
  common: ContentCommon;
  specific: Record<string, unknown>;
  questions?: QuizQuestion[];
}

export type LessonItem = VideoItem | QuizItem | DeckItem | ContentItem;

export interface LessonGroup {
  id: string;
  title: string;
  items: LessonItem[];
}

export interface PackageForm {
  version: ScormVersion;
  title: string;
  packageName: string;
  organization: string;
  language: string;
  identifier: string;
  packageVersion: string;
  masteryScore: string;
  description: string;
  keywords: string;
  author: string;
  duration: string;
  typicalDuration: string;
  rights: string;
  vcardOrg: string;
  vcardTel: string;
  vcardAddress: string;
  vcardMail: string;
  vcardUrl: string;
  lessons: LessonGroup[];
  note: string;
  completionThreshold: string;
  requireQuizPass: boolean;
  posterName: string;
  posterDataUrl: string;
}

export interface RequestQuestion {
  kind: QuestionKind;
  prompt: string;
  choices: string[];
  correctIndexes: number[];
  answers: string[];
  at: number | null;
}

export interface RequestItem {
  type: "video" | "quiz" | "deck" | "content";
  title: string;
  url?: string;
  questions?: RequestQuestion[];
  deckId?: string;
  slides?: DeckSlide[];
  common?: ContentCommon;
  specific?: Record<string, unknown>;
}

export interface PackageRequest {
  version: ScormVersion;
  title: string;
  organization: string;
  language: string;
  identifier: string;
  masteryScore: number;
  startingPage: string;
  lessons: { title: string; items: RequestItem[] }[];
  completionThreshold: number;
  requireQuizPass: boolean;
  note?: string;
  posterDataUrl?: string;
  package: {
    name: string;
    version: string;
    author: string;
    description: string;
    keywords: string[];
    duration: string;
    typicalDuration: string;
    rights: string;
    zip: true;
    vcard: {
      author: string;
      org: string;
      tel: string;
      address: string;
      mail: string;
      url: string;
    };
  };
}

export interface DraftResult {
  title: string;
  packageName: string;
  identifier: string;
  description: string;
  keywords: string[];
  author: string;
  duration: string;
  typicalDuration: string;
  rights: string;
  masteryScore: number;
  lessons: { title: string; videos?: { title: string }[] }[];
}

function newId(): string {
  return crypto.randomUUID();
}

export function newChoice(): QuizChoice {
  return { id: newId(), text: "" };
}

export function newQuestion(): QuizQuestion {
  const first = newChoice();
  const second = newChoice();
  return {
    id: newId(),
    kind: "choice",
    prompt: "",
    choices: [first, second],
    correctIds: [first.id],
    answers: [""],
    at: "",
  };
}

export function questionKindLabel(kind: QuestionKind): string {
  if (kind === "true-false") return "True/false";
  if (kind === "multi") return "Multiple answers";
  if (kind === "fill-in") return "Fill in";
  return "Single choice";
}

export function withKind(question: QuizQuestion, kind: QuestionKind): QuizQuestion {
  if (kind === question.kind) return question;
  if (kind === "true-false") {
    const yes = { id: newId(), text: "True" };
    const no = { id: newId(), text: "False" };
    return { ...question, kind, choices: [yes, no], correctIds: [yes.id], answers: [] };
  }
  if (kind === "fill-in") {
    const answers = question.answers.some((answer) => answer.trim()) ? question.answers : [""];
    return { ...question, kind, choices: [], correctIds: [], answers };
  }
  const choices = question.choices.length >= 2 ? question.choices : [newChoice(), newChoice()];
  const kept = question.correctIds.filter((id) => choices.some((choice) => choice.id === id));
  const correctIds = kept.length ? (kind === "choice" ? [kept[0]] : kept) : [choices[0].id];
  return { ...question, kind, choices, correctIds, answers: [] };
}

export function splitAt(at: string): { minutes: string; seconds: string } {
  if (!at.trim()) return { minutes: "", seconds: "" };
  const total = Number(at);
  if (!Number.isInteger(total) || total < 0) return { minutes: "", seconds: "" };
  return { minutes: String(Math.floor(total / 60)), seconds: String(total % 60) };
}

export function joinAt(minutes: string, seconds: string): string {
  const minuteText = minutes.trim();
  const secondText = seconds.trim();
  if (!minuteText && !secondText) return "";
  if (!/^\d+$/.test(minuteText || "0") || !/^\d+$/.test(secondText || "0")) return "invalid";
  const minuteValue = Number(minuteText || "0");
  const secondValue = Number(secondText || "0");
  if (secondValue > 59 || minuteValue > 1440) return "invalid";
  return String(minuteValue * 60 + secondValue);
}

export function formatAt(at: string): string {
  const parts = splitAt(at);
  if (!at.trim()) return "After the video";
  if (!parts.minutes && !parts.seconds) return "Check the time";
  return `${parts.minutes}:${parts.seconds.padStart(2, "0")}`;
}

export function newVideo(): VideoItem {
  return { id: newId(), type: "video", title: "", url: "", questions: [] };
}

export function newQuiz(): QuizItem {
  return { id: newId(), type: "quiz", title: "", questions: [newQuestion()] };
}

export function newDeck(deck: { deckId: string; title: string; slides: DeckSlide[] }): DeckItem {
  return {
    id: newId(),
    type: "deck",
    title: deck.title,
    deckId: deck.deckId,
    slides: deck.slides,
  };
}

export function newLesson(): LessonGroup {
  return { id: newId(), title: "", items: [newVideo()] };
}

export const emptyForm: PackageForm = {
  version: "1.2",
  title: "",
  packageName: "",
  organization: "",
  language: "en",
  identifier: "",
  packageVersion: "1.0.0",
  masteryScore: "80",
  description: "",
  keywords: "",
  author: "",
  duration: "PT0H0M0S",
  typicalDuration: "PT0H0M0S",
  rights: "",
  vcardOrg: "",
  vcardTel: "",
  vcardAddress: "",
  vcardMail: "",
  vcardUrl: "",
  lessons: [newLesson()],
  note: "",
  completionThreshold: "90",
  requireQuizPass: true,
  posterName: "",
  posterDataUrl: "",
};

export function itemHref(lessonIndex: number, itemIndex: number, count: number): string {
  const lessonNumber = lessonIndex + 1;
  if (count <= 1) return `lesson-${lessonNumber}.html`;
  return `lesson-${lessonNumber}-${itemIndex + 1}.html`;
}

function requestQuestion(question: QuizQuestion, withTime: boolean): RequestQuestion {
  const at = withTime && question.at.trim() && question.at !== "invalid" ? Number(question.at) : null;
  if (question.kind === "fill-in") {
    return {
      kind: "fill-in",
      prompt: question.prompt.trim(),
      choices: [],
      correctIndexes: [],
      answers: question.answers.map((answer) => answer.trim()).filter(Boolean),
      at: withTime ? at : null,
    };
  }
  if (question.kind === "true-false") {
    const correct = question.choices.findIndex((choice) => question.correctIds.includes(choice.id));
    return {
      kind: "true-false",
      prompt: question.prompt.trim(),
      choices: ["True", "False"],
      correctIndexes: [correct === 1 ? 1 : 0],
      answers: [],
      at: withTime ? at : null,
    };
  }
  return {
    kind: question.kind,
    prompt: question.prompt.trim(),
    choices: question.choices.map((choice) => choice.text.trim()),
    correctIndexes: question.choices
      .map((choice, index) => (question.correctIds.includes(choice.id) ? index : -1))
      .filter((index) => index >= 0),
    answers: [],
    at: withTime ? at : null,
  };
}

export function newContentItem(common: ContentCommon, specific: Record<string, unknown>): ContentItem {
  return {
    id: newId(),
    type: "content",
    title: String(common.contentName || "").trim(),
    common,
    specific,
  };
}

function requestItem(item: LessonItem): RequestItem {
  if (item.type === "deck") {
    return {
      type: "deck",
      title: item.title.trim(),
      deckId: item.deckId,
      slides: item.slides,
    };
  }
  if (item.type === "content") {
    return {
      type: "content",
      title: item.title.trim() || item.common.contentName,
      common: item.common,
      specific: item.specific,
      questions: item.questions?.map((question) => requestQuestion(question, item.common.contentType === "VIDEO")),
    };
  }
  if (item.type === "quiz") {
    return {
      type: "quiz",
      title: item.title.trim(),
      questions: item.questions.map((question) => requestQuestion(question, false)),
    };
  }
  return {
    type: "video",
    title: item.title.trim(),
    url: item.url.trim(),
    questions: item.questions.map((question) => requestQuestion(question, true)),
  };
}

export function toRequest(form: PackageForm): PackageRequest {
  const keywords = form.keywords
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
  const lessons = form.lessons.map((lesson) => ({
    title: lesson.title.trim(),
    items: lesson.items.map(requestItem),
  }));
  const first = lessons[0]?.items[0];
  const startingPage = form.lessons[0]
    ? itemHref(0, 0, form.lessons[0].items.length)
    : "lesson-1.html";

  return {
    version: form.version,
    title: form.title.trim(),
    organization: form.organization.trim(),
    language: form.language.trim(),
    identifier: form.identifier.trim(),
    masteryScore: Number(form.masteryScore),
    startingPage: first ? startingPage : "lesson-1.html",
    lessons,
    completionThreshold: Number(form.completionThreshold),
    requireQuizPass: form.requireQuizPass,
    note: form.note.trim() || undefined,
    posterDataUrl: form.posterDataUrl || undefined,
    package: {
      name: form.packageName.trim() || form.title.trim(),
      version: form.packageVersion.trim() || "1.0.0",
      author: form.author.trim(),
      description: form.description.trim(),
      keywords,
      duration: form.duration.trim(),
      typicalDuration: form.typicalDuration.trim(),
      rights: form.rights.trim(),
      zip: true,
      vcard: {
        author: form.author.trim(),
        org: form.vcardOrg.trim(),
        tel: form.vcardTel.trim(),
        address: form.vcardAddress.trim(),
        mail: form.vcardMail.trim(),
        url: form.vcardUrl.trim(),
      },
    },
  };
}

export function applyDraft(form: PackageForm, draft: DraftResult, fillEmptyOnly: boolean): PackageForm {
  const pick = (current: string, next: string) =>
    fillEmptyOnly && current.trim() ? current : next || current;

  return {
    ...form,
    title: pick(form.title, draft.title),
    packageName: pick(form.packageName, draft.packageName || draft.title),
    identifier: pick(form.identifier, draft.identifier),
    description: pick(form.description, draft.description),
    keywords: pick(form.keywords, draft.keywords.join(", ")),
    author: pick(form.author, draft.author),
    duration: pick(form.duration, draft.duration),
    typicalDuration: pick(form.typicalDuration, draft.typicalDuration),
    rights: pick(form.rights, draft.rights),
    masteryScore: fillEmptyOnly && form.masteryScore.trim() ? form.masteryScore : String(draft.masteryScore),
    lessons: form.lessons.map((lesson, index) => {
      const drafted = draft.lessons[index];
      let videoCursor = 0;
      return {
        ...lesson,
        title: pick(lesson.title, drafted?.title || ""),
        items: lesson.items.map((item) => {
          if (item.type !== "video") return item;
          const videoTitle = drafted?.videos?.[videoCursor]?.title || "";
          videoCursor += 1;
          return { ...item, title: pick(item.title, videoTitle) };
        }),
      };
    }),
  };
}
