import type { PackageForm, QuizQuestion } from "./types";

const DURATION = /^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/;
const LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const IDENTIFIER = /^[A-Za-z0-9._:-]+$/;
const PACKAGE_VERSION = /^[0-9A-Za-z._-]+$/;

export function organizationId(organization: string): string {
  return organization.trim().replace(/ /g, "_");
}

export function manifestId(identifier: string): string {
  return identifier.trim().replace(/ /g, "");
}

function durationOk(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "PT" && DURATION.test(trimmed);
}

function httpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function questionErrors(
  question: QuizQuestion,
  key: string,
  label: string,
  withTime: boolean,
  errors: Record<string, string>
): void {
  if (!question.prompt.trim()) {
    errors[`quiz-prompt-${key}`] = `Enter ${label}.`;
  }
  if (withTime && question.at === "invalid") {
    errors[`quiz-time-${key}`] = "Enter minutes and seconds, or leave both blank.";
  }
  if (question.kind === "fill-in") {
    const answers = question.answers.map((answer) => answer.trim()).filter(Boolean);
    if (!answers.length || answers.length > 6 || answers.length !== question.answers.length) {
      errors[`quiz-answers-${key}`] = "Enter 1 to 6 accepted answers.";
    }
    return;
  }
  if (question.kind === "true-false") {
    if (question.correctIds.length !== 1) {
      errors[`quiz-correct-${key}`] = "Choose true or false.";
    }
    return;
  }
  const filled = question.choices.filter((choice) => choice.text.trim());
  if (question.choices.length < 2 || question.choices.length > 6 || filled.length !== question.choices.length) {
    errors[`quiz-choices-${key}`] = "Enter 2 to 6 choices.";
  }
  const marked = question.choices.filter((choice) => question.correctIds.includes(choice.id) && choice.text.trim());
  if (question.kind === "multi") {
    if (!marked.length) errors[`quiz-correct-${key}`] = "Mark at least one correct choice.";
    return;
  }
  if (marked.length !== 1) errors[`quiz-correct-${key}`] = "Mark one correct choice.";
}

export function validateLessons(
  form: PackageForm,
  options?: { quizzes?: boolean }
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.organization.trim()) {
    errors.organization = "Enter an organization.";
  }
  if (!form.lessons.length) {
    errors.lessons = "Add at least one lesson.";
  }
  form.lessons.forEach((lesson, lessonIndex) => {
    if (!lesson.items.length) {
      errors[`lesson-items-${lessonIndex}`] = "Add a video, a quiz, or a slide deck.";
      return;
    }
    lesson.items.forEach((item, itemIndex) => {
      if (item.type === "video") {
        const url = item.url.trim();
        if (!url || !httpsUrl(url)) {
          errors[`item-url-${lessonIndex}-${itemIndex}`] = "Enter an https file URL or a YouTube link.";
        }
      }
      if (item.type === "deck") {
        if (!item.deckId || !item.slides.length) {
          errors[`deck-${lessonIndex}-${itemIndex}`] = "Upload the PowerPoint file again.";
        }
        return;
      }
      if (!options?.quizzes) return;
      if (item.type === "quiz" && !item.questions.length) {
        errors[`quiz-${lessonIndex}-${itemIndex}`] = "Add a question.";
        return;
      }
      if (item.questions.length > 20) {
        errors[`quiz-${lessonIndex}-${itemIndex}`] = "Use 20 questions or fewer.";
        return;
      }
      item.questions.forEach((question, questionIndex) => {
        questionErrors(
          question,
          `${lessonIndex}-${itemIndex}-${questionIndex}`,
          "a question",
          item.type === "video",
          errors
        );
      });
    });
  });
  return errors;
}

export function needsDraft(form: PackageForm): boolean {
  return !form.title.trim() || !form.identifier.trim() || !form.description.trim();
}

export function validateForm(form: PackageForm): Record<string, string> {
  const errors = validateLessons(form, { quizzes: true });

  if (!form.title.trim()) {
    errors.title = "Enter a course title.";
  }
  if (!form.identifier.trim()) {
    errors.identifier = "Enter an identifier.";
  } else if (!IDENTIFIER.test(form.identifier.trim())) {
    errors.identifier = "Use letters, numbers, dots, hyphens, or underscores.";
  }

  const mastery = Number(form.masteryScore);
  if (!Number.isFinite(mastery) || mastery < 0 || mastery > 100) {
    errors.masteryScore = "Enter a mastery score from 0 to 100.";
  }

  if (!durationOk(form.duration)) {
    errors.duration = "Use a duration like PT0H5M0S.";
  }
  if (!durationOk(form.typicalDuration)) {
    errors.typicalDuration = "Use a duration like PT0H5M0S.";
  }

  if (!LANGUAGE.test(form.language.trim())) {
    errors.language = "Enter a language code such as en or fr-FR.";
  }

  const version = form.packageVersion.trim() || "1.0.0";
  if (!PACKAGE_VERSION.test(version)) {
    errors.packageVersion = "Use a version such as 1.0.0.";
  }

  const threshold = Number(form.completionThreshold);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
    errors.completionThreshold = "Enter a completion threshold from 1 to 100.";
  }

  const contact = form.vcardUrl.trim();
  if (contact) {
    try {
      const url = new URL(contact);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        errors.vcardUrl = "Contact URL must start with http or https.";
      }
    } catch {
      errors.vcardUrl = "Contact URL must start with http or https.";
    }
  }

  return errors;
}
