"use strict";

/** Shared player CSS injected into each launch HTML */
const BASE_CSS = `
:root {
  --ink: #f6f3ec;
  --muted: #d5d0c6;
  --panel: #1c222c;
  --line: rgba(246, 243, 236, 0.14);
  --accent: #8fd0b4;
  --accent-fill: #0e6b56;
  --paper: #14181f;
  --danger: #f0a8a0;
  --radius: 14px;
  --font: "Segoe UI", system-ui, sans-serif;
  --display: Georgia, "Iowan Old Style", serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(circle at top left, rgba(14, 107, 86, 0.22), transparent 40rem), var(--paper);
  color: var(--ink);
  font-family: var(--font);
}
main {
  max-width: 960px;
  margin: 0 auto;
  padding: clamp(16px, 4vw, 28px) clamp(12px, 3vw, 16px) 48px;
}
h1 {
  font-family: var(--display);
  font-size: clamp(1.25rem, 2.5vw, 1.6rem);
  font-weight: 600;
  margin: 0 0 14px;
}
video { width: 100%; background: #000; border-radius: 10px; }
video.off, #youtube-frame, #quiz, #deck, #content { display: none; }
#content.on { display: block; }
#deck.on { display: grid; gap: 12px; }
#deck .stage { position: relative; background: #000; border-radius: 10px; overflow: hidden; }
#deck img { display: block; width: 100%; height: auto; }
#deck .hotspot { position: absolute; border: 0; padding: 0; background: transparent; cursor: pointer; }
#deck .notes { margin: 0; color: var(--muted); white-space: pre-wrap; }
#deck .deck-bar, .content-bar {
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
}
#deck .deck-bar button, .content-bar button, .btn {
  border: 0; border-radius: 999px; padding: 10px 16px;
  background: var(--ink); color: var(--paper); font-weight: 700; cursor: pointer;
}
.btn.btn-continue, button.btn-continue {
  background: var(--accent-fill); color: #fff;
}
.btn.btn-continue:hover, button.btn-continue:hover { background: #0a5343; }
.btn.btn-secondary, button.btn-secondary {
  background: #2a3441; color: #fff;
}
.btn.btn-secondary:hover, button.btn-secondary:hover { background: #1b2430; }
.btn.btn-phish, button.btn-phish {
  background: #b42318; color: #fff; border: 0;
}
.btn.btn-phish:hover, button.btn-phish:hover { background: #912018; }
#deck .deck-bar button:disabled, .content-bar button:disabled, .btn:disabled {
  opacity: 0.5; cursor: default;
}
#youtube-frame.on {
  display: block; width: 100%; aspect-ratio: 16 / 9; background: #000;
  border-radius: 10px; overflow: hidden;
}
#youtube-frame iframe { width: 100%; height: 100%; border: 0; }
#quiz.on { display: block; }
#quiz.overlay {
  display: flex; position: fixed; inset: 0; z-index: 8;
  align-items: center; justify-content: center; padding: 24px;
  background: rgba(8, 10, 14, 0.72);
}
#quiz .quiz-panel, .panel {
  display: grid; gap: 14px;
  padding: 18px; border-radius: var(--radius);
  background: var(--panel); border: 1px solid var(--line);
}
#quiz.overlay .quiz-panel {
  width: min(560px, 100%); max-height: calc(100vh - 48px); overflow: auto;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}
#quiz h2, .panel h2 {
  font-family: var(--display); font-size: 1.25rem; font-weight: 600; margin: 0;
}
#quiz fieldset { border: 0; margin: 0; padding: 0; }
#quiz legend { padding: 0; font-weight: 650; }
#quiz .choices, .choices { display: grid; gap: 8px; }
#quiz .choice, .choice {
  display: flex; gap: 10px; align-items: center; margin: 0;
  padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px;
  background: rgba(255, 255, 255, 0.04); cursor: pointer;
}
#quiz .choice.picked, .choice.picked {
  border-color: var(--accent); background: rgba(14, 107, 86, 0.45);
}
#quiz .choice input, .choice input { accent-color: var(--accent); }
#quiz .quiz-note, .muted { margin: 0; color: var(--muted); }
#quiz input[type="text"], .field-input, select, textarea {
  width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px;
  border: 1px solid #3a4250; background: #14181f; color: var(--ink); font: inherit;
}
#quiz button, .primary {
  justify-self: start; border: 0; border-radius: 999px; padding: 10px 16px;
  background: var(--ink); color: var(--paper); font-weight: 700; cursor: pointer;
}
#quiz button:disabled, .primary:disabled { opacity: 0.6; cursor: default; }
#status { color: var(--muted); font-size: 0.92rem; }
.content-block { display: grid; gap: 16px; }
.content-block .hero-title { font-family: var(--display); font-size: 1.4rem; margin: 0; }
.content-block .subtitle {
  margin: 0;
  color: color-mix(in srgb, currentColor 72%, transparent);
}
.content-block .body { margin: 0; line-height: 1.55; white-space: pre-wrap; }
.content-block a.cta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 18px; border-radius: 999px; text-decoration: none;
  background: var(--accent-fill); color: #fff; font-weight: 700; width: fit-content;
}
.tab-nav, .slide-dots {
  display: flex; gap: 8px; flex-wrap: wrap;
  padding-bottom: 12px; margin-bottom: 4px;
  border-bottom: 1.5px solid color-mix(in srgb, currentColor 28%, transparent);
}
.slide-dots {
  padding-bottom: 0; margin-bottom: 0; border-bottom: 0;
  padding-top: 12px; margin-top: 4px;
  border-top: 1.5px solid color-mix(in srgb, currentColor 28%, transparent);
}
.tab-nav button, .slide-dots button {
  border: 1.5px solid color-mix(in srgb, currentColor 40%, transparent);
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit; border-radius: 999px; padding: 8px 14px; cursor: pointer;
  font-weight: 650;
}
.tab-nav button:hover, .slide-dots button:hover {
  border-color: var(--accent-fill); background: color-mix(in srgb, var(--accent-fill) 18%, transparent);
}
.tab-nav button.active, .slide-dots button.active {
  background: var(--accent-fill); border-color: transparent; color: #fff;
}
.slide-stage, .tab-body {
  color: inherit; line-height: 1.55;
}
.story-card .muted, .step-card .muted, .light-card .muted {
  color: color-mix(in srgb, currentColor 65%, transparent);
}
.match-grid {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center;
}
@media (max-width: 640px) {
  .match-grid { grid-template-columns: 1fr; }
  #quiz.overlay { padding: 12px; align-items: flex-end; }
  #quiz.overlay .quiz-panel { max-height: min(85vh, 100%); width: 100%; }
  .pair-row { display: grid; gap: 8px; }
}
.pair-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  padding: 10px; border: 1px solid var(--line); border-radius: 12px;
}
.picture-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;
}
.picture-grid label {
  display: grid; gap: 8px; padding: 10px; border: 1px solid var(--line);
  border-radius: 12px; cursor: pointer; text-align: center;
}
.picture-grid label.picked { border-color: var(--accent); background: rgba(14, 107, 86, 0.35); }
.picture-grid img { width: 100%; height: 120px; object-fit: cover; border-radius: 8px; background: #000; }
.order-list { display: grid; gap: 8px; }
.order-item {
  display: flex; gap: 10px; align-items: center; padding: 12px;
  border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,0.03);
  transition: transform 0.55s ease;
}
.liker-row {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px;
}
@media (max-width: 640px) {
  .liker-row { grid-template-columns: 1fr; }
  .pair-row { grid-template-columns: 1fr; }
}
.liker-row label {
  display: grid; gap: 6px; place-items: center; text-align: center;
  padding: 10px 6px; border: 1px solid var(--line); border-radius: 12px; cursor: pointer;
  font-size: 0.85rem;
}
.liker-row label.picked { border-color: var(--accent); background: rgba(14, 107, 86, 0.4); }
.hotspot-stage { position: relative; display: inline-block; max-width: 100%; }
.hotspot-stage img { display: block; max-width: 100%; height: auto; border-radius: 10px; }
.hotspot-region {
  position: absolute; border: 2px solid rgba(143, 208, 180, 0.7);
  background: rgba(14, 107, 86, 0.2); cursor: pointer;
}
.hotspot-region.picked { border-color: #fff; background: rgba(14, 107, 86, 0.55); }
.mail-shell {
  display: grid; grid-template-columns: minmax(200px, 0.9fr) minmax(0, 1.4fr); gap: 12px;
}
@media (max-width: 720px) {
  .mail-shell { grid-template-columns: 1fr; }
}
.mail-list { display: grid; gap: 8px; }
.mail-card {
  display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start;
  text-align: left; border: 1px solid rgba(246, 243, 236, 0.28); border-radius: 12px;
  padding: 12px; background: #f4f0e7; color: #1b2430; cursor: pointer;
}
.mail-card.active { border-color: var(--accent-fill); box-shadow: 0 0 0 2px rgba(14, 107, 86, 0.25); }
.mail-avatar {
  width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
  background: #0e6b56; color: #fff; font-weight: 700; font-size: 0.85rem;
}
.mail-badge {
  display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 999px;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
}
.mail-badge.phish { background: #f8e8e4; color: #8d2f2f; }
.mail-badge.safe { background: #e5f4ef; color: #0a5343; }
.timer-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
  background: rgba(14, 107, 86, 0.35); color: #fff; font-weight: 700; width: fit-content;
}
.story-card, .step-card, .light-card {
  display: grid; gap: 16px; padding: 20px; border-radius: var(--radius);
  border: 1px solid #d7d1c6; background: #fffdf8; color: #1b2430;
}
.story-card h2, .step-card h2, .light-card h2 { color: #1b2430; margin: 0; }
.story-card p, .step-card p, .light-card p { margin: 0; line-height: 1.55; color: #2a3441; }
.story-actions, .step-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.story-actions .btn-agree,
.story-actions .btn-ignore {
  background: var(--accent-fill);
  color: #fff;
}
.module-shell {
  display: grid; gap: 14px; padding: 18px; border-radius: var(--radius);
  border: 1px solid var(--line); background: var(--panel);
}
.ransom-desk {
  display: grid; gap: 14px; padding: 18px; border-radius: 16px;
  background: linear-gradient(160deg, #1a2330, #121820); border: 1px solid rgba(246,243,236,0.2);
}
.ransom-file {
  display: flex; gap: 12px; align-items: center; padding: 14px; border-radius: 12px;
  background: #fffdf8; color: #1b2430;
}
.ransom-file .icon {
  width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center;
  background: #f0a8a0; color: #5c1a1a; font-weight: 800;
}
.ransom-choice {
  width: 100%; text-align: left; padding: 14px 16px; border-radius: 12px;
  border: 1px solid rgba(246,243,236,0.3); background: rgba(255,255,255,0.06);
  color: var(--ink); font-weight: 650; cursor: pointer;
}
.ransom-choice:hover { border-color: var(--accent); background: rgba(14, 107, 86, 0.35); }
.ransom-choice.safe-hint:hover { border-color: #8fd0b4; }
.slider-level {
  display: grid; gap: 12px;
}
.slider-level input[type="range"] {
  width: 100%; accent-color: var(--accent-fill);
}
.slider-level .ticks {
  display: flex; justify-content: space-between; gap: 8px; font-size: 0.8rem; color: #5c6b7a;
}
.slider-level .current-label {
  font-weight: 700; color: #0a5343; font-size: 1.05rem;
}
`;

function baseCss() {
  return BASE_CSS;
}

module.exports = { BASE_CSS, baseCss };
