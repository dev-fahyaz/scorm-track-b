const { lessonErrors } = require("./build");

const DURATION = /^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/;
const IDENTIFIER = /^[A-Za-z0-9._:-]+$/;
const DEFAULT_MODEL = "openrouter/auto";

function slug(value) {
  return String(value || "").replace(/[^A-Za-z0-9._:-]+/g, "").slice(0, 80);
}

function durationOrDefault(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed !== "PT" && DURATION.test(trimmed) ? trimmed : "PT0H0M0S";
}

function normalizeDraft(raw, inputLessons) {
  const source = raw && typeof raw === "object" ? raw : {};
  const title = typeof source.title === "string" && source.title.trim()
    ? source.title.trim()
    : "Untitled course";
  let identifier = slug(source.identifier) || slug(title) || `course${Date.now()}`;
  if (!IDENTIFIER.test(identifier)) identifier = `course${Date.now()}`;

  const keywords = Array.isArray(source.keywords)
    ? source.keywords.map((word) => String(word).trim()).filter(Boolean).slice(0, 12)
    : typeof source.keywords === "string"
      ? source.keywords.split(",").map((word) => word.trim()).filter(Boolean).slice(0, 12)
      : [];

  let mastery = Number(source.masteryScore);
  if (!Number.isFinite(mastery)) mastery = 80;
  mastery = Math.min(100, Math.max(0, Math.round(mastery)));

  const modelLessons = Array.isArray(source.lessons) ? source.lessons : [];
  const lessons = inputLessons.map((lesson, index) => {
    const fromModel = modelLessons[index] && typeof modelLessons[index] === "object" ? modelLessons[index] : {};
    const titleText = String(fromModel.title || lesson.title || "").trim() || `Lesson ${index + 1}`;
    const modelVideos = Array.isArray(fromModel.videos) ? fromModel.videos : [];
    const videos = (lesson.videos || []).map((video, videoIndex) => ({
      title: String((modelVideos[videoIndex] && modelVideos[videoIndex].title) || video.title || "").trim(),
    }));
    return { title: titleText, videos };
  });

  const author = typeof source.author === "string" ? source.author.trim() : "";
  const packageName = typeof source.packageName === "string" && source.packageName.trim()
    ? source.packageName.trim()
    : title;

  return {
    title,
    packageName,
    identifier,
    description: typeof source.description === "string" ? source.description.trim() : "",
    keywords,
    author,
    duration: durationOrDefault(source.duration),
    typicalDuration: durationOrDefault(source.typicalDuration || source.duration),
    rights: typeof source.rights === "string" ? source.rights.trim() : "",
    masteryScore: mastery,
    lessons,
  };
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;
  return JSON.parse(body);
}

async function draftCourse(body) {
  if (!body || typeof body !== "object") {
    throw Object.assign(new Error("Send the videos to draft."), { status: 400, expose: true });
  }
  if (typeof body.organization !== "string" || !body.organization.trim()) {
    throw Object.assign(new Error("Enter an organization."), { status: 400, expose: true });
  }
  const urlErrors = lessonErrors(body.lessons);
  if (urlErrors.length) {
    throw Object.assign(new Error(urlErrors.join(" ")), { status: 400, expose: true });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw Object.assign(new Error("Set OPENROUTER_API_KEY in .env."), { status: 400, expose: true });
  }

  const lessons = body.lessons.map((lesson) => ({
    title: lesson && lesson.title ? String(lesson.title).trim() : "",
    videos: ((lesson && lesson.items) || [])
      .filter((item) => !item || item.type !== "quiz")
      .map((item) => ({
        title: item && item.title ? String(item.title).trim() : "",
        videoUrl: String((item && (item.url || item.videoUrl)) || "").trim(),
      })),
  }));
  const model = (process.env.OPENROUTER_MODEL || "").trim() || DEFAULT_MODEL;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [
            "You draft SCORM course metadata.",
            "Reply with JSON only, no markdown.",
            "Use this shape:",
            '{"title":"","packageName":"","identifier":"","description":"","keywords":[],"author":"","duration":"PT0H0M0S","typicalDuration":"PT0H0M0S","rights":"","masteryScore":80,"lessons":[{"title":"","videos":[{"title":""}]}]}',
            "identifier uses only letters, numbers, dots, hyphens, underscores, or colons.",
            "duration and typicalDuration use PT#H#M#S.",
            "lessons must match the input groups in the same order.",
            "Each videos array must match that group's videos in the same order.",
            "Do not invent video URLs or quiz questions. Keep titles short.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            version: body.version || "1.2",
            organization: body.organization.trim(),
            note: typeof body.note === "string" ? body.note.trim() : "",
            lessons,
          }),
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw Object.assign(new Error("The draft service rejected the request."), { status: 502, expose: true });
  }
  const payload = await response.json();
  const text = payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : "";
  let parsed;
  try {
    parsed = extractJson(text);
  } catch {
    throw Object.assign(new Error("The draft was not valid JSON."), { status: 502, expose: true });
  }
  return normalizeDraft(parsed, lessons);
}

module.exports = { draftCourse, normalizeDraft };
