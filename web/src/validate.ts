import type { PackageForm } from "./types";

const DURATION = /^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/;
const LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const IDENTIFIER = /^[A-Za-z0-9._:-]+$/;
const PACKAGE_VERSION = /^[0-9A-Za-z._-]+$/;

export function organizationId(organization: string): string {
  return organization.trim().replace(/ /g, "_");
}

export function manifestId(identifier: string): string {
  return identifier.trim().replace(/ /g, "");
}

function durationOk(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "PT" && DURATION.test(trimmed);
}

export function validateForm(form: PackageForm): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.title.trim()) {
    errors.title = "Enter a course title.";
  }
  if (!form.organization.trim()) {
    errors.organization = "Enter an organization.";
  }
  if (!form.identifier.trim()) {
    errors.identifier = "Enter an identifier.";
  } else if (!IDENTIFIER.test(form.identifier.trim())) {
    errors.identifier = "Use letters, numbers, dots, hyphens, or underscores.";
  }

  const mastery = Number(form.masteryScore);
  if (!Number.isFinite(mastery) || mastery < 0 || mastery > 100) {
    errors.masteryScore = "Enter a mastery score from 0 to 100.";
  }

  if (!durationOk(form.duration)) {
    errors.duration = "Use a duration like PT0H5M0S.";
  }
  if (!durationOk(form.typicalDuration)) {
    errors.typicalDuration = "Use a duration like PT0H5M0S.";
  }

  const video = form.videoUrl.trim();
  if (!video) {
    errors.videoUrl = "Enter an https video URL.";
  } else {
    try {
      const url = new URL(video);
      if (url.protocol !== "https:") {
        errors.videoUrl = "Enter an https video URL.";
      }
    } catch {
      errors.videoUrl = "Enter an https video URL.";
    }
  }

  if (!LANGUAGE.test(form.language.trim())) {
    errors.language = "Enter a language code such as en or fr-FR.";
  }

  const version = form.packageVersion.trim() || "1.0.0";
  if (!PACKAGE_VERSION.test(version)) {
    errors.packageVersion = "Use a version such as 1.0.0.";
  }

  const threshold = Number(form.completionThreshold);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
    errors.completionThreshold = "Enter a completion threshold from 1 to 100.";
  }

  const contact = form.vcardUrl.trim();
  if (contact) {
    try {
      const url = new URL(contact);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        errors.vcardUrl = "Contact URL must start with http or https.";
      }
    } catch {
      errors.vcardUrl = "Contact URL must start with http or https.";
    }
  }

  return errors;
}
