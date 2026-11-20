const fs = require("fs");
const os = require("os");
const path = require("path");
const fse = require("fs-extra");
const buildPackage = require("../../lib/index.js");
const { lessonErrors, validate, normalizeLessons, POSTER } = require("./rules");
const { courseHtml } = require("./html");

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

function attachDeck(item, loadDeck) {
  if (item.type !== "deck") return item;
  const stored = typeof loadDeck === "function" ? loadDeck(item.deckId) : null;
  if (!stored || !Array.isArray(stored.slides) || !stored.slides.length) {
    throw Object.assign(new Error("Upload the PowerPoint file again."), { status: 400, expose: true });
  }
  const slides = stored.slides.map((slide, index) => {
    const edited = Array.isArray(item.slides) ? item.slides[index] : null;
    const title = edited && typeof edited.title === "string" && edited.title.trim() ? edited.title.trim() : slide.title;
    const notes = edited && typeof edited.notes === "string" ? edited.notes : slide.notes || "";
    return {
      title,
      notes,
      image: slide.image,
      links: Array.isArray(slide.links) ? slide.links : [],
    };
  });
  return { ...item, width: stored.width, height: stored.height, slides, sourceDir: stored.dir };
}

async function buildCourse(body, playerFile, loadDeck) {
  const errors = validate(body);
  if (errors.length) {
    throw Object.assign(new Error(errors.join(" ")), { status: 400 });
  }

  const root = path.join(os.tmpdir(), "scorm-track-b", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const source = path.join(root, "course");
  const outputFolder = path.join(root, "out");

  try {
    const lessons = normalizeLessons(body.lessons).map((lesson) => ({
      ...lesson,
      items: lesson.items.map((item) => attachDeck(item, loadDeck)),
    }));
    await fse.ensureDir(source);
    await fse.copy(playerFile, path.join(source, "player.js"));
    for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
      const items = lessons[lessonIndex].items;
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        if (item.type === "deck") {
          const folder = item.href.replace(/\.html$/, "");
          await fse.copy(path.join(item.sourceDir, "slides"), path.join(source, "slides", folder));
          const media = path.join(item.sourceDir, "media");
          if (await fse.pathExists(media)) {
            await fse.copy(media, path.join(source, "media", folder));
          }
          item.slides = item.slides.map((slide) => ({
            ...slide,
            image: `slides/${folder}/${path.basename(slide.image)}`,
          }));
          delete item.sourceDir;
          delete item.deckId;
        }
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

