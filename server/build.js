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

function durationOk(value) {
  return typeof value === "string" && value.trim() !== "PT" && DURATION.test(value.trim());
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
  if (body.startingPage !== "index.html") errors.push("The launch file is index.html.");

  let video;
  try {
    video = new URL(body.videoUrl);
  } catch {
    video = null;
  }
  if (!video || video.protocol !== "https:") errors.push("Enter an https video URL.");

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

function courseHtml(title) {
  const safe = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safe}</title>
  <style>
    body { margin: 0; background: #14181f; color: #f6f3ec; font-family: Georgia, "Iowan Old Style", serif; }
    main { max-width: 960px; margin: 0 auto; padding: 28px 16px 48px; }
    h1 { font-size: 1.6rem; font-weight: 600; margin: 0 0 14px; }
    video { width: 100%; background: #000; border-radius: 10px; }
    #status { font-family: "Segoe UI", sans-serif; color: #d5d0c6; font-size: 0.92rem; }
  </style>
</head>
<body>
  <main>
    <h1>${safe}</h1>
    <video id="lesson" controls playsinline preload="metadata"></video>
    <p id="status">Loading lesson…</p>
  </main>
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
    await fse.ensureDir(source);
    await fse.copy(playerFile, path.join(source, "player.js"));
    await fse.writeFile(path.join(source, "index.html"), courseHtml(body.title.trim()), "utf8");

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
      startingPage: "index.html",
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
      videoUrl: body.videoUrl.trim(),
      completionThreshold: body.completionThreshold / 100,
      masteryScore: body.masteryScore,
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

module.exports = { buildCourse, validate };
