export interface QuizQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export function mountQuiz(
  root: HTMLElement,
  title: string,
  questions: QuizQuestion[],
  onSubmit: (score: number) => void
): void {
  root.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = title;
  const form = document.createElement("form");
  const message = document.createElement("p");

  questions.forEach((question, questionIndex) => {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = question.prompt;
    fieldset.append(legend);
    question.choices.forEach((choice, choiceIndex) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `q-${questionIndex}`;
      input.value = String(choiceIndex);
      label.append(input, document.createTextNode(` ${choice}`));
      fieldset.append(label);
    });
    form.append(fieldset);
  });

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Submit quiz";
  form.append(message, button);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    let correct = 0;
    for (let index = 0; index < questions.length; index += 1) {
      const selected = form.querySelector<HTMLInputElement>(`input[name="q-${index}"]:checked`);
      if (!selected) {
        message.textContent = "Answer every question.";
        return;
      }
      if (Number(selected.value) === questions[index].correctIndex) correct += 1;
    }
    const score = Math.round((correct / questions.length) * 100);
    message.textContent = `Score ${score}. ${correct} of ${questions.length} correct.`;
    button.disabled = true;
    onSubmit(score);
  });
  root.append(heading, form);
}
