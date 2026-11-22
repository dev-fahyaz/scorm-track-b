import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { buildPackage, downloadBlob, draftCourse, importPackage, uploadPresentation } from "./api";
import {
  applyDraft,
  emptyForm,
  itemHref,
  formatAt,
  joinAt,
  newContentItem,
  newDeck,
  newLesson,
  newQuestion,
  newQuiz,
  newVideo,
  questionKindLabel,
  QUESTION_KINDS,
  splitAt,
  toRequest,
  withKind,
  type ContentItem,
  type DeckItem,
  type LessonGroup,
  type LessonItem,
  type PackageForm,
  type QuestionKind,
  type QuizItem,
  type QuizQuestion,
  type ScormVersion,
} from "./types";
import CONTENT_TYPE_LABELS from "@models/contentTypeLabels.json";
import { manifestId, needsDraft, organizationId, validateForm, validateLessons } from "./validate";

const VERSIONS: ScormVersion[] = ["1.2", "2004 3rd Edition", "2004 4th Edition"];

export function App() {
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"draft" | "build" | "import" | "slides" | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const pptInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pasteJson, setPasteJson] = useState("");
  const [pasteLessonId, setPasteLessonId] = useState("");

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

  function onPasteContent(lessonId: string) {
    setMessage("");
    setFailed(false);
    try {
      const parsed = JSON.parse(pasteJson) as {
        common?: { contentName?: string; contentType?: string };
        specific?: Record<string, unknown>;
        title?: string;
      };
      if (!parsed?.common?.contentType || !parsed.specific || typeof parsed.specific !== "object") {
        throw new Error("Paste a content item with common.contentType and specific.");
      }
      const item = newContentItem(
        {
          contentName: String(parsed.common.contentName || parsed.title || "Content"),
          contentType: String(parsed.common.contentType),
          description: "",
          status: "PUBLISHED",
        },
        parsed.specific
      );
      updateLesson(lessonId, (current) => ({
        ...current,
        items: [...current.items, item],
      }));
      setPasteJson("");
      setMessage(`Added ${parsed.common.contentType} content item.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Could not parse content JSON.");
    }
  }

  async function onSlides(lessonId: string, file: File | undefined) {
    if (!file) return;
    setBusy("slides");
    setMessage("");
    setFailed(false);
    try {
      const deck = await uploadPresentation(file);
      updateLesson(lessonId, (current) => {
        const blankOnly = current.items.length === 1
          && current.items[0].type === "video"
          && !current.items[0].url.trim();
        const next = newDeck(deck);
        return {
          ...current,
          title: current.title.trim() ? current.title : deck.title,
          items: blankOnly ? [next] : [...current.items, next],
        };
      });
      setMessage(`Read ${deck.slides.length} slides from ${file.name}.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "The presentation could not be read.");
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
            Optional local test harness for Track B. Build a SCORM zip from videos,
            quizzes, PowerPoint, or pasted content JSON — production packaging uses the API.
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
            Add videos, quizzes, and PowerPoint decks here to smoke-test packaging. Paste content JSON to try ASAT content-types items without the full course builder. The zip holds the player and package files — not remote media.
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
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy !== null}
                    onClick={() => pptInputs.current[lesson.id]?.click()}
                  >
                    {busy === "slides" ? "Reading…" : "Add PowerPoint"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setPasteLessonId(pasteLessonId === lesson.id ? "" : lesson.id)}
                  >
                    Paste content JSON
                  </button>
                  <input
                    ref={(node) => {
                      pptInputs.current[lesson.id] = node;
                    }}
                    type="file"
                    accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      void onSlides(lesson.id, file);
                    }}
                  />
                </div>
                {pasteLessonId === lesson.id ? (
                  <div className="paste-panel">
                    <p className="hint">
                      Paste a {"{ common, specific }"} item from the course builder to smoke-test packaging.
                    </p>
                    <textarea
                      id={`paste-${lesson.id}`}
                      value={pasteJson}
                      rows={8}
                      placeholder='{"common":{"contentName":"Intro","contentType":"TEXT"},"specific":{"paragraph":"Hello"}}'
                      onChange={(event) => setPasteJson(event.target.value)}
                    />
                    <div className="file-row">
                      <button type="button" className="text-button" onClick={() => onPasteContent(lesson.id)}>
                        Add content item
                      </button>
                    </div>
                  </div>
                ) : null}
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
            A lesson with one sub-lesson is a single launch file. A lesson with more becomes a folder of launch files. Each later file stays locked until the one before it is passed.
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
            <div className="field">
              <label className="check-line">
                <input
                  id="requireQuizPass"
                  type="checkbox"
                  checked={form.requireQuizPass}
                  onChange={(event) => update("requireQuizPass", event.target.checked)}
                />
                A failed quiz blocks completion
              </label>
            </div>
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

function contentLabel(item: ContentItem): string {
  const type = item.common.contentType;
  return CONTENT_TYPE_LABELS[type] || type || "Content";
}

function ContentPreview(props: { item: ContentItem; error?: string }) {
  const quizType =
    props.item.common.contentType === "QUIZ" && props.item.specific && typeof props.item.specific.quizType === "string"
      ? String(props.item.specific.quizType)
      : "";
  return (
    <div className="content-preview">
      <Field label="Title" name={`content-title-${props.item.id}`}>
        <input value={props.item.title || props.item.common.contentName} readOnly />
      </Field>
      <p className="hint">
        {props.item.common.contentType}
        {quizType ? ` · ${quizType}` : ""}. Authored in the course builder — packaging only here.
      </p>
      {props.error ? <p className="error">{props.error}</p> : null}
      <pre className="json-preview">{JSON.stringify({ common: props.item.common, specific: props.item.specific }, null, 2)}</pre>
    </div>
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
        <p className="sublesson-label">
          {item.type === "quiz"
            ? "Quiz"
            : item.type === "deck"
              ? "Slides"
              : item.type === "content"
                ? contentLabel(item)
                : "Video"}
        </p>
        <button
          type="button"
          className="text-button"
          disabled={props.lesson.items.length === 1}
          onClick={props.onRemove}
        >
          Remove
        </button>
      </div>
      {item.type === "content" ? (
        <ContentPreview item={item} error={props.errors[`content-${lessonIndex}-${itemIndex}`]} />
      ) : item.type === "video" ? (
        <>
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
          <QuestionList
            questions={item.questions}
            lessonIndex={lessonIndex}
            itemIndex={itemIndex}
            errors={props.errors}
            showTime
            allowEmpty
            onChange={(questions) =>
              props.onChange((current) => (current.type === "video" ? { ...current, questions } : current))
            }
          />
        </>
      ) : item.type === "deck" ? (
        <DeckEditor
          item={item}
          lessonIndex={lessonIndex}
          itemIndex={itemIndex}
          error={props.errors[`deck-${lessonIndex}-${itemIndex}`]}
          onChange={props.onChange}
        />
      ) : item.type === "quiz" ? (
        <QuizEditor
          item={item}
          lessonIndex={lessonIndex}
          itemIndex={itemIndex}
          errors={props.errors}
          onChange={props.onChange}
        />
      ) : null}
    </div>
  );
}

function DeckEditor(props: {
  item: DeckItem;
  lessonIndex: number;
  itemIndex: number;
  error?: string;
  onChange: (change: (item: LessonItem) => LessonItem) => void;
}) {
  const { item, lessonIndex, itemIndex } = props;
  return (
    <div className="quiz-editor">
      <Field label="Deck title" name={`deck-title-${lessonIndex}-${itemIndex}`} error={props.error}>
        <input
          id={`deck-title-${lessonIndex}-${itemIndex}`}
          value={item.title}
          onChange={(event) =>
            props.onChange((current) => (current.type === "deck" ? { ...current, title: event.target.value } : current))
          }
        />
      </Field>
      <p className="hint">{item.slides.length} slides. Notes and titles are saved with the package.</p>
      {item.slides.map((slide, slideIndex) => (
        <div className="question" key={`${item.id}-${slideIndex}`}>
          <Field label={`Slide ${slideIndex + 1}`} name={`slide-title-${lessonIndex}-${itemIndex}-${slideIndex}`}>
            <input
              id={`slide-title-${lessonIndex}-${itemIndex}-${slideIndex}`}
              value={slide.title}
              onChange={(event) =>
                props.onChange((current) => {
                  if (current.type !== "deck") return current;
                  const slides = current.slides.map((entry, index) => (
                    index === slideIndex ? { ...entry, title: event.target.value } : entry
                  ));
                  return { ...current, slides };
                })
              }
            />
          </Field>
          <Field label="Notes" name={`slide-notes-${lessonIndex}-${itemIndex}-${slideIndex}`}>
            <textarea
              id={`slide-notes-${lessonIndex}-${itemIndex}-${slideIndex}`}
              value={slide.notes}
              onChange={(event) =>
                props.onChange((current) => {
                  if (current.type !== "deck") return current;
                  const slides = current.slides.map((entry, index) => (
                    index === slideIndex ? { ...entry, notes: event.target.value } : entry
                  ));
                  return { ...current, slides };
                })
              }
            />
          </Field>
        </div>
      ))}
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
  return (
    <div className="quiz-editor">
      <Field label="Quiz title" name={quizKey} error={props.errors[quizKey]}>
        <input
          id={quizKey}
          value={item.title}
          placeholder="Quiz"
          onChange={(event) =>
            props.onChange((current) =>
              current.type === "quiz" ? { ...current, title: event.target.value } : current
            )
          }
        />
      </Field>
      <QuestionList
        questions={item.questions}
        lessonIndex={lessonIndex}
        itemIndex={itemIndex}
        errors={props.errors}
        showTime={false}
        allowEmpty={false}
        onChange={(questions) =>
          props.onChange((current) => (current.type === "quiz" ? { ...current, questions } : current))
        }
      />
    </div>
  );
}

function QuestionList(props: {
  questions: QuizQuestion[];
  lessonIndex: number;
  itemIndex: number;
  errors: Record<string, string>;
  showTime: boolean;
  allowEmpty: boolean;
  onChange: (questions: QuizQuestion[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const listKey = `quiz-${props.lessonIndex}-${props.itemIndex}`;
  useEffect(() => {
    const marker = `-${props.lessonIndex}-${props.itemIndex}-`;
    const match = Object.keys(props.errors).find((name) => name.includes(marker));
    if (!match) return;
    const index = Number(match.slice(match.lastIndexOf("-") + 1));
    const question = props.questions[index];
    if (question) setOpenId(question.id);
  }, [props.errors, props.lessonIndex, props.itemIndex]);
  function edit(id: string, change: (question: QuizQuestion) => QuizQuestion) {
    props.onChange(props.questions.map((question) => (question.id === id ? change(question) : question)));
  }
  return (
    <div className="quiz-editor">
      {props.errors[listKey] ? <p className="error">{props.errors[listKey]}</p> : null}
      {props.allowEmpty && props.questions.length === 0 ? (
        <p className="hint">No questions yet. Add one to pause this video, or leave it watch-only.</p>
      ) : null}
      {props.questions.map((question, questionIndex) => {
        const key = `${props.lessonIndex}-${props.itemIndex}-${questionIndex}`;
        const open = openId === question.id;
        return (
          <div className={open ? "question open" : "question"} key={question.id}>
            <button
              type="button"
              className="question-summary"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : question.id)}
            >
              <span className="kind">{questionKindLabel(question.kind)}</span>
              <span className="prompt">{question.prompt.trim() || `Question ${questionIndex + 1}`}</span>
              {props.showTime ? <span className="when">{formatAt(question.at)}</span> : null}
            </button>
            {open ? (
              <QuestionBody
                question={question}
                questionKey={key}
                showTime={props.showTime}
                errors={props.errors}
                canRemove={props.allowEmpty || props.questions.length > 1}
                onChange={(change) => edit(question.id, change)}
                onRemove={() => {
                  props.onChange(props.questions.filter((entry) => entry.id !== question.id));
                  setOpenId(null);
                }}
              />
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className="text-button"
        disabled={props.questions.length >= 20}
        onClick={() => {
          const question = newQuestion();
          props.onChange([...props.questions, question]);
          setOpenId(question.id);
        }}
      >
        Add question
      </button>
    </div>
  );
}

function QuestionBody(props: {
  question: QuizQuestion;
  questionKey: string;
  showTime: boolean;
  errors: Record<string, string>;
  canRemove: boolean;
  onChange: (change: (question: QuizQuestion) => QuizQuestion) => void;
  onRemove: () => void;
}) {
  const { question, questionKey } = props;
  const time = splitAt(question.at);
  return (
    <div className="question-body">
      <Field label="Type" name={`quiz-kind-${questionKey}`}>
        <select
          id={`quiz-kind-${questionKey}`}
          value={question.kind}
          onChange={(event) => props.onChange((current) => withKind(current, event.target.value as QuestionKind))}
        >
          {QUESTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {questionKindLabel(kind)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Question" name={`quiz-prompt-${questionKey}`} error={props.errors[`quiz-prompt-${questionKey}`]}>
        <input
          id={`quiz-prompt-${questionKey}`}
          value={question.prompt}
          onChange={(event) => props.onChange((current) => ({ ...current, prompt: event.target.value }))}
        />
      </Field>
      {props.showTime ? (
        <div className="time-row">
          <Field label="Minutes" name={`quiz-minutes-${questionKey}`} error={props.errors[`quiz-time-${questionKey}`]}>
            <input
              id={`quiz-minutes-${questionKey}`}
              inputMode="numeric"
              value={question.at === "invalid" ? "" : time.minutes}
              placeholder="—"
              onChange={(event) =>
                props.onChange((current) => ({ ...current, at: joinAt(event.target.value, time.seconds) }))
              }
            />
          </Field>
          <Field label="Seconds" name={`quiz-seconds-${questionKey}`}>
            <input
              id={`quiz-seconds-${questionKey}`}
              inputMode="numeric"
              value={question.at === "invalid" ? "" : time.seconds}
              placeholder="—"
              onChange={(event) =>
                props.onChange((current) => ({ ...current, at: joinAt(time.minutes, event.target.value) }))
              }
            />
          </Field>
          <p className="hint">Leave both blank to ask after the video.</p>
        </div>
      ) : null}
      {question.kind === "true-false" ? (
        <TrueFalse question={question} onChange={props.onChange} error={props.errors[`quiz-correct-${questionKey}`]} />
      ) : null}
      {question.kind === "fill-in" ? (
        <FillIn question={question} questionKey={questionKey} errors={props.errors} onChange={props.onChange} />
      ) : null}
      {question.kind === "choice" || question.kind === "multi" ? (
        <Choices question={question} questionKey={questionKey} errors={props.errors} onChange={props.onChange} />
      ) : null}
      <button type="button" className="text-button" disabled={!props.canRemove} onClick={props.onRemove}>
        Remove question
      </button>
    </div>
  );
}

function TrueFalse(props: {
  question: QuizQuestion;
  error?: string;
  onChange: (change: (question: QuizQuestion) => QuizQuestion) => void;
}) {
  return (
    <div className="choice-list">
      {props.error ? <p className="error">{props.error}</p> : null}
      {props.question.choices.map((choice) => (
        <label className="choice-row plain" key={choice.id}>
          <input
            type="radio"
            name={`correct-${props.question.id}`}
            checked={props.question.correctIds.includes(choice.id)}
            onChange={() => props.onChange((current) => ({ ...current, correctIds: [choice.id] }))}
          />
          <span>{choice.text}</span>
        </label>
      ))}
    </div>
  );
}

function FillIn(props: {
  question: QuizQuestion;
  questionKey: string;
  errors: Record<string, string>;
  onChange: (change: (question: QuizQuestion) => QuizQuestion) => void;
}) {
  const error = props.errors[`quiz-answers-${props.questionKey}`];
  return (
    <div className="choice-list">
      {error ? <p className="error">{error}</p> : null}
      {props.question.answers.map((answer, index) => (
        <div className="choice-row answer-row" key={`${props.question.id}-${index}`}>
          <input
            aria-label={`Accepted answer ${index + 1}`}
            value={answer}
            onChange={(event) =>
              props.onChange((current) => ({
                ...current,
                answers: current.answers.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)),
              }))
            }
          />
          <button
            type="button"
            className="text-button"
            disabled={props.question.answers.length <= 1}
            onClick={() =>
              props.onChange((current) => ({
                ...current,
                answers: current.answers.filter((_, entryIndex) => entryIndex !== index),
              }))
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        disabled={props.question.answers.length >= 6}
        onClick={() => props.onChange((current) => ({ ...current, answers: [...current.answers, ""] }))}
      >
        Add accepted answer
      </button>
    </div>
  );
}

function Choices(props: {
  question: QuizQuestion;
  questionKey: string;
  errors: Record<string, string>;
  onChange: (change: (question: QuizQuestion) => QuizQuestion) => void;
}) {
  const multiple = props.question.kind === "multi";
  return (
    <div className="choice-list">
      {props.errors[`quiz-choices-${props.questionKey}`] ? (
        <p className="error">{props.errors[`quiz-choices-${props.questionKey}`]}</p>
      ) : null}
      {props.errors[`quiz-correct-${props.questionKey}`] ? (
        <p className="error">{props.errors[`quiz-correct-${props.questionKey}`]}</p>
      ) : null}
      {props.question.choices.map((choice, index) => {
        const marked = props.question.correctIds.includes(choice.id);
        return (
          <div className="choice-row" key={choice.id}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={`correct-${props.question.id}`}
              aria-label={marked ? "Correct answer" : "Mark as correct"}
              checked={marked}
              onChange={() =>
                props.onChange((current) => {
                  if (!multiple) return { ...current, correctIds: [choice.id] };
                  const correctIds = marked
                    ? current.correctIds.filter((id) => id !== choice.id)
                    : [...current.correctIds, choice.id];
                  return { ...current, correctIds };
                })
              }
            />
            <input
              aria-label={`Choice ${index + 1}`}
              value={choice.text}
              onChange={(event) =>
                props.onChange((current) => ({
                  ...current,
                  choices: current.choices.map((option) =>
                    option.id === choice.id ? { ...option, text: event.target.value } : option
                  ),
                }))
              }
            />
            <button
              type="button"
              className="text-button"
              disabled={props.question.choices.length <= 2}
              onClick={() =>
                props.onChange((current) => {
                  const choices = current.choices.filter((option) => option.id !== choice.id);
                  const correctIds = current.correctIds.filter((id) => id !== choice.id);
                  return {
                    ...current,
                    choices,
                    correctIds: correctIds.length ? correctIds : [choices[0].id],
                  };
                })
              }
            >
              Remove
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="text-button"
        disabled={props.question.choices.length >= 6}
        onClick={() =>
          props.onChange((current) => ({
            ...current,
            choices: [...current.choices, { id: crypto.randomUUID(), text: "" }],
          }))
        }
      >
        Add choice
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
          {item && (item.type === "video" || item.type === "quiz") && item.questions.length ? (
            <li>Questions: {item.questions.length}</li>
          ) : null}
          {item && item.type === "deck" ? <li>Slides: {item.slides.length}</li> : null}
          {item && item.type === "content" ? <li>Type: {item.common.contentType}</li> : null}
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
          const title =
            item.title.trim() ||
            (item.type === "quiz"
              ? `Quiz ${itemIndex + 1}`
              : item.type === "deck"
                ? `Slides ${itemIndex + 1}`
                : item.type === "content"
                  ? item.common.contentName || `Content ${itemIndex + 1}`
                  : `Video ${itemIndex + 1}`);
          const kind =
            item.type === "quiz"
              ? "Quiz"
              : item.type === "deck"
                ? "Slides"
                : item.type === "content"
                  ? contentLabel(item)
                  : "Video";
          return (
            <li key={item.id}>
              {kind} <span className="muted">item_{manifest}{child}</span>
              <ul>
                <li>Title: {title}</li>
                {item.type === "deck" ? <li>Slides: {item.slides.length}</li> : null}
                {(item.type === "video" || item.type === "quiz") && item.questions.length ? (
                  <li>Questions: {item.questions.length}</li>
                ) : null}
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
