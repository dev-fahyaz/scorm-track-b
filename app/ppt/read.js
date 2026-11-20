const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function fail(message) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}

function readPresentation(pptxPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-deck-"));
  try {
    const script = path.join(__dirname, "export_deck.py");
    const result = spawnSync("python", [script, pptxPath, dir], { encoding: "utf8" });
    if (result.error) throw fail("Python is required to read a PowerPoint file.");
    if (result.status !== 0) {
      const detail = `${result.stderr || ""}\n${result.stdout || ""}`.trim();
      const line = detail.split(/\r?\n/).filter(Boolean).pop() || "The presentation could not be read.";
      throw fail(line);
    }
    const file = path.join(dir, "deck.json");
    if (!fs.existsSync(file)) throw fail("The presentation did not include any slides.");
    const deck = JSON.parse(fs.readFileSync(file, "utf8"));
    deck.dir = dir;
    return deck;
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { readPresentation };
