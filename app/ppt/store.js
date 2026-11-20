const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(os.tmpdir(), "scorm-track-b", "decks");

function deckDir(id) {
  if (!/^[a-f0-9]{16}$/.test(String(id || ""))) return "";
  return path.join(root, id);
}

function saveDeck(deck) {
  const id = crypto.randomBytes(8).toString("hex");
  const dir = path.join(root, id);
  fs.cpSync(deck.dir, dir, { recursive: true });
  return id;
}

function loadDeck(id) {
  const dir = deckDir(id);
  const file = dir && path.join(dir, "deck.json");
  if (!file || !fs.existsSync(file)) return null;
  const deck = JSON.parse(fs.readFileSync(file, "utf8"));
  deck.dir = dir;
  return deck;
}

module.exports = { saveDeck, loadDeck };
