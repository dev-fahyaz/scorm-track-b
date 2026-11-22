const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");

const VERSIONS = new Set(["1.2", "2004 3rd Edition", "2004 4th Edition"]);
const DURATION = /PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?/;
const ENTRY_LIMIT = 2 * 1024 * 1024;

function fail(message) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}

function entryName(entry) {
  return String(entry.entryName || "").replace(/\\/g, "/");
}

function findEntry(zip, names) {
  const wanted = new Set(names);
  return zip.getEntries().find((entry) => {
    const name = entryName(entry);
    if (!name || name.includes("..") || name.startsWith("/")) return false;
    const base = name.split("/").pop();
    return wanted.has(base);
  });
}

function readEntry(zip, names) {
  const entry = findEntry(zip, names);
  if (!entry) return null;
  if (entry.header.size > ENTRY_LIMIT) {
    throw fail("A file in the zip is larger than 2 MB.");
  }
  return entry.getData();
}

function section(xml, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return match ? match[1] : "";
}

function blocks(xml, tag) {
  const found = [];
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let match = pattern.exec(xml);
  while (match) {
    found.push(match[1]);
    match = pattern.exec(xml);
  }
  return found;
}

function textValue(block) {
  const marked = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(block || "");
  if (marked) return marked[1].trim();
  return String(block || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function durationValue(block) {
  const match = DURATION.exec(block || "");
  return match && match[0] !== "PT" ? match[0] : "PT0H0M0S";
}

function vcardField(card, label) {
  const line = card.split(/\r?\n/).find((entry) => entry.toUpperCase().startsWith(label));
  if (!line) return "";
  return line.slice(line.indexOf(":") + 1).trim().replace(/^;+/, "");
}

function organizationFromManifest(xml) {
  const match = /<organization\b[^>]*\bidentifier="([^"]+)"/i.exec(xml || "");
  return match ? match[1].replace(/_/g, " ") : "";
}

function versionFromManifest(xml) {
  const match = /<schemaversion>([^<]+)<\/schemaversion>/i.exec(xml || "");
  const value = match ? match[1].trim() : "";
  return VERSIONS.has(value) ? value : "";
}

function readMetadata(xml) {
  const general = section(xml, "general");
  const life = section(xml, "lifeCycle");
  const technical = section(xml, "technical");
  const educational = section(xml, "educational");
  const rights = section(xml, "rights");
  const cardMatch = /BEGIN:VCARD([\s\S]*?)END:VCARD/i.exec(xml || "");
  const card = cardMatch ? cardMatch[1] : "";
  const languageMatch = /<language[^>]*>([^<]+)<\/language>/i.exec(general);
  return {
    packageName: textValue(section(general, "title")),
    description: textValue(section(general, "description")),
    keywords: blocks(general, "keyword").map(textValue).filter(Boolean),
    language: languageMatch ? languageMatch[1].trim() : "en",
    packageVersion: textValue(section(life, "version")) || "1.0.0",
    duration: durationValue(technical),
    typicalDuration: durationValue(educational),
    rights: textValue(section(rights, "description")),
    author: vcardField(card, "FN:"),
    vcardOrg: vcardField(card, "ORG:"),
    vcardTel: vcardField(card, "TEL"),
    vcardAddress: vcardField(card, "ADR"),
    vcardMail: vcardField(card, "EMAIL"),
    vcardUrl: vcardField(card, "URL:"),
  };
}

function choice(text) {
  return { id: crypto.randomUUID(), text: String(text || "") };
}

function questionKind(question) {
  const kind = question && question.kind;
  if (kind === "choice" || kind === "true-false" || kind === "multi" || kind === "fill-in") return kind;
  return "choice";
}

function timeField(question, withTime) {
  if (!withTime) return "";
  return question && Number.isInteger(question.at) && question.at >= 0 ? String(question.at) : "";
}

function correctIndexes(question) {
  if (question && Array.isArray(question.correctIndexes)) return question.correctIndexes;
  if (question && Number.isInteger(question.correctIndex)) return [question.correctIndex];
  return [];
}

function formQuestion(question, withTime) {
  const kind = questionKind(question);
  const prompt = String((question && question.prompt) || "");
  const at = timeField(question, withTime);
  if (kind === "fill-in") {
    const source = question && Array.isArray(question.answers) ? question.answers : [];
    const answers = source.length ? source.map((answer) => String(answer || "")) : [""];
    return {
      id: crypto.randomUUID(),
      kind,
      prompt,
      choices: [],
      correctIds: [],
      answers,
      at,
    };
  }
  if (kind === "true-false") {
    const yes = choice("True");
    const no = choice("False");
    const index = correctIndexes(question)[0] === 1 ? 1 : 0;
    return {
      id: crypto.randomUUID(),
      kind,
      prompt,
      choices: [yes, no],
      correctIds: [index === 1 ? no.id : yes.id],
      answers: [],
      at,
    };
  }
  const choices = (question && Array.isArray(question.choices) ? question.choices : []).map(choice);
  const usable = choices.length >= 2 ? choices : [choice(""), choice("")];
  const ids = correctIndexes(question)
    .filter((index) => Number.isInteger(index) && usable[index])
    .map((index) => usable[index].id);
  const correctIds = ids.length ? ids : [usable[0].id];
  return {
    id: crypto.randomUUID(),
    kind,
    prompt,
    choices: usable,
    correctIds: kind === "choice" ? correctIds.slice(0, 1) : correctIds,
    answers: [],
    at,
  };
}

function blankVideo() {
  return { id: crypto.randomUUID(), type: "video", title: "", url: "", questions: [] };
}

function findBySuffix(zip, suffix) {
  const wanted = String(suffix || "").replace(/\\/g, "/");
  return zip.getEntries().find((entry) => {
    const name = entryName(entry);
    return name && !name.includes("..") && name.endsWith(wanted);
  });
}

function deckFromZip(zip, item, saveDeck) {
  const slides = Array.isArray(item.slides) ? item.slides : [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-deck-"));
  fs.mkdirSync(path.join(dir, "slides"), { recursive: true });
  const stored = slides.map((slide, index) => {
    const image = slide && typeof slide.image === "string" ? slide.image : "";
    const base = path.basename(image) || `slide-${index + 1}.jpg`;
    const entry = image ? findBySuffix(zip, image) : null;
    if (entry) {
      if (entry.header.size > 8 * 1024 * 1024) throw fail("A slide image is larger than 8 MB.");
      fs.writeFileSync(path.join(dir, "slides", base), entry.getData());
    }
    return {
      title: String((slide && slide.title) || `Slide ${index + 1}`),
      notes: String((slide && slide.notes) || ""),
      image: `slides/${base}`,
      links: Array.isArray(slide && slide.links) ? slide.links : [],
    };
  });
  fs.writeFileSync(path.join(dir, "deck.json"), JSON.stringify({
    title: String(item.title || ""),
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    slides: stored,
  }));
  return typeof saveDeck === "function" ? saveDeck({ dir }) : "";
}

function formLessons(lessons, zip, saveDeck) {
  const source = Array.isArray(lessons) ? lessons : [];
  const groups = source.map((lesson) => {
    const rawItems = lesson && Array.isArray(lesson.items)
      ? lesson.items
      : lesson && (lesson.url || lesson.videoUrl)
        ? [{ type: "video", title: lesson.title, url: lesson.url || lesson.videoUrl }]
        : [];
    const items = rawItems.map((item) => {
      if (item && item.type === "deck") {
        return {
          id: crypto.randomUUID(),
          type: "deck",
          title: String(item.title || ""),
          deckId: deckFromZip(zip, item, saveDeck),
          slides: (Array.isArray(item.slides) ? item.slides : []).map((slide) => ({
            title: String((slide && slide.title) || ""),
            notes: String((slide && slide.notes) || ""),
            links: Array.isArray(slide && slide.links) ? slide.links : [],
          })),
        };
      }
      if (item && item.common && item.specific && item.contentType && item.contentType !== "VIDEO" && item.contentType !== "QUIZ" && item.contentType !== "ANIMATION" && item.contentType !== "DECK") {
        return {
          id: crypto.randomUUID(),
          type: "content",
          title: String(item.title || item.common.contentName || ""),
          common: item.common,
          specific: item.specific,
        };
      }
      if (item && (item.type === "quiz" || (item.contentType === "QUIZ" && item.legacyQuiz))) {
        const questions = (Array.isArray(item.questions) ? item.questions : []).map((question) => (
          formQuestion(question, false)
        ));
        if (item.common && item.specific && !item.legacyQuiz) {
          return {
            id: crypto.randomUUID(),
            type: "content",
            title: String(item.title || item.common.contentName || ""),
            common: item.common,
            specific: item.specific,
          };
        }
        return {
          id: crypto.randomUUID(),
          type: "quiz",
          title: String(item.title || ""),
          questions: questions.length ? questions : [formQuestion(null, false)],
        };
      }
      if (item && item.common && item.specific && (item.contentType === "VIDEO" || item.contentType === "ANIMATION" || item.contentType === "QUIZ")) {
        return {
          id: crypto.randomUUID(),
          type: "content",
          title: String(item.title || item.common.contentName || ""),
          common: item.common,
          specific: item.specific,
          questions: Array.isArray(item.questions)
            ? item.questions.map((question) => formQuestion(question, item.contentType !== "QUIZ"))
            : undefined,
        };
      }
      if (item && item.type === "quiz") {
        const questions = (Array.isArray(item.questions) ? item.questions : []).map((question) => (
          formQuestion(question, false)
        ));
        return {
          id: crypto.randomUUID(),
          type: "quiz",
          title: String(item.title || ""),
          questions: questions.length ? questions : [formQuestion(null, false)],
        };
      }
      const questions = (item && Array.isArray(item.questions) ? item.questions : []).map((question) => (
        formQuestion(question, true)
      ));
      return {
        id: crypto.randomUUID(),
        type: "video",
        title: String((item && item.title) || ""),
        url: String((item && (item.url || item.videoUrl)) || ""),
        questions,
      };
    });
    return {
      id: crypto.randomUUID(),
      title: String((lesson && lesson.title) || ""),
      items: items.length ? items : [blankVideo()],
    };
  });
  if (!groups.length) {
    return [{ id: crypto.randomUUID(), title: "", items: [blankVideo()] }];
  }
  return groups;
}

function posterFromZip(zip, name) {
  const wanted = name ? [name] : ["poster.jpg", "poster.jpeg", "poster.png", "poster.webp"];
  const entry = findEntry(zip, wanted);
  if (!entry) return { posterName: "", posterDataUrl: "" };
  if (entry.header.size > ENTRY_LIMIT) throw fail("A file in the zip is larger than 2 MB.");
  const base = entryName(entry).split("/").pop() || "poster.jpg";
  const ext = base.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return {
    posterName: base,
    posterDataUrl: `data:${mime};base64,${entry.getData().toString("base64")}`,
  };
}

function importPackage(buffer, saveDeck) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw fail("Choose a zip file.");
  }
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw fail("Choose a zip file.");
  }

  const configBuffer = readEntry(zip, ["config.json"]);
  if (!configBuffer) throw fail("This zip was not built by the dashboard.");
  let config;
  try {
    config = JSON.parse(configBuffer.toString("utf8"));
  } catch {
    throw fail("The course record in this zip could not be read.");
  }

  const manifest = (readEntry(zip, ["imsmanifest.xml"]) || Buffer.from("")).toString("utf8");
  const metadataXml = (readEntry(zip, ["metadata.xml"]) || Buffer.from("")).toString("utf8");
  const metadata = readMetadata(metadataXml);
  const poster = posterFromZip(zip, config.poster);

  const version = VERSIONS.has(config.version) ? config.version : versionFromManifest(manifest) || "1.2";
  const rawThreshold = Number(config.completionThreshold);
  const threshold = rawThreshold > 0 && rawThreshold <= 1
    ? Math.round(rawThreshold * 100)
    : rawThreshold;
  const completionThreshold = Number.isInteger(threshold) && threshold >= 1 && threshold <= 100
    ? String(threshold)
    : "90";
  const mastery = Number(config.masteryScore);
  const organization = metadata.vcardOrg || organizationFromManifest(manifest);

  return {
    version,
    title: String(config.title || ""),
    packageName: metadata.packageName || String(config.title || ""),
    organization,
    language: metadata.language || "en",
    identifier: String(config.identifier || ""),
    packageVersion: metadata.packageVersion || "1.0.0",
    masteryScore: Number.isFinite(mastery) ? String(mastery) : "80",
    requireQuizPass: config.requireQuizPass !== false,
    description: metadata.description,
    keywords: metadata.keywords.join(", "),
    author: metadata.author,
    duration: metadata.duration,
    typicalDuration: metadata.typicalDuration,
    rights: metadata.rights,
    vcardOrg: metadata.vcardOrg,
    vcardTel: metadata.vcardTel,
    vcardAddress: metadata.vcardAddress,
    vcardMail: metadata.vcardMail,
    vcardUrl: metadata.vcardUrl,
    lessons: formLessons(config.lessons, zip, saveDeck),
    note: "",
    completionThreshold,
    posterName: poster.posterName,
    posterDataUrl: poster.posterDataUrl,
  };
}

module.exports = { importPackage };
