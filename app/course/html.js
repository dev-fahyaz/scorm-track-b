"use strict";

const { shellHtml } = require("../../models/templates");

function courseHtml(title, lessonIndex, itemIndex) {
  return shellHtml(title, lessonIndex, itemIndex);
}

module.exports = { courseHtml };
