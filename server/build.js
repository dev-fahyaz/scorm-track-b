const fs = require("fs");
const os = require("os");
const path = require("path");
const fse = require("fs-extra");
const buildPackage = require("../lib/index.js");

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
      errors.push(`${label} needs a video or a quiz.`);
      return;
    }
    items.forEach((item, itemIndex) => {
      const kind = item && item.type === "quiz" ? "quiz" : "video";
      const itemLabel = `${label} ${kind} ${itemIndex + 1}`;
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
        const at = question ? question.at : null;
        if (at == null) return;
        if (!Number.isInteger(at) || at < 0 || at > 86400) {
          errors.push(`${questionLabel} needs a time in minutes and seconds, or no time to ask after the video.`);
        }
      });
    });
  });
  return errors;
}

function itemHref(lessonNumber, itemNumber, count) {
  if (count <= 1) return `lesson-${lessonNumber}.html`;
  return `lesson-${lessonNumber}-${itemNumber}.html`;
}

function normalizeQuestion(question, withTime) {
  const kind = questionKind(question) || "choice";
  const prompt = String((question && question.prompt) || "").trim();
  const at = withTime && question && Number.isInteger(question.at) && question.at >= 0 ? question.at : null;
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
  return lessons.map((lesson, lessonIndex) => {
    const sourceItems = Array.isArray(lesson.items) ? lesson.items : [];
    const items = sourceItems.map((item, itemIndex) => {
      const type = item && item.type === "quiz" ? "quiz" : "video";
      const href = itemHref(lessonIndex + 1, itemIndex + 1, sourceItems.length);
      const fallback = type === "quiz" ? `Quiz ${itemIndex + 1}` : `Video ${itemIndex + 1}`;
      const title = (item && String(item.title || "").trim()) || fallback;
      const questions = (item && Array.isArray(item.questions) ? item.questions : [])
        .map((question) => normalizeQuestion(question, type === "video"));
      if (type === "quiz") return { type, title, href, questions };
      return {
        type,
        title,
        href,
        url: String((item && (item.url || item.videoUrl)) || "").trim(),
        questions,
      };
    });
    return {
      title: (lesson && String(lesson.title || "").trim()) || `Lesson ${lessonIndex + 1}`,
      items,
    };
  });
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function courseHtml(title, lessonIndex, itemIndex) {
  const safe = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <title>${safe}</title>
  <style>
    body { margin: 0; background: #14181f; color: #f6f3ec; font-family: Georgia, "Iowan Old Style", serif; }
    main { max-width: 960px; margin: 0 auto; padding: 28px 16px 48px; }
    h1 { font-size: 1.6rem; font-weight: 600; margin: 0 0 14px; }
    video { width: 100%; background: #000; border-radius: 10px; }
    video.off, #youtube-frame, #quiz { display: none; }
    #youtube-frame.on { display: block; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 10px; overflow: hidden; }
    #youtube-frame iframe { width: 100%; height: 100%; border: 0; }
    #quiz.on { display: block; font-family: "Segoe UI", sans-serif; }
    #quiz h2 { font-family: Georgia, "Iowan Old Style", serif; font-size: 1.25rem; margin: 0 0 16px; }
    #quiz fieldset { border: 1px solid #3a4250; border-radius: 10px; margin: 0 0 14px; padding: 12px 14px; }
    #quiz legend { padding: 0 6px; }
    #quiz label { display: block; margin: 8px 0; }
    #quiz input[type="text"] { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 8px 10px; border-radius: 8px; border: 1px solid #3a4250; background: #1c222c; color: #f6f3ec; }
    #quiz button { margin-top: 8px; border: 0; border-radius: 999px; padding: 10px 16px; background: #f6f3ec; color: #14181f; font-weight: 700; cursor: pointer; }
    #quiz button:disabled { opacity: 0.6; cursor: default; }
    #status { font-family: "Segoe UI", sans-serif; color: #d5d0c6; font-size: 0.92rem; }
  </style>
</head>
<body>
  <main>
    <h1>${safe}</h1>
    <video id="lesson" controls playsinline preload="metadata"></video>
    <div id="youtube-frame"><div id="youtube"></div></div>
    <div id="quiz"></div>
    <p id="status">Loading lesson…</p>
  </main>
  <script>window.LESSON_INDEX = ${Number(lessonIndex)};window.ITEM_INDEX = ${Number(itemIndex)};</script>
  <script src="player.js"></script>
</body>
</html>
`;
}

function directorySize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? directorySize(full) : fs.statSync(full).size;
  }
  return total;
}

function buildPackageAsync(config) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error("Packager timed out."), { status: 500 }));
    }, 30000);
    try {
      buildPackage(config, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

async function buildCourse(body, playerFile) {
  const errors = validate(body);
  if (errors.length) {
    throw Object.assign(new Error(errors.join(" ")), { status: 400 });
  }

  const root = path.join(os.tmpdir(), "scorm-track-b", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const source = path.join(root, "course");
  const outputFolder = path.join(root, "out");

  try {
    const lessons = normalizeLessons(body.lessons);
    await fse.ensureDir(source);
    await fse.copy(playerFile, path.join(source, "player.js"));
    for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
      const items = lessons[lessonIndex].items;
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        await fse.writeFile(
          path.join(source, item.href),
          courseHtml(item.title, lessonIndex, itemIndex),
          "utf8"
        );
      }
    }

    let poster = null;
    if (body.posterDataUrl) {
      const match = POSTER.exec(body.posterDataUrl);
      const ext = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
      poster = `poster.${ext}`;
      await fse.writeFile(
        path.join(source, poster),
        Buffer.from(match[2].replace(/\s/g, ""), "base64")
      );
    }

    const pkg = body.package;
    const keywords = Array.isArray(pkg.keywords)
      ? pkg.keywords.map((word) => String(word).trim()).filter(Boolean)
      : [];
    const vcard = pkg.vcard || {};
    const config = {
      version: body.version,
      language: body.language.trim(),
      organization: body.organization.trim(),
      title: body.title.trim(),
      identifier: body.identifier.trim(),
      masteryScore: body.masteryScore,
      startingPage: lessons[0].items[0].href,
      lessons: lessons.map((lesson) => ({
        title: lesson.title,
        items: lesson.items.map((item) => ({
          title: item.title,
          href: item.href,
          type: item.type,
        })),
      })),
      source,
      package: {
        name: (pkg.name && String(pkg.name).trim()) || body.title.trim(),
        author: pkg.author || "",
        description: pkg.description || "",
        organization: body.organization.trim(),
        version: String(pkg.version).trim(),
        duration: String(pkg.duration).trim(),
        typicalDuration: String(pkg.typicalDuration).trim(),
        rights: pkg.rights || "",
        keywords,
        zip: true,
        appendTimeToOutput: false,
        outputFolder,
        size: String(directorySize(source) || 1),
        vcard: {
          author: vcard.author || pkg.author || "",
          org: vcard.org || "",
          tel: vcard.tel || "",
          address: vcard.address || "",
          mail: vcard.mail || "",
          url: vcard.url || "",
        },
      },
    };

    const courseConfig = {
      title: config.title,
      identifier: config.identifier,
      version: config.version,
      lessons,
      completionThreshold: body.completionThreshold / 100,
      masteryScore: body.masteryScore,
      requireQuizPass: body.requireQuizPass,
      poster,
    };
    await fse.writeFile(path.join(source, "config.json"), JSON.stringify(courseConfig, null, 2), "utf8");

    await buildPackageAsync(config);

    const zips = (await fse.readdir(outputFolder)).filter((name) => name.endsWith(".zip"));
    if (!zips.length) {
      throw Object.assign(new Error("The packager did not write a zip."), { status: 500 });
    }
    const filename = zips[0].replace(/["\r\n]/g, "");
    const buffer = await fse.readFile(path.join(outputFolder, zips[0]));
    return { filename, buffer };
  } finally {
    await fse.remove(root).catch(() => {});
  }
}

module.exports = { buildCourse, validate, lessonErrors, normalizeLessons };
