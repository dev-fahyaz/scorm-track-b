import type { ScormAdapter } from "../runtime";
import type { InteractionRecord } from "../runtime";

export interface ContentCommon {
  contentName?: string;
  description?: string;
  contentType?: string;
  status?: string;
  author?: string;
  tags?: string[];
}

export interface CourseItem {
  type?: string;
  contentType?: string;
  title?: string;
  url?: string;
  videoUrl?: string;
  href?: string;
  questions?: unknown;
  slides?: unknown;
  common?: ContentCommon;
  specific?: Record<string, unknown>;
  legacyQuiz?: boolean;
  width?: number;
  height?: number;
}

export interface MountContext {
  root: HTMLElement;
  quizRoot: HTMLElement;
  video: HTMLVideoElement;
  youtubeFrame: HTMLElement;
  item: CourseItem;
  adapter: ScormAdapter | null;
  mastery: number;
  requirePass: boolean;
  threshold: number;
  sessionStart: number;
  apiName: string;
  poster: string | null;
  setStatus: (text: string) => void;
  reportScore: (score: number, passed: boolean, complete: boolean, interactions?: InteractionRecord[]) => void;
  reportComplete: (complete: boolean) => void;
  /** When false, completion does not request LMS continue (nested overlays). Default true. */
  autoAdvance?: boolean;
}

export type MountResult = void | Promise<void>;
