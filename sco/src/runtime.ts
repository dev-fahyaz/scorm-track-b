export interface Scorm12Runtime {
  LMSInitialize(param: string): string | boolean;
  LMSFinish(param: string): string | boolean;
  LMSGetValue(key: string): string;
  LMSSetValue(key: string, value: string): string | boolean;
  LMSCommit(param: string): string | boolean;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
  LMSGetDiagnostic(code: string): string;
}

export interface Scorm2004Runtime {
  Initialize(param: string): string | boolean;
  Terminate(param: string): string | boolean;
  GetValue(key: string): string;
  SetValue(key: string, value: string): string | boolean;
  Commit(param: string): string | boolean;
  GetLastError(): string;
  GetErrorString(code: string): string;
  GetDiagnostic(code: string): string;
}

export interface ScormAdapter {
  initialize(): boolean;
  getLearner(): { id: string; name: string };
  getBookmark(): string;
  setBookmark(value: string): void;
  getSuspendData(): string;
  setSuspendData(value: string): void;
  setProgress(fraction: number): void;
  setCompletion(completed: boolean): void;
  setSuccess(passed: boolean | null): void;
  setScore(raw: number, min: number, max: number): void;
  setSessionTime(seconds: number): void;
  commit(): boolean;
  terminate(): boolean;
}

export function accepted(result: string | boolean): boolean {
  return result === true || result === "true";
}

export type FoundApi =
  | { kind: "1.2"; api: Scorm12Runtime }
  | { kind: "2004"; api: Scorm2004Runtime };

function readWindow(win: Window): { api12?: Scorm12Runtime; api2004?: Scorm2004Runtime } {
  const host = win as Window & {
    API?: Scorm12Runtime;
    API_1484_11?: Scorm2004Runtime;
  };
  return { api12: host.API, api2004: host.API_1484_11 };
}

function walk(start: Window, visit: (win: Window) => void): void {
  const seen = new Set<Window>();
  const queue: Window[] = [start];
  while (queue.length > 0 && seen.size < 12) {
    const win = queue.shift();
    if (!win || seen.has(win)) continue;
    seen.add(win);
    try {
      visit(win);
    } catch {
      continue;
    }
    try {
      if (win.parent && win.parent !== win) queue.push(win.parent);
    } catch {
      // Cross-origin parent. The API has to live on a window we can read.
    }
    try {
      if (win.opener && win.opener !== win) queue.push(win.opener);
    } catch {
      // Cross-origin opener.
    }
  }
}

export function findApi(start: Window, prefer2004: boolean): FoundApi | null {
  let fallback: FoundApi | null = null;
  let preferred: FoundApi | null = null;

  walk(start, (win) => {
    if (preferred) return;
    let apis: { api12?: Scorm12Runtime; api2004?: Scorm2004Runtime };
    try {
      apis = readWindow(win);
    } catch {
      return;
    }
    if (prefer2004 && apis.api2004) {
      preferred = { kind: "2004", api: apis.api2004 };
      return;
    }
    if (!prefer2004 && apis.api12) {
      preferred = { kind: "1.2", api: apis.api12 };
      return;
    }
    if (!fallback && apis.api2004) fallback = { kind: "2004", api: apis.api2004 };
    if (!fallback && apis.api12) fallback = { kind: "1.2", api: apis.api12 };
  });

  return preferred || fallback;
}
