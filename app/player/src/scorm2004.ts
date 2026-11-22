import type { InteractionRecord, Scorm2004Runtime, ScormAdapter } from "./runtime";
import { accepted } from "./runtime";
import { formatScorm2004 } from "./time";

export class Scorm2004Adapter implements ScormAdapter {
  private completed = false;
  private lockedComplete = false;
  private lockedSuccess = false;
  private finished = false;

  constructor(private readonly api: Scorm2004Runtime) {}

  initialize(): boolean {
    const ok = accepted(this.api.Initialize(""));
    const status = this.api.GetValue("cmi.completion_status") || "";
    if (status === "completed") {
      this.completed = true;
      this.lockedComplete = true;
    } else if (status === "not attempted" || status === "unknown" || status === "") {
      this.api.SetValue("cmi.completion_status", "incomplete");
    }
    if (this.api.GetValue("cmi.success_status") === "passed") {
      this.lockedSuccess = true;
    }
    return ok;
  }

  getLearner(): { id: string; name: string } {
    return {
      id: this.api.GetValue("cmi.learner_id") || "",
      name: this.api.GetValue("cmi.learner_name") || "",
    };
  }

  getBookmark(): string {
    return this.api.GetValue("cmi.location") || "";
  }

  setBookmark(value: string): void {
    this.api.SetValue("cmi.location", value);
  }

  getSuspendData(): string {
    return this.api.GetValue("cmi.suspend_data") || "";
  }

  setSuspendData(value: string): void {
    this.api.SetValue("cmi.suspend_data", value);
  }

  setProgress(fraction: number): void {
    const clamped = Math.min(1, Math.max(0, fraction));
    this.api.SetValue("cmi.progress_measure", clamped.toFixed(4));
  }

  setCompletion(completed: boolean): void {
    if (this.lockedComplete && !completed) return;
    this.completed = completed;
    this.api.SetValue("cmi.completion_status", completed ? "completed" : "incomplete");
  }

  setSuccess(passed: boolean | null): void {
    if (this.lockedSuccess && passed !== true) return;
    const value = passed === true ? "passed" : passed === false ? "failed" : "unknown";
    this.api.SetValue("cmi.success_status", value);
  }

  setScore(raw: number, min: number, max: number): void {
    this.api.SetValue("cmi.score.raw", String(raw));
    this.api.SetValue("cmi.score.min", String(min));
    this.api.SetValue("cmi.score.max", String(max));
    if (max > min) {
      const scaled = (raw - min) / (max - min);
      this.api.SetValue("cmi.score.scaled", Math.min(1, Math.max(0, scaled)).toFixed(4));
    }
  }

  setSessionTime(seconds: number): void {
    this.api.SetValue("cmi.session_time", formatScorm2004(seconds));
  }

  setInteractions(records: InteractionRecord[]): void {
    records.forEach((record, index) => {
      const base = `cmi.interactions.${index}`;
      const response = record.type === "choice"
        ? record.response.split(",").filter(Boolean).join("[,]")
        : record.response.slice(0, 1000);
      const patterns = record.type === "choice"
        ? record.correct.map((pattern) => pattern.split(",").filter(Boolean).join("[,]"))
        : record.correct.map((pattern) => pattern.slice(0, 1000));
      this.api.SetValue(`${base}.id`, record.id.slice(0, 4000));
      this.api.SetValue(`${base}.type`, record.type);
      this.api.SetValue(`${base}.learner_response`, response);
      this.api.SetValue(`${base}.result`, record.result);
      patterns.forEach((pattern, patternIndex) => {
        this.api.SetValue(`${base}.correct_responses.${patternIndex}.pattern`, pattern);
      });
    });
  }

  canRequestContinue(): boolean {
    try {
      return this.api.GetValue("adl.nav.request_valid.continue") === "true";
    } catch {
      return false;
    }
  }

  requestContinue(): void {
    try {
      this.api.SetValue("adl.nav.request", "continue");
    } catch {
      // LMS may not support navigation requests.
    }
  }

  commit(): boolean {
    return accepted(this.api.Commit(""));
  }

  terminate(): boolean {
    if (this.finished) return true;
    this.finished = true;
    this.api.SetValue("cmi.exit", this.completed ? "normal" : "suspend");
    const committed = this.commit();
    return committed && accepted(this.api.Terminate(""));
  }
}
