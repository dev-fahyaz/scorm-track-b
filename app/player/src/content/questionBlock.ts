import { asRecord, clear, el, textOf } from "./dom";
import { interaction } from "./score";
import type { MountContext } from "./types";

export function mountQuestionBlock(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const options = Array.isArray(specific.options) ? specific.options : [];
  const panel = el("div", { className: "panel" });
  panel.append(el("h2", {}, textOf(specific.question, ctx.item.title, "Question")));
  const list = el("div", { className: "choices" });
  const inputs: HTMLInputElement[] = [];
  options.forEach((entry, index) => {
    const option = asRecord(entry);
    const id = `q-opt-${index}`;
    const input = el("input", { type: "radio", name: "question-block", id, value: String(index) });
    inputs.push(input);
    const label = el("label", { className: "choice", for: id }, input, textOf(option.option, `Option ${index + 1}`));
    input.addEventListener("change", () => {
      list.querySelectorAll(".choice").forEach((node) => node.classList.remove("picked"));
      label.classList.add("picked");
    });
    list.append(label);
  });
  panel.append(list);
  const submit = el("button", { type: "button", className: "primary" }, "Submit");
  submit.addEventListener("click", () => {
    const picked = inputs.findIndex((input) => input.checked);
    if (picked < 0) {
      ctx.setStatus("Choose an answer.");
      return;
    }
    const correctIndexes = options
      .map((entry, index) => (asRecord(entry).isCorrect ? index : -1))
      .filter((index) => index >= 0);
    const correct = correctIndexes.includes(picked);
    const score = correct ? 100 : 0;
    const passed = score >= ctx.mastery;
    const complete = !ctx.requirePass || passed;
    ctx.reportScore(score, passed, complete, [
      interaction("question-1", String(picked), correct, correctIndexes.map(String)),
    ]);
    submit.disabled = true;
    inputs.forEach((input) => {
      input.disabled = true;
    });
  });
  panel.append(submit);
  ctx.root.append(panel);
  ctx.setStatus("Answer the question.");
}
