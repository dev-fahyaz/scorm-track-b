import { asRecord, clear, el, textOf } from "./dom";
import { interaction } from "./score";
import type { MountContext } from "./types";
import type { InteractionRecord } from "../runtime";

function finish(ctx: MountContext, score: number, interactions: InteractionRecord[]): void {
  const passed = score >= ctx.mastery;
  const complete = !ctx.requirePass || passed;
  ctx.reportScore(score, passed, complete, interactions);
}

export function mountMatching(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const pairs = Array.isArray(specific.pairs) ? specific.pairs.map(asRecord) : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "panel" });
  panel.append(el("h2", {}, textOf(specific.question, ctx.item.title)));
  const rights = pairs.map((pair, index) => ({
    index,
    label: textOf(pair.valueRight, pair.linkRight, `Item ${index + 1}`),
  }));
  const shuffled = rights.slice().sort(() => Math.random() - 0.5);
  const selects: HTMLSelectElement[] = [];

  pairs.forEach((pair, index) => {
    const row = el("div", { className: "pair-row" });
    const left = textOf(pair.valueLeft, pair.linkLeft, `Left ${index + 1}`);
    if (pair.inputTypeLeft === "image" && textOf(pair.linkLeft)) {
      row.append(el("img", { src: textOf(pair.linkLeft), alt: left, style: "max-width:100%;border-radius:8px;" }));
    } else {
      row.append(el("div", {}, left));
    }
    const select = el("select", { className: "field-input" }) as HTMLSelectElement;
    select.append(el("option", { value: "" }, "Match…"));
    shuffled.forEach((entry) => {
      select.append(el("option", { value: String(entry.index) }, entry.label));
    });
    selects.push(select);
    row.append(select);
    panel.append(row);
  });

  const submit = el("button", { type: "button", className: "primary" }, "Check matches");
  submit.addEventListener("click", () => {
    let correct = 0;
    selects.forEach((select, index) => {
      if (Number(select.value) === index) correct += 1;
      select.disabled = true;
    });
    const score = pairs.length ? Math.round((correct / pairs.length) * 100) : 0;
    finish(ctx, score, [
      interaction(
        "matching-1",
        selects.map((select) => select.value).join(","),
        score >= ctx.mastery,
        pairs.map((_, index) => String(index))
      ),
    ]);
    submit.disabled = true;
  });
  panel.append(submit);
  ctx.root.append(panel);
  ctx.setStatus("Match each item on the left.");
}

export function mountOrdering(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const options = Array.isArray(specific.options) ? specific.options.map(asRecord) : [];
  const order = options
    .map((option, index) => ({ option, index }))
    .sort(() => Math.random() - 0.5);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "panel" });
  panel.append(el("h2", {}, textOf(specific.question, ctx.item.title)));
  const list = el("div", { className: "order-list" });
  const state = order.slice();

  function render(): void {
    list.replaceChildren();
    state.forEach((entry, position) => {
      const row = el("div", { className: "order-item" });
      const label = textOf(entry.option.optionText, entry.option.optionImageLink, `Item ${entry.index + 1}`);
      row.append(el("span", {}, `${position + 1}. ${label}`));
      const up = el("button", { type: "button", className: "btn" }, "Up");
      const down = el("button", { type: "button", className: "btn" }, "Down");
      up.disabled = position === 0;
      down.disabled = position === state.length - 1;
      up.addEventListener("click", () => {
        const swap = state[position - 1];
        state[position - 1] = state[position];
        state[position] = swap;
        render();
      });
      down.addEventListener("click", () => {
        const swap = state[position + 1];
        state[position + 1] = state[position];
        state[position] = swap;
        render();
      });
      row.append(up, down);
      list.append(row);
    });
  }

  render();
  const submit = el("button", { type: "button", className: "primary" }, "Submit order");
  submit.addEventListener("click", () => {
    const correct = state.every((entry, position) => entry.index === position);
    const score = correct ? 100 : 0;
    finish(ctx, score, [
      interaction(
        "ordering-1",
        state.map((entry) => String(entry.index)).join(","),
        correct,
        options.map((_, index) => String(index))
      ),
    ]);
    submit.disabled = true;
  });
  panel.append(list, submit);
  ctx.root.append(panel);
  ctx.setStatus("Put the steps in the correct order.");
}

export function mountLiker(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const options = Array.isArray(specific.options) ? specific.options.map(asRecord) : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "panel" });
  panel.append(el("h2", {}, textOf(specific.question, ctx.item.title)));
  const row = el("div", { className: "liker-row" });
  let picked = -1;
  options.forEach((option, index) => {
    const label = el(
      "label",
      {},
      el("input", { type: "radio", name: "liker", value: String(index) }),
      textOf(option.optionText, option.optionImageLink, `Option ${index + 1}`)
    );
    label.querySelector("input")?.addEventListener("change", () => {
      picked = index;
      row.querySelectorAll("label").forEach((node) => node.classList.remove("picked"));
      label.classList.add("picked");
    });
    row.append(label);
  });
  const submit = el("button", { type: "button", className: "primary" }, "Submit");
  submit.addEventListener("click", () => {
    if (picked < 0) {
      ctx.setStatus("Choose a rating.");
      return;
    }
    finish(ctx, 100, [interaction("liker-1", String(picked), true)]);
    submit.disabled = true;
  });
  panel.append(row, submit);
  ctx.root.append(panel);
  ctx.setStatus("Choose the option that fits best.");
}

export function mountPicture(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const options = Array.isArray(specific.options) ? specific.options.map(asRecord) : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "panel" });
  panel.append(el("h2", {}, textOf(specific.question, ctx.item.title)));
  const grid = el("div", { className: "picture-grid" });
  const selected = new Set<number>();
  options.forEach((option, index) => {
    const image = textOf(option.optionImageLink, option.optionImage);
    const label = el("label", {});
    const input = el("input", { type: "checkbox", value: String(index) });
    input.addEventListener("change", () => {
      if (input.checked) selected.add(index);
      else selected.delete(index);
      label.classList.toggle("picked", input.checked);
    });
    if (image) label.append(el("img", { src: image, alt: textOf(option.optionText, `Choice ${index + 1}`) }));
    label.append(input, textOf(option.optionText, `Choice ${index + 1}`));
    grid.append(label);
  });
  const submit = el("button", { type: "button", className: "primary" }, "Submit");
  submit.addEventListener("click", () => {
    const correct = options
      .map((option, index) => (option.isCorrect ? index : -1))
      .filter((index) => index >= 0);
    const ok =
      correct.length === selected.size && correct.every((index) => selected.has(index));
    const score = ok ? 100 : 0;
    finish(ctx, score, [
      interaction("picture-1", [...selected].join(","), ok, correct.map(String)),
    ]);
    submit.disabled = true;
  });
  panel.append(grid, submit);
  ctx.root.append(panel);
  ctx.setStatus("Select the correct picture(s).");
}

export function mountScenario(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const questions = Array.isArray(specific.questions) ? specific.questions.map(asRecord) : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "panel" });
  const scenario = el("div", { className: "body" });
  scenario.innerHTML = textOf(specific.scenarioText) || "Scenario";
  panel.append(el("h2", {}, textOf(ctx.item.title, "Scenario")), scenario);

  const answers: number[] = questions.map(() => -1);
  questions.forEach((question, qIndex) => {
    const field = el("fieldset", {});
    field.append(el("legend", {}, textOf(question.question, `Question ${qIndex + 1}`)));
    const choices = el("div", { className: "choices" });
    const options = Array.isArray(question.options) ? question.options.map(asRecord) : [];
    options.forEach((option, oIndex) => {
      const id = `scenario-${qIndex}-${oIndex}`;
      const input = el("input", { type: "radio", name: `scenario-${qIndex}`, id, value: String(oIndex) });
      input.addEventListener("change", () => {
        answers[qIndex] = oIndex;
      });
      choices.append(el("label", { className: "choice", for: id }, input, textOf(option.option, `Option ${oIndex + 1}`)));
    });
    field.append(choices);
    panel.append(field);
  });

  const submit = el("button", { type: "button", className: "primary" }, "Submit");
  submit.addEventListener("click", () => {
    if (answers.some((value) => value < 0)) {
      ctx.setStatus("Answer every question.");
      return;
    }
    let correct = 0;
    const interactions: InteractionRecord[] = [];
    questions.forEach((question, qIndex) => {
      const options = Array.isArray(question.options) ? question.options.map(asRecord) : [];
      const correctIndexes = options
        .map((option, index) => (option.isCorrect ? index : -1))
        .filter((index) => index >= 0);
      const ok = correctIndexes.includes(answers[qIndex]);
      if (ok) correct += 1;
      interactions.push(
        interaction(`scenario-${qIndex + 1}`, String(answers[qIndex]), ok, correctIndexes.map(String))
      );
    });
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    finish(ctx, score, interactions);
    submit.disabled = true;
  });
  panel.append(submit);
  ctx.root.append(panel);
  ctx.setStatus("Read the scenario and answer the questions.");
}
