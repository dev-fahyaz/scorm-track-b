import { asRecord, clear, el, textOf } from "./dom";
import { interaction } from "./score";
import type { MountContext } from "./types";

export function mountPasswordCompliance(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "module-shell" });
  panel.append(el("h2", {}, "Password compliance"));
  if (textOf(specific.question)) panel.append(el("p", { className: "muted" }, textOf(specific.question)));
  const input = el("input", {
    type: "password",
    className: "field-input",
    placeholder: "Enter a password to check",
  }) as HTMLInputElement;
  const notes = el("ul", { className: "muted" });
  const submit = el("button", { type: "button", className: "primary btn-continue" }, "Check password");
  submit.addEventListener("click", () => {
    const value = input.value;
    const checks = [
      { ok: value.length >= 12, text: "At least 12 characters" },
      { ok: /[A-Z]/.test(value), text: "Contains an uppercase letter" },
      { ok: /[a-z]/.test(value), text: "Contains a lowercase letter" },
      { ok: /\d/.test(value), text: "Contains a number" },
      { ok: /[^A-Za-z0-9]/.test(value), text: "Contains a symbol" },
    ];
    notes.replaceChildren(...checks.map((check) => el("li", {}, `${check.ok ? "✓" : "✗"} ${check.text}`)));
    const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
    const passed = score >= ctx.mastery;
    const complete = !ctx.requirePass || passed;
    ctx.reportScore(score, passed, complete, [
      interaction("password-1", String(score), passed, "100"),
    ]);
  });
  panel.append(input, submit, notes);
  ctx.root.append(panel);
  ctx.setStatus("Check a password against the policy.");
}

export function mountRansomwareSimulator(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const desk = el("div", { className: "ransom-desk" });
  desk.append(el("h2", {}, "Ransomware simulator"));
  if (textOf(specific.question)) desk.append(el("p", { className: "muted" }, textOf(specific.question)));

  const file = el(
    "div",
    { className: "ransom-file" },
    el("div", { className: "icon" }, "ZIP"),
    el(
      "div",
      {},
      el("strong", {}, "invoice_ ent.zip"),
      el("div", {}, "Unknown sender · 2.4 MB · flagged by filters")
    )
  );
  desk.append(file);
  desk.append(el("p", {}, "A file looks suspicious. Choose the safest action."));

  const choices = [
    { text: "Open the attachment to inspect it", correct: false },
    { text: "Report it to IT and isolate the device", correct: true },
    { text: "Pay if a ransom note appears", correct: false },
  ];
  const list = el("div", { className: "choices" });
  choices.forEach((choice, index) => {
    const button = el(
      "button",
      { type: "button", className: "ransom-choice" + (choice.correct ? " safe-hint" : "") },
      choice.text
    );
    button.addEventListener("click", () => {
      const score = choice.correct ? 100 : 0;
      const passed = score >= ctx.mastery;
      const complete = !ctx.requirePass || passed;
      ctx.reportScore(score, passed, complete, [
        interaction("ransomware-1", String(index), choice.correct, "1"),
      ]);
      list.querySelectorAll("button").forEach((node) => {
        (node as HTMLButtonElement).disabled = true;
      });
    });
    list.append(button);
  });
  desk.append(list);
  ctx.root.append(desk);
  ctx.setStatus("Choose the safest response.");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

export function mountPhishingDetection(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const emails = Array.isArray(specific.emails) ? specific.emails.map(asRecord) : [];
  const limit = Math.max(10, Number(specific.timeLimitSeconds) || 180);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "module-shell" });
  panel.append(el("h2", {}, "Phishing detection"));
  if (textOf(specific.question)) panel.append(el("p", { className: "muted" }, textOf(specific.question)));
  const timer = el("div", { className: "timer-chip" }, `Time left: ${limit}s`);
  const shell = el("div", { className: "mail-shell" });
  const mailList = el("div", { className: "mail-list" });
  const detail = el("div", { className: "light-card" });
  let remaining = limit;
  let active = 0;
  const answers = new Map<number, boolean>();

  const tick = window.setInterval(() => {
    remaining -= 1;
    timer.textContent = `Time left: ${Math.max(0, remaining)}s`;
    if (remaining <= 0) {
      window.clearInterval(tick);
      grade();
    }
  }, 1000);

  function renderList(): void {
    mailList.replaceChildren();
    emails.forEach((email, index) => {
      const marked = answers.get(index);
      const card = el("button", { type: "button", className: "mail-card" + (index === active ? " active" : "") });
      card.append(
        el("div", { className: "mail-avatar" }, initials(textOf(email.senderName, email.senderEmail, "?"))),
        el(
          "div",
          {},
          el("strong", {}, textOf(email.subject, `Message ${index + 1}`)),
          el("div", {}, textOf(email.senderEmail)),
          marked == null
            ? null
            : el("span", { className: "mail-badge " + (marked ? "phish" : "safe") }, marked ? "Phishing" : "Safe")
        )
      );
      card.addEventListener("click", () => {
        active = index;
        renderList();
        renderDetail();
      });
      mailList.append(card);
    });
  }

  function renderDetail(): void {
    const email = emails[active] || {};
    detail.replaceChildren();
    detail.append(
      el("h3", {}, textOf(email.subject, "No subject")),
      el("p", {}, `${textOf(email.senderName)} · ${textOf(email.senderEmail)}`),
      el("div", { className: "body" }, (() => {
        const node = el("div");
        node.innerHTML = textOf(email.body) || "";
        return node;
      })())
    );
    const phishing = el("button", { type: "button", className: "btn btn-phish" }, "Mark phishing");
    const safe = el("button", { type: "button", className: "btn btn-continue" }, "Mark safe");
    phishing.addEventListener("click", () => {
      answers.set(active, true);
      renderList();
      ctx.setStatus("Marked as phishing.");
    });
    safe.addEventListener("click", () => {
      answers.set(active, false);
      renderList();
      ctx.setStatus("Marked as safe.");
    });
    detail.append(el("div", { className: "content-bar" }, phishing, safe));
  }

  function grade(): void {
    window.clearInterval(tick);
    let correct = 0;
    emails.forEach((email, index) => {
      const expected = email.isPhishing !== false;
      if (answers.get(index) === expected) correct += 1;
    });
    const score = emails.length ? Math.round((correct / emails.length) * 100) : 0;
    const passed = score >= ctx.mastery;
    const complete = !ctx.requirePass || passed;
    ctx.reportScore(score, passed, complete, [
      interaction("phishing-1", String(correct), passed, String(emails.length)),
    ]);
  }

  const done = el("button", { type: "button", className: "primary btn-continue" }, "Submit mailbox");
  done.addEventListener("click", grade);
  shell.append(mailList, detail);
  panel.append(timer, shell, done);
  renderList();
  renderDetail();
  ctx.root.append(panel);
  ctx.setStatus("Review each message before time runs out.");
}
