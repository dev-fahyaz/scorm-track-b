import type { InteractionRecord } from "./runtime";
import { decodeMarks, encodeMarks, type StoredMark } from "./suspend";

export type QuestionKind = "choice" | "true-false" | "multi" | "fill-in";

export interface PlayQuestion {
  kind: QuestionKind;
  prompt: string;
  choices: string[];
  correctIndexes: number[];
  answers: string[];
  at: number | null;
}

export interface SubmittedAnswer {
  indexes: number[];
  text: string;
}

export interface QuizResult {
  score: number;
  answers: SubmittedAnswer[];
  interactions: InteractionRecord[];
}

interface MediaControls {
  pause(): void;
  play(): void;
  seek(seconds: number): void;
}

function secondsAt(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < 0 || number > 86400) return null;
  return number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is number => Number.isInteger(entry) && entry >= 0);
}

export function readQuestions(value: unknown, withTime: boolean): PlayQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => readQuestion(entry, withTime));
}

function readQuestion(entry: unknown, withTime: boolean): PlayQuestion {
  const raw = asRecord(entry);
  const kind: QuestionKind = raw.kind === "true-false" || raw.kind === "multi" || raw.kind === "fill-in"
    ? raw.kind
    : "choice";
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const at = withTime ? secondsAt(raw.at) : null;
  if (kind === "fill-in") {
    const answers = Array.isArray(raw.answers) ? raw.answers.map((answer) => String(answer)) : [];
    return { kind, prompt, choices: [], correctIndexes: [], answers, at };
  }
  if (kind === "true-false") {
    const picked = numberList(raw.correctIndexes)[0] === 1 ? 1 : 0;
    return { kind, prompt, choices: ["True", "False"], correctIndexes: [picked], answers: [], at };
  }
  const choices = Array.isArray(raw.choices) ? raw.choices.map((choice) => String(choice)) : [];
  const fromList = numberList(raw.correctIndexes);
  const indexes = fromList.length ? fromList : Number.isInteger(raw.correctIndex) ? [Number(raw.correctIndex)] : [];
  const correctIndexes = indexes.filter((index, position) => index < choices.length && indexes.indexOf(index) === position);
  return {
    kind,
    prompt,
    choices,
    correctIndexes: kind === "choice" ? correctIndexes.slice(0, 1) : correctIndexes,
    answers: [],
    at,
  };
}

export function grade(question: PlayQuestion, answer: SubmittedAnswer): boolean {
  if (question.kind === "fill-in") {
    const typed = answer.text.trim().toLowerCase();
    return question.answers.some((accepted) => accepted.trim().toLowerCase() === typed);
  }
  const chosen = [...answer.indexes].sort((left, right) => left - right);
  const correct = [...question.correctIndexes].sort((left, right) => left - right);
  if (!chosen.length || chosen.some((index) => !question.choices[index])) return false;
  if (question.kind === "multi") {
    return chosen.length === correct.length && chosen.every((index, position) => index === correct[position]);
  }
  return chosen.length === 1 && correct.includes(chosen[0]);
}

function letters(indexes: number[]): string {
  return [...indexes].sort((left, right) => left - right).map((index) => String.fromCharCode(97 + index)).join(",");
}

export function interactionFor(
  question: PlayQuestion,
  index: number,
  answer: SubmittedAnswer,
  correct: boolean
): InteractionRecord {
  const result = correct ? "correct" : "wrong";
  if (question.kind === "fill-in") {
    return {
      id: `q${index + 1}`,
      type: "fill-in",
      response: answer.text.trim(),
      correct: question.answers.map((accepted) => accepted.trim()).filter(Boolean),
      result,
    };
  }
  if (question.kind === "true-false") {
    const token = answer.indexes[0] === 1 ? "false" : "true";
    return {
      id: `q${index + 1}`,
      type: "true-false",
      response: token,
      correct: [question.correctIndexes[0] === 1 ? "false" : "true"],
      result,
    };
  }
  return {
    id: `q${index + 1}`,
    type: "choice",
    response: letters(answer.indexes),
    correct: [letters(question.correctIndexes)],
    result,
  };
}

function answerFromMark(question: PlayQuestion, response: string): SubmittedAnswer {
  if (question.kind === "fill-in") return { indexes: [], text: response };
  const indexes = response.split(".").map(Number).filter((index) => Number.isInteger(index));
  return { indexes, text: "" };
}

function storedResponse(question: PlayQuestion, answer: SubmittedAnswer): string {
  if (question.kind === "fill-in") return answer.text.trim();
  return answer.indexes.join(".");
}

export function reviewFromMarks(
  questions: PlayQuestion[],
  saved: string
): { answers: SubmittedAnswer[]; score: number; correct: number } | null {
  const marks = decodeMarks(saved, questions.length);
  if (!questions.length || marks.some((mark) => mark.state === ".")) return null;
  const answers = questions.map((question, index) => answerFromMark(question, marks[index].response));
  const correct = marks.filter((mark) => mark.state === "1").length;
  return { answers, score: Math.round((correct / questions.length) * 100), correct };
}

export function marksForAnswers(questions: PlayQuestion[], answers: SubmittedAnswer[]): StoredMark[] {
  return answers.map((answer, index) => ({
    state: grade(questions[index], answer) ? "1" : "0",
    response: storedResponse(questions[index], answer),
  }));
}

function fieldMessage(text: string): HTMLParagraphElement {
  const message = document.createElement("p");
  message.className = "quiz-note";
  message.textContent = text;
  return message;
}

function showOverlay(root: HTMLElement): void {
  root.classList.add("on", "overlay");
}

function panelHost(root: HTMLElement): HTMLElement {
  const existing = root.querySelector<HTMLElement>(".quiz-panel");
  if (existing) return existing;
  const box = document.createElement("div");
  box.className = "quiz-panel";
  root.append(box);
  return box;
}

function hideOverlay(root: HTMLElement): void {
  root.classList.remove("on", "overlay");
}

function submitButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = label;
  return button;
}

function markPicked(group: HTMLElement): void {
  group.querySelectorAll<HTMLLabelElement>("label.choice").forEach((label) => {
    const input = label.querySelector("input");
    label.classList.toggle("picked", Boolean(input?.checked));
  });
}

function choiceControls(question: PlayQuestion, index: number, selected: number[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "choices";
  question.choices.forEach((choice, choiceIndex) => {
    const label = document.createElement("label");
    label.className = "choice";
    const input = document.createElement("input");
    input.type = question.kind === "multi" ? "checkbox" : "radio";
    input.name = `q-${index}`;
    input.value = String(choiceIndex);
    input.checked = selected.includes(choiceIndex);
    const text = document.createElement("span");
    text.textContent = choice;
    label.append(input, text);
    input.addEventListener("change", () => markPicked(group));
    group.append(label);
  });
  markPicked(group);
  return group;
}

function readAnswer(form: HTMLFormElement, question: PlayQuestion, index: number): SubmittedAnswer | null {
  if (question.kind === "fill-in") {
    const field = form.querySelector<HTMLInputElement>(`input[name="q-${index}"]`);
    const text = field?.value.trim() || "";
    return text ? { indexes: [], text } : null;
  }
  const selected = Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="q-${index}"]:checked`));
  if (!selected.length) return null;
  return { indexes: selected.map((input) => Number(input.value)), text: "" };
}

function appendQuestion(
  form: HTMLFormElement,
  question: PlayQuestion,
  index: number,
  initial?: SubmittedAnswer
): void {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = question.prompt;
  fieldset.append(legend);
  if (question.kind === "fill-in") {
    const input = document.createElement("input");
    input.type = "text";
    input.name = `q-${index}`;
    input.autocomplete = "off";
    input.placeholder = "Your answer";
    if (initial?.text) input.value = initial.text;
    fieldset.append(input);
  } else {
    fieldset.append(choiceControls(question, index, initial?.indexes || []));
  }
  form.append(fieldset);
}

export interface MountQuizOptions {
  title?: string;
  initial?: SubmittedAnswer[];
  locked?: boolean;
  note?: string;
}

export function mountQuiz(
  root: HTMLElement,
  questions: PlayQuestion[],
  onSubmit: (result: QuizResult) => void,
  options?: MountQuizOptions
): void {
  root.replaceChildren();
  const form = document.createElement("form");
  form.className = "quiz-panel";
  const message = fieldMessage(options?.note || "");
  if (options?.title) {
    const heading = document.createElement("h2");
    heading.textContent = options.title;
    form.append(heading);
  }
  questions.forEach((question, index) => appendQuestion(form, question, index, options?.initial?.[index]));
  const button = submitButton("Submit quiz");
  form.append(message, button);
  if (options?.locked) {
    form.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      input.disabled = true;
    });
    button.disabled = true;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (options?.locked) return;
    const answers: SubmittedAnswer[] = [];
    for (let index = 0; index < questions.length; index += 1) {
      const answer = readAnswer(form, questions[index], index);
      if (!answer) {
        message.textContent = "Answer every question.";
        return;
      }
      answers.push(answer);
    }
    const interactions = answers.map((answer, index) => (
      interactionFor(questions[index], index, answer, grade(questions[index], answer))
    ));
    const correct = interactions.filter((record) => record.result === "correct").length;
    const score = Math.round((correct / questions.length) * 100);
    message.textContent = `Score ${score}. ${correct} of ${questions.length} correct.`;
    button.disabled = true;
    form.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      input.disabled = true;
    });
    onSubmit({ score, answers, interactions });
  });
  root.append(form);
}

export function mountPrompt(
  root: HTMLElement,
  question: PlayQuestion,
  label: string,
  onAnswer: (answer: SubmittedAnswer) => void
): void {
  root.replaceChildren();
  const form = document.createElement("form");
  form.className = "quiz-panel";
  const heading = document.createElement("h2");
  heading.textContent = label;
  const message = fieldMessage("");
  form.append(heading);
  appendQuestion(form, question, 0);
  form.append(message, submitButton("Continue"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const answer = readAnswer(form, question, 0);
    if (!answer) {
      message.textContent = "Answer the question.";
      return;
    }
    onAnswer(answer);
  });
  root.append(form);
}

export interface CheckpointSession {
  onTime(current: number, duration: number): void;
  onEnded(): void;
  resume(): void;
  isLocked(): boolean;
  outcome(): { score: number | null; passed: boolean | null };
  marks(): string;
  interactions(): InteractionRecord[];
}

export function createCheckpointSession(options: {
  questions: PlayQuestion[];
  savedMarks: string;
  root: HTMLElement;
  mastery: number;
  requirePass: boolean;
  media: MediaControls;
  onChange(): void;
}): CheckpointSession {
  let marks: StoredMark[] = decodeMarks(options.savedMarks, options.questions.length);
  let locked = false;
  let ended = false;
  let activeIndex: number | null = null;

  const outcome = () => {
    if (!options.questions.length || marks.some((mark) => mark.state === ".")) {
      return { score: null, passed: null };
    }
    const correct = marks.filter((mark) => mark.state === "1").length;
    const score = Math.round((correct / options.questions.length) * 100);
    return { score, passed: score >= options.mastery };
  };

  const interactions = (): InteractionRecord[] => {
    const records: InteractionRecord[] = [];
    options.questions.forEach((question, index) => {
      const mark = marks[index];
      if (!mark || mark.state === ".") return;
      const answer = answerFromMark(question, mark.response);
      records.push(interactionFor(question, index, answer, mark.state === "1"));
    });
    return records;
  };

  const showRetry = (score: number) => {
    locked = true;
    options.media.pause();
    showOverlay(options.root);
    const note = fieldMessage(
      `Score ${score}. Mastery is ${options.mastery}. This item stays incomplete until the quiz is passed.`
    );
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Retry questions";
    const host = panelHost(options.root);
    button.addEventListener("click", () => {
      marks = options.questions.map(() => ({ state: ".", response: "" }));
      ended = false;
      locked = false;
      activeIndex = null;
      hideOverlay(options.root);
      options.root.replaceChildren();
      options.onChange();
      const firstTimed = options.questions.findIndex((question) => question.at != null);
      if (firstTimed >= 0) {
        reveal(firstTimed);
        return;
      }
      ended = true;
      revealEnd(options.questions.map((_, index) => index));
    });
    host.append(note, button);
  };

  const afterAnswer = () => {
    options.onChange();
    const result = outcome();
    if (result.passed === false && options.requirePass && result.score != null) {
      showRetry(result.score);
      return;
    }
    if (ended) {
      settleEnd();
      return;
    }
    options.media.play();
  };

  const reveal = (index: number) => {
    const question = options.questions[index];
    locked = true;
    activeIndex = index;
    options.media.pause();
    if (question.at != null) options.media.seek(question.at);
    showOverlay(options.root);
    mountPrompt(
      options.root,
      question,
      `Question ${index + 1} of ${options.questions.length}`,
      (answer) => {
        const correct = grade(question, answer);
        marks[index] = { state: correct ? "1" : "0", response: storedResponse(question, answer) };
        locked = false;
        activeIndex = null;
        hideOverlay(options.root);
        options.root.replaceChildren();
        afterAnswer();
      }
    );
  };

  const revealEnd = (indexes: number[]) => {
    locked = true;
    activeIndex = null;
    options.media.pause();
    showOverlay(options.root);
    const slice = indexes.map((index) => options.questions[index]);
    mountQuiz(options.root, slice, (result) => {
      result.answers.forEach((answer, offset) => {
        const index = indexes[offset];
        marks[index] = {
          state: grade(slice[offset], answer) ? "1" : "0",
          response: storedResponse(slice[offset], answer),
        };
      });
      const overall = outcome();
      const message = options.root.querySelector("form p");
      if (message && overall.score != null) {
        const correct = marks.filter((mark) => mark.state === "1").length;
        message.textContent = `Score ${overall.score}. ${correct} of ${options.questions.length} correct.`;
      }
      locked = false;
      afterAnswer();
    }, { title: "Check your understanding" });
  };

  const nextTimed = (current: number): number | null => {
    let bestIndex = -1;
    let bestAt = Number.POSITIVE_INFINITY;
    options.questions.forEach((question, index) => {
      if (question.at == null || marks[index]?.state !== ".") return;
      if (question.at > current + 0.35) return;
      if (question.at < bestAt) {
        bestAt = question.at;
        bestIndex = index;
      }
    });
    return bestIndex >= 0 ? bestIndex : null;
  };

  const settleEnd = () => {
    if (locked) return;
    const overdue = options.questions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => question.at != null && marks[index]?.state === ".")
      .sort((left, right) => (left.question.at || 0) - (right.question.at || 0));
    if (overdue.length) {
      reveal(overdue[0].index);
      return;
    }
    const end = options.questions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => question.at == null && marks[index]?.state === ".")
      .map(({ index }) => index);
    if (end.length) {
      revealEnd(end);
      return;
    }
    const result = outcome();
    if (result.passed === false && options.requirePass && result.score != null) showRetry(result.score);
  };

  return {
    onTime(current) {
      if (!options.questions.length) return;
      if (locked && activeIndex != null) {
        const at = options.questions[activeIndex].at;
        if (at != null && Math.abs(current - at) > 1.25) options.media.seek(at);
        options.media.pause();
        return;
      }
      if (locked) return;
      const index = nextTimed(current);
      if (index == null) return;
      reveal(index);
    },
    onEnded() {
      ended = true;
      settleEnd();
    },
    resume() {
      const result = outcome();
      if (result.passed === false && options.requirePass && result.score != null) showRetry(result.score);
    },
    isLocked: () => locked,
    outcome,
    marks: () => encodeMarks(marks),
    interactions,
  };
}
