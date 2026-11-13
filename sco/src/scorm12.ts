import type { Scorm12Runtime, ScormAdapter } from "./runtime";
import { accepted } from "./runtime";
import { formatScorm12 } from "./time";

export class Scorm12Adapter implements ScormAdapter {
  private completed = false;
  private success: boolean | null = null;
  private lockedComplete = false;
  private finished = false;

  constructor(private readonly api: Scorm12Runtime) {}

  initialize(): boolean {
    const ok = accepted(this.api.LMSInitialize(""));
    const status = this.api.LMSGetValue("cmi.core.lesson_status") || "";
    if (status === "passed" || status === "completed" || status === "failed") {
      this.completed = true;
      this.lockedComplete = status !== "failed";
      this.success = status === "passed" ? true : status === "failed" ? false : null;
    } else if (status === "not attempted" || status === "" || status === "browsed") {
      this.api.LMSSetValue("cmi.core.lesson_status", "incomplete");
    }
    return ok;
  }

  getLearner(): { id: string; name: string } {
    return {
      id: this.api.LMSGetValue("cmi.core.student_id") || "",
      name: this.api.LMSGetValue("cmi.core.student_name") || "",
    };
  }

  getBookmark(): string {
    return this.api.LMSGetValue("cmi.core.lesson_location") || "";
  }

  setBookmark(value: string): void {
    this.api.LMSSetValue("cmi.core.lesson_location", value);
  }

  getSuspendData(): string {
    return this.api.LMSGetValue("cmi.suspend_data") || "";
  }

  setSuspendData(value: string): void {
    this.api.LMSSetValue("cmi.suspend_data", value);
  }

  setProgress(_fraction: number): void {
    // SCORM 1.2 has no progress field. The bitmap in suspend_data is the record.
  }

  setCompletion(completed: boolean): void {
    if (this.lockedComplete && !completed) return;
    this.completed = completed;
    this.writeStatus();
  }

  setSuccess(passed: boolean | null): void {
    if (this.lockedComplete && passed !== true) return;
    this.success = passed;
    this.writeStatus();
  }

  setScore(raw: number, min: number, max: number): void {
    this.api.LMSSetValue("cmi.core.score.raw", String(raw));
    this.api.LMSSetValue("cmi.core.score.min", String(min));
    this.api.LMSSetValue("cmi.core.score.max", String(max));
  }

  setSessionTime(seconds: number): void {
    this.api.LMSSetValue("cmi.core.session_time", formatScorm12(seconds));
  }

  commit(): boolean {
    return accepted(this.api.LMSCommit(""));
  }

  terminate(): boolean {
    if (this.finished) return true;
    this.finished = true;
    this.api.LMSSetValue("cmi.core.exit", this.completed ? "" : "suspend");
    const committed = this.commit();
    return committed && accepted(this.api.LMSFinish(""));
  }

  private writeStatus(): void {
    let status = "incomplete";
    if (this.completed && this.success === true) status = "passed";
    else if (this.completed && this.success === false) status = "failed";
    else if (this.completed) status = "completed";
    this.api.LMSSetValue("cmi.core.lesson_status", status);
  }
}
