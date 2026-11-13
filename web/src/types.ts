export type ScormVersion = "1.2" | "2004 3rd Edition" | "2004 4th Edition";

export interface QuizChoice {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: QuizChoice[];
  correctId: string;
}

export interface VideoItem {
  id: string;
  type: "video";
  title: string;
  url: string;
}

export interface QuizItem {
  id: string;
  type: "quiz";
  title: string;
  questions: QuizQuestion[];
}

export type LessonItem = VideoItem | QuizItem;

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
  posterName: string;
  posterDataUrl: string;
}

export interface RequestQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export interface RequestItem {
  type: "video" | "quiz";
  title: string;
  url?: string;
  questions?: RequestQuestion[];
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
  return { id: newId(), prompt: "", choices: [first, second], correctId: first.id };
}

export function newVideo(): VideoItem {
  return { id: newId(), type: "video", title: "", url: "" };
}

export function newQuiz(): QuizItem {
  return { id: newId(), type: "quiz", title: "", questions: [newQuestion()] };
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
  posterName: "",
  posterDataUrl: "",
};

export function itemHref(lessonIndex: number, itemIndex: number, count: number): string {
  const lessonNumber = lessonIndex + 1;
  if (count <= 1) return `lesson-${lessonNumber}.html`;
  return `lesson-${lessonNumber}-${itemIndex + 1}.html`;
}

function requestItem(item: LessonItem): RequestItem {
  if (item.type === "quiz") {
    return {
      type: "quiz",
      title: item.title.trim(),
      questions: item.questions.map((question) => ({
        prompt: question.prompt.trim(),
        choices: question.choices.map((choice) => choice.text.trim()),
        correctIndex: Math.max(0, question.choices.findIndex((choice) => choice.id === question.correctId)),
      })),
    };
  }
  return {
    type: "video",
    title: item.title.trim(),
    url: item.url.trim(),
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
