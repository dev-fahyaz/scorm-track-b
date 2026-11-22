import type { InteractionRecord } from "../runtime";

export function interaction(
  id: string,
  response: string,
  ok: boolean,
  correct: string | string[] = []
): InteractionRecord {
  return {
    id,
    type: "choice",
    response,
    correct: Array.isArray(correct) ? correct : correct ? [correct] : [],
    result: ok ? "correct" : "wrong",
  };
}
