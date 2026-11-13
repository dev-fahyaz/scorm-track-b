import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { buildPackage, downloadBlob, draftCourse, importPackage } from "./api";
import {
  applyDraft,
  emptyForm,
  itemHref,
  newLesson,
  newQuestion,
  newQuiz,
  newVideo,
  toRequest,
  type LessonGroup,
  type LessonItem,
  type PackageForm,
  type QuizItem,
  type ScormVersion,
} from "./types";
import { manifestId, needsDraft, organizationId, validateForm, validateLessons } from "./validate";

const VERSIONS: ScormVersion[] = ["1.2", "2004 3rd Edition", "2004 4th Edition"];

export function App() {
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"draft" | "build" | "import" | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  function update<K extends keyof PackageForm>(key: K, value: PackageForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateLessons(change: (lessons: LessonGroup[]) => LessonGroup[]) {
    setForm((current) => ({ ...current, lessons: change(current.lessons) }));
  }

  function updateLesson(id: string, change: (lesson: LessonGroup) => LessonGroup) {
    updateLessons((lessons) => lessons.map((lesson) => (lesson.id === id ? change(lesson) : lesson)));
  }

  function updateItem(lessonId: string, itemId: string, change: (item: LessonItem) => LessonItem) {
    updateLesson(lessonId, (lesson) => ({
      ...lesson,
      items: lesson.items.map((item) => (item.id === itemId ? change(item) : item)),
    }));
  }

  async function onPoster(file: File | undefined) {
    if (!file) {
      update("posterName", "");
      update("posterDataUrl", "");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((current) => ({
        ...current,
        poster: "Use a JPEG, PNG, or WebP poster.",
      }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        poster: "Poster must be 2 MB or smaller.",
      }));
      return;
    }
    const dataUrl = await readFile(file);
    setErrors((current) => {
      const next = { ...current };
      delete next.poster;
      return next;
    });
    setForm((current) => ({
      ...current,
      posterName: file.name,
      posterDataUrl: dataUrl,
    }));
  }

  async function runDraft(current: PackageForm, fillEmptyOnly: boolean): Promise<PackageForm> {
    const drafted = await draftCourse(toRequest(current));
    const next = applyDraft(current, drafted, fillEmptyOnly);
    setForm(next);
    return next;
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    const hasWork = Boolean(form.organization.trim()) || form.lessons.some((lesson) =>
      lesson.items.some((item) => item.type === "video" && item.url.trim())
    );
    if (hasWork && !window.confirm("Replace the current course with this zip?")) return;
    setBusy("import");
    setMessage("");
    setFailed(false);
    try {
      const next = await importPackage(file);
      setForm(next);
      setErrors({});
      setMessage(`Opened ${file.name}.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "The zip could not be opened.");
    } finally {
      setBusy(null);
    }
  }

  async function onDraft() {
    const nextErrors = validateLessons(form, { quizzes: false });
    setErrors(nextErrors);
    setMessage("");
    setFailed(false);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setBusy("draft");
    try {
      await runDraft(form, false);
      setMessage("Drafted the course record. Review it, then build the zip.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Draft failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lessonErrors = validateLessons(form, { quizzes: true });
    setMessage("");
    setFailed(false);
    const firstLessonError = Object.keys(lessonErrors)[0];
    if (firstLessonError) {
      setErrors(lessonErrors);
      document.getElementById(firstLessonError)?.focus();
      return;
    }

    setBusy("build");
    try {
      let current = form;
      if (needsDraft(current)) {
        current = await runDraft(current, true);
      }
      const nextErrors = validateForm(current);
      setErrors(nextErrors);
      const first = Object.keys(nextErrors)[0];
      if (first) {
        document.getElementById(first)?.focus();
        return;
      }
      const result = await buildPackage(toRequest(current));
      downloadBlob(result.blob, result.filename);
      setMessage(`Downloaded ${result.filename}.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Build failed.");
    } finally {
      setBusy(null);
    }
  }

  const org = organizationId(form.organization) || "—";
  const id = manifestId(form.identifier) || "course";
  const itemTitle = form.title.trim() || "—";
  const rightsHint = form.organization.trim()
    ? `Defaults to © ${form.organization.trim()}. All rights reserved.`
    : "Defaults to a copyright line for the organization.";
  const lessonCount = form.lessons.length;

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Track B</p>
          <h1>SCORM export</h1>
          <p className="lede">
            Group videos and quizzes into lessons. Draft fills the course record,
            then the packager writes a zip Track A can launch.
          </p>
        </div>
        <div className="version-pill">
          {lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`} · {form.version}
        </div>
      </header>

      <form onSubmit={onSubmit} noValidate>
        <section>
          <h2>Lessons</h2>
          <p className="section-note">
            Each lesson can hold videos and quizzes. A video is an https file or a YouTube link. The files stay on their host. The zip contains the player, not the media.
          </p>
          <div className="file-row">
            <button
              type="button"
              className="text-button"
              disabled={busy !== null}
              onClick={() => importInput.current?.click()}
            >
              {busy === "import" ? "Opening…" : "Open zip"}
            </button>
            <input
              ref={importInput}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                void onImport(file);
              }}
            />
          </div>
          <div className="grid">
            <Field label="SCORM version" name="version">
              <select
                id="version"
                value={form.version}
                onChange={(event) => update("version", event.target.value as ScormVersion)}
              >
                {VERSIONS.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </Field>
            <Text
              label="Organization"
              name="organization"
              value={form.organization}
              error={errors.organization}
              onChange={(value) => update("organization", value)}
            />
          </div>
          <div className="lesson-list">
            {form.lessons.map((lesson, lessonIndex) => (
              <article className="lesson-card" key={lesson.id}>
                <div className="lesson-head">
                  <Field label={`Lesson ${lessonIndex + 1} title`} name={`lesson-title-${lessonIndex}`}>
                    <input
                      id={`lesson-title-${lessonIndex}`}
                      value={lesson.title}
                      placeholder="Filled by the draft"
                      onChange={(event) =>
                        updateLesson(lesson.id, (current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="text-button"
                    disabled={form.lessons.length === 1}
                    onClick={() => updateLessons((lessons) => lessons.filter((item) => item.id !== lesson.id))}
                  >
                    Remove
                  </button>
                </div>
                {errors[`lesson-items-${lessonIndex}`] ? (
                  <p className="error">{errors[`lesson-items-${lessonIndex}`]}</p>
                ) : null}
                {lesson.items.map((item, itemIndex) => (
                  <SubLesson
                    key={item.id}
                    lesson={lesson}
                    item={item}
                    lessonIndex={lessonIndex}
                    itemIndex={itemIndex}
                    errors={errors}
                    onChange={(change) => updateItem(lesson.id, item.id, change)}
                    onRemove={() =>
                      updateLesson(lesson.id, (current) => ({
                        ...current,
                        items: current.items.filter((entry) => entry.id !== item.id),
                      }))
                    }
                  />
                ))}
                <div className="file-row">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      updateLesson(lesson.id, (current) => ({ ...current, items: [...current.items, newVideo()] }))
                    }
                  >
                    Add video
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      updateLesson(lesson.id, (current) => ({ ...current, items: [...current.items, newQuiz()] }))
                    }
                  >
                    Add quiz
                  </button>
                </div>
              </article>
            ))}
          </div>
          {errors.lessons ? <p className="error">{errors.lessons}</p> : null}
          <div className="file-row">
            <button
              type="button"
              className="text-button"
              onClick={() => updateLessons((lessons) => [...lessons, newLesson()])}
            >
              Add lesson
            </button>
          </div>
          <div className="grid" style={{ marginTop: 16 }}>
            <Text
              label="Note for the draft"
              name="note"
              value={form.note}
              placeholder="Optional. What this course is about."
              onChange={(value) => update("note", value)}
              wide
            />
            <Text
              label="Completion threshold (%)"
              name="completionThreshold"
              value={form.completionThreshold}
              error={errors.completionThreshold}
              onChange={(value) => update("completionThreshold", value)}
              inputMode="numeric"
            />
            <Field label="Poster" name="poster" error={errors.poster}>
              <div className="file-row">
                <input
                  id="poster"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void onPoster(event.target.files?.[0])}
                />
                {form.posterName ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      update("posterName", "");
                      update("posterDataUrl", "");
                    }}
                  >
                    Remove {form.posterName}
                  </button>
                ) : null}
              </div>
            </Field>
          </div>
        </section>

        <section>
          <h2>Course structure</h2>
          <p className="section-note">
            A lesson with one sub-lesson is a single launch file. A lesson with more becomes a folder of launch files. No sequencing rules.
          </p>
          <ul className="tree">
            <li>
              <strong>Organization</strong> <span className="muted">{org}</span>
              <ul>
                <li>Title: {itemTitle}</li>
                {form.lessons.map((lesson, lessonIndex) => (
                  <StructureNode key={lesson.id} lesson={lesson} lessonIndex={lessonIndex} manifest={id} />
                ))}
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h2>Identity and metadata</h2>
          <p className="section-note">
            Draft course fills these. You can edit them before building.
          </p>
          <div className="grid">
            <Text
              label="Course title"
              name="title"
              value={form.title}
              error={errors.title}
              onChange={(value) => update("title", value)}
              wide
            />
            <Text
              label="Package name"
              name="packageName"
              value={form.packageName}
              placeholder="Defaults to the course title"
              onChange={(value) => update("packageName", value)}
            />
            <Text
              label="Package version"
              name="packageVersion"
              value={form.packageVersion}
              error={errors.packageVersion}
              onChange={(value) => update("packageVersion", value)}
            />
            <Text
              label="Language"
              name="language"
              value={form.language}
              error={errors.language}
              onChange={(value) => update("language", value)}
            />
            <Text
              label="Identifier"
              name="identifier"
              value={form.identifier}
              error={errors.identifier}
              onChange={(value) => update("identifier", value)}
            />
            <Text
              label="Mastery score"
              name="masteryScore"
              value={form.masteryScore}
              error={errors.masteryScore}
              onChange={(value) => update("masteryScore", value)}
              inputMode="decimal"
            />
            <Field label="Description" name="description" error={errors.description} wide>
              <textarea
                id="description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>
            <Text
              label="Keywords"
              name="keywords"
              value={form.keywords}
              placeholder="security, awareness"
              onChange={(value) => update("keywords", value)}
              wide
            />
            <Text
              label="Author"
              name="author"
              value={form.author}
              onChange={(value) => update("author", value)}
            />
            <Text
              label="Duration"
              name="duration"
              value={form.duration}
              error={errors.duration}
              onChange={(value) => update("duration", value)}
            />
            <Text
              label="Typical duration"
              name="typicalDuration"
              value={form.typicalDuration}
              error={errors.typicalDuration}
              onChange={(value) => update("typicalDuration", value)}
            />
            <Text
              label="Rights"
              name="rights"
              value={form.rights}
              placeholder={rightsHint}
              onChange={(value) => update("rights", value)}
              wide
            />
            <Text
              label="Contact organization"
              name="vcardOrg"
              value={form.vcardOrg}
              onChange={(value) => update("vcardOrg", value)}
            />
            <Text
              label="Telephone"
              name="vcardTel"
              value={form.vcardTel}
              onChange={(value) => update("vcardTel", value)}
            />
            <Text
              label="Address"
              name="vcardAddress"
              value={form.vcardAddress}
              onChange={(value) => update("vcardAddress", value)}
              wide
            />
            <Text
              label="Email"
              name="vcardMail"
              value={form.vcardMail}
              onChange={(value) => update("vcardMail", value)}
            />
            <Text
              label="Website"
              name="vcardUrl"
              value={form.vcardUrl}
              error={errors.vcardUrl}
              onChange={(value) => update("vcardUrl", value)}
            />
          </div>
        </section>

        <div className="actions">
          {message ? (
            <p className={failed ? "banner error" : "banner ok"} role="status">
              {message}
            </p>
          ) : (
            <span />
          )}
          <div className="button-row">
            <button type="button" className="secondary" disabled={busy !== null} onClick={() => void onDraft()}>
              {busy === "draft" ? "Drafting…" : "Draft course"}
            </button>
            <button type="submit" disabled={busy !== null}>
              {busy === "build" ? "Building zip…" : "Build SCORM zip"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

function SubLesson(props: {
  lesson: LessonGroup;
  item: LessonItem;
  lessonIndex: number;
  itemIndex: number;
  errors: Record<string, string>;
  onChange: (change: (item: LessonItem) => LessonItem) => void;
  onRemove: () => void;
}) {
  const { item, lessonIndex, itemIndex } = props;
  const urlKey = `item-url-${lessonIndex}-${itemIndex}`;
  return (
    <div className="sublesson">
      <div className="lesson-head">
        <p className="sublesson-label">{item.type === "quiz" ? "Quiz" : "Video"}</p>
        <button
          type="button"
          className="text-button"
          disabled={props.lesson.items.length === 1}
          onClick={props.onRemove}
        >
          Remove
        </button>
      </div>
      {item.type === "video" ? (
        <div className="grid">
          <Field label="Video title" name={`video-title-${lessonIndex}-${itemIndex}`}>
            <input
              id={`video-title-${lessonIndex}-${itemIndex}`}
              value={item.title}
              placeholder="Filled by the draft"
              onChange={(event) =>
                props.onChange((current) =>
                  current.type === "video" ? { ...current, title: event.target.value } : current
                )
              }
            />
          </Field>
          <Field label="Video URL" name={urlKey} error={props.errors[urlKey]}>
            <input
              id={urlKey}
              value={item.url}
              placeholder="https://…/video.mp4 or a YouTube link"
              aria-invalid={props.errors[urlKey] ? true : undefined}
              onChange={(event) =>
                props.onChange((current) =>
                  current.type === "video" ? { ...current, url: event.target.value } : current
                )
              }
            />
          </Field>
        </div>
      ) : (
        <QuizEditor
          item={item}
          lessonIndex={lessonIndex}
          itemIndex={itemIndex}
          errors={props.errors}
          onChange={props.onChange}
        />
      )}
    </div>
  );
}

function QuizEditor(props: {
  item: QuizItem;
  lessonIndex: number;
  itemIndex: number;
  errors: Record<string, string>;
  onChange: (change: (item: LessonItem) => LessonItem) => void;
}) {
  const { item, lessonIndex, itemIndex } = props;
  const quizKey = `quiz-${lessonIndex}-${itemIndex}`;
  function edit(change: (quiz: QuizItem) => QuizItem) {
    props.onChange((current) => (current.type === "quiz" ? change(current) : current));
  }
  return (
    <div className="quiz-editor">
      <Field label="Quiz title" name={quizKey} error={props.errors[quizKey]}>
        <input
          id={quizKey}
          value={item.title}
          placeholder="Quiz"
          onChange={(event) => edit((quiz) => ({ ...quiz, title: event.target.value }))}
        />
      </Field>
      {item.questions.map((question, questionIndex) => {
        const key = `${lessonIndex}-${itemIndex}-${questionIndex}`;
        return (
          <div className="question" key={question.id}>
            <Field label={`Question ${questionIndex + 1}`} name={`quiz-prompt-${key}`} error={props.errors[`quiz-prompt-${key}`]}>
              <input
                id={`quiz-prompt-${key}`}
                value={question.prompt}
                onChange={(event) =>
                  edit((quiz) => ({
                    ...quiz,
                    questions: quiz.questions.map((entry) =>
                      entry.id === question.id ? { ...entry, prompt: event.target.value } : entry
                    ),
                  }))
                }
              />
            </Field>
            {props.errors[`quiz-choices-${key}`] ? <p className="error">{props.errors[`quiz-choices-${key}`]}</p> : null}
            {props.errors[`quiz-correct-${key}`] ? <p className="error">{props.errors[`quiz-correct-${key}`]}</p> : null}
            <div className="choice-list">
              {question.choices.map((choice, choiceIndex) => (
                <div className="choice-row" key={choice.id}>
                  <label className="correct-mark">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={question.correctId === choice.id}
                      onChange={() =>
                        edit((quiz) => ({
                          ...quiz,
                          questions: quiz.questions.map((entry) =>
                            entry.id === question.id ? { ...entry, correctId: choice.id } : entry
                          ),
                        }))
                      }
                    />
                    Correct
                  </label>
                  <input
                    aria-label={`Choice ${choiceIndex + 1}`}
                    value={choice.text}
                    onChange={(event) =>
                      edit((quiz) => ({
                        ...quiz,
                        questions: quiz.questions.map((entry) =>
                          entry.id === question.id
                            ? {
                                ...entry,
                                choices: entry.choices.map((option) =>
                                  option.id === choice.id ? { ...option, text: event.target.value } : option
                                ),
                              }
                            : entry
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="text-button"
                    disabled={question.choices.length <= 2}
                    onClick={() =>
                      edit((quiz) => ({
                        ...quiz,
                        questions: quiz.questions.map((entry) => {
                          if (entry.id !== question.id) return entry;
                          const choices = entry.choices.filter((option) => option.id !== choice.id);
                          return {
                            ...entry,
                            choices,
                            correctId: entry.correctId === choice.id ? choices[0].id : entry.correctId,
                          };
                        }),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="file-row">
              <button
                type="button"
                className="text-button"
                disabled={question.choices.length >= 6}
                onClick={() =>
                  edit((quiz) => ({
                    ...quiz,
                    questions: quiz.questions.map((entry) =>
                      entry.id === question.id
                        ? { ...entry, choices: [...entry.choices, { id: crypto.randomUUID(), text: "" }] }
                        : entry
                    ),
                  }))
                }
              >
                Add choice
              </button>
              <button
                type="button"
                className="text-button"
                disabled={item.questions.length <= 1}
                onClick={() =>
                  edit((quiz) => ({
                    ...quiz,
                    questions: quiz.questions.filter((entry) => entry.id !== question.id),
                  }))
                }
              >
                Remove question
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="text-button"
        disabled={item.questions.length >= 20}
        onClick={() => edit((quiz) => ({ ...quiz, questions: [...quiz.questions, newQuestion()] }))}
      >
        Add question
      </button>
    </div>
  );
}

function StructureNode(props: { lesson: LessonGroup; lessonIndex: number; manifest: string }) {
  const { lesson, lessonIndex, manifest } = props;
  const lessonTitle = lesson.title.trim() || `Lesson ${lessonIndex + 1}`;
  if (lesson.items.length <= 1) {
    const item = lesson.items[0];
    const suffix = `_${lessonIndex + 1}`;
    const title = item?.title.trim() || lessonTitle;
    return (
      <li>
        Item <span className="muted">item_{manifest}{suffix}</span>
        <ul>
          <li>Title: {title}</li>
          <li>Launch: {item ? itemHref(lessonIndex, 0, 1) : "—"}</li>
          <li>Resource: resource_{manifest}{suffix}</li>
        </ul>
      </li>
    );
  }
  const suffix = `_${lessonIndex + 1}`;
  return (
    <li>
      Folder <span className="muted">item_{manifest}{suffix}</span>
      <ul>
        <li>Title: {lessonTitle}</li>
        {lesson.items.map((item, itemIndex) => {
          const child = `_${lessonIndex + 1}_${itemIndex + 1}`;
          const title = item.title.trim() || (item.type === "quiz" ? `Quiz ${itemIndex + 1}` : `Video ${itemIndex + 1}`);
          return (
            <li key={item.id}>
              {item.type === "quiz" ? "Quiz" : "Video"} <span className="muted">item_{manifest}{child}</span>
              <ul>
                <li>Title: {title}</li>
                <li>Launch: {itemHref(lessonIndex, itemIndex, lesson.items.length)}</li>
                <li>Resource: resource_{manifest}{child}</li>
              </ul>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function Text(props: {
  label: string;
  name: string;
  value: string;
  error?: string;
  placeholder?: string;
  wide?: boolean;
  inputMode?: "decimal" | "numeric" | "text";
  onChange: (value: string) => void;
}) {
  return (
    <Field label={props.label} name={props.name} error={props.error} wide={props.wide}>
      <input
        id={props.name}
        value={props.value}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        aria-invalid={props.error ? true : undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </Field>
  );
}

function Field(props: {
  label: string;
  name: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={props.wide ? "field wide" : "field"}>
      <label htmlFor={props.name}>{props.label}</label>
      {props.children}
      {props.error ? <p className="error">{props.error}</p> : null}
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
