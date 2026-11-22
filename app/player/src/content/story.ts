import { clear, el, textOf, asRecord } from "./dom";
import type { MountContext } from "./types";

export function mountStoryBlock(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const steps = Array.isArray(specific.steps) ? specific.steps.map(asRecord) : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const block = el("div", { className: "content-block" });
  let stepIndex = 0;
  let storyIndex = 0;
  let correct = 0;
  let total = 0;

  function render(): void {
    block.replaceChildren();
    if (!steps.length) {
      block.append(el("p", { className: "muted" }, "No story steps were provided."));
      ctx.reportComplete(true);
      return;
    }
    const step = steps[stepIndex];
    const stories = Array.isArray(step.stories) ? step.stories.map(asRecord) : [];
    const card = el("div", { className: "story-card" });
    card.append(el("p", { className: "muted" }, `Step ${stepIndex + 1} of ${steps.length}`));
    card.append(el("h2", {}, textOf(step.title, `Step ${stepIndex + 1}`)));
    if (textOf(step.description)) card.append(el("p", {}, textOf(step.description)));
    const story = stories[storyIndex] || {};
    if (textOf(story.description)) card.append(el("p", {}, textOf(story.description)));
    if (textOf(story.featureImage)) {
      card.append(el("img", { src: textOf(story.featureImage), alt: "", style: "max-width:100%;border-radius:10px;" }));
    }
    const agree = el("button", { type: "button", className: "btn btn-agree" }, textOf(story.agreeText, "Agree"));
    const ignore = el("button", { type: "button", className: "btn btn-ignore" }, textOf(story.ignoreText, "Ignore"));
    const advance = (choice: "AGREE" | "IGNORE") => {
      total += 1;
      const expected = textOf(story.correctSituation, "AGREE") === "AGREE" ? "AGREE" : "IGNORE";
      if (choice === expected) correct += 1;
      if (storyIndex < stories.length - 1) {
        storyIndex += 1;
        render();
        return;
      }
      if (stepIndex < steps.length - 1) {
        stepIndex += 1;
        storyIndex = 0;
        render();
        return;
      }
      const score = total ? Math.round((correct / total) * 100) : 100;
      const passed = score >= ctx.mastery;
      const complete = !ctx.requirePass || passed;
      ctx.reportScore(score, passed, complete);
    };
    agree.addEventListener("click", () => advance("AGREE"));
    ignore.addEventListener("click", () => advance("IGNORE"));
    card.append(el("div", { className: "story-actions" }, agree, ignore));
    block.append(card);
  }

  render();
  ctx.root.append(block);
  ctx.setStatus("Work through each story.");
}

export function mountSliderLevel(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const steps = Array.isArray(specific.steps) ? specific.steps.map(asRecord) : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const block = el("div", { className: "content-block" });
  let stepIndex = 0;
  let scorePoints = 0;
  let answered = 0;

  function render(): void {
    block.replaceChildren();
    if (!steps.length) {
      block.append(el("p", { className: "muted" }, "No slider steps were provided."));
      ctx.reportComplete(true);
      return;
    }
    const step = steps[stepIndex];
    const buttons = Array.isArray(step.buttons) ? step.buttons.map(asRecord) : [];
    const card = el("div", { className: "step-card" });
    card.append(el("p", { className: "muted" }, `Step ${stepIndex + 1} of ${steps.length}`));
    card.append(el("h2", {}, textOf(step.title, `Step ${stepIndex + 1}`)));
    if (textOf(step.description)) card.append(el("p", {}, textOf(step.description)));

    if (!buttons.length) {
      card.append(el("p", {}, "No slider options were provided."));
      block.append(card);
      return;
    }

    const sliderWrap = el("div", { className: "slider-level" });
    const range = el("input", {
      type: "range",
      min: "0",
      max: String(Math.max(0, buttons.length - 1)),
      value: "0",
      step: "1",
    }) as HTMLInputElement;
    const label = el("div", { className: "current-label" });
    const ticks = el("div", { className: "ticks" });
    buttons.forEach((button) => {
      ticks.append(
        el("span", {}, textOf(button.correctAcceptanceText, button.acceptanceText, "Level"))
      );
    });

    function syncLabel(): void {
      const picked = buttons[Number(range.value)] || {};
      label.textContent = textOf(
        picked.acceptanceText,
        picked.navigationButtonText,
        picked.correctAcceptanceText,
        "Select a level"
      );
    }
    syncLabel();
    range.addEventListener("input", syncLabel);

    const confirm = el("button", { type: "button", className: "btn btn-continue" }, "Confirm");
    confirm.addEventListener("click", () => {
      answered += 1;
      const picked = buttons[Number(range.value)] || {};
      const level = textOf(picked.correctAcceptanceText, "ACCEPTABLE");
      if (level === "ACCEPTABLE") scorePoints += 1;
      else if (level === "WARNING") scorePoints += 0.5;
      if (stepIndex < steps.length - 1) {
        stepIndex += 1;
        render();
        return;
      }
      const score = answered ? Math.round((scorePoints / answered) * 100) : 100;
      const passed = score >= ctx.mastery;
      const complete = !ctx.requirePass || passed;
      ctx.reportScore(score, passed, complete);
    });

    sliderWrap.append(label, range, ticks, confirm);
    card.append(sliderWrap);
    block.append(card);
  }

  render();
  ctx.root.append(block);
  ctx.setStatus("Slide to a level, then confirm.");
}
