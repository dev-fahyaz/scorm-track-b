"use strict";

/**
 * Wrap content items from an external course builder into a package request body.
 * Integrators can call buildCourse(fromContent({...})) or POST the result to /api/packages.
 */
function fromContent(options) {
  const opts = options || {};
  const items = Array.isArray(opts.items) ? opts.items : [];
  const lessons = Array.isArray(opts.lessons) && opts.lessons.length
    ? opts.lessons
    : [{ title: opts.lessonTitle || "Lesson 1", items }];

  return {
    version: opts.version || "1.2",
    title: opts.title || "Course",
    organization: opts.organization || "Organization",
    language: opts.language || "en",
    identifier: opts.identifier || "course",
    masteryScore: typeof opts.masteryScore === "number" ? opts.masteryScore : 80,
    completionThreshold: typeof opts.completionThreshold === "number" ? opts.completionThreshold : 90,
    requireQuizPass: opts.requireQuizPass !== false,
    note: opts.note,
    posterDataUrl: opts.posterDataUrl,
    lessons,
    package: Object.assign(
      {
        name: opts.packageName || opts.title || "Course",
        version: opts.packageVersion || "1.0.0",
        author: opts.author || "",
        description: opts.description || "",
        keywords: Array.isArray(opts.keywords) ? opts.keywords : [],
        duration: opts.duration || "PT0H0M0S",
        typicalDuration: opts.typicalDuration || opts.duration || "PT0H0M0S",
        rights: opts.rights || "",
        zip: true,
        vcard: {
          author: opts.author || "",
          org: opts.vcardOrg || opts.organization || "",
          tel: opts.vcardTel || "",
          address: opts.vcardAddress || "",
          mail: opts.vcardMail || "",
          url: opts.vcardUrl || "",
        },
      },
      opts.package || {}
    ),
  };
}

module.exports = { fromContent };
