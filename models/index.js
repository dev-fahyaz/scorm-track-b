"use strict";

const contentTypes = require("./contentTypes");
const defaults = require("./defaults");
const shapes = require("./shapes");
const validate = require("./validate");
const templates = require("./templates");

module.exports = {
  ...contentTypes,
  defaults,
  shapes,
  validate,
  templates,
  CONTENT_TYPES: contentTypes.CONTENT_TYPES,
  QUIZ_TYPES: contentTypes.QUIZ_TYPES,
  emptyContentItem: shapes.emptyContentItem,
  emptySpecific: shapes.emptySpecific,
  validateContentItem: validate.validateContentItem,
  validateLessonItems: validate.validateLessonItems,
  timeToSeconds: validate.timeToSeconds,
  shellHtml: templates.shellHtml,
};
