function leaf(title, href, suffix) {
  return { title: title, href: href, suffix: suffix };
}

function manifestTree(obj) {
  if (!Array.isArray(obj.lessons) || !obj.lessons.length) {
    var only = leaf(obj.title, obj.startingPage || "index.html", "");
    return { nodes: [{ kind: "sco", leaf: only }], resources: [only] };
  }

  var nested = obj.lessons.some(function(lesson) {
    return lesson && Array.isArray(lesson.items);
  });
  if (!nested) {
    var flatResources = obj.lessons.map(function(lesson, index) {
      return leaf(
        (lesson && lesson.title) || obj.title || "Lesson " + (index + 1),
        (lesson && lesson.href) || "lesson-" + (index + 1) + ".html",
        "_" + (index + 1)
      );
    });
    return {
      nodes: flatResources.map(function(item) {
        return { kind: "sco", leaf: item };
      }),
      resources: flatResources
    };
  }

  var nodes = [];
  var resources = [];
  obj.lessons.forEach(function(lesson, lessonIndex) {
    var items = (lesson && lesson.items) || [];
    var leaves = items.map(function(item, itemIndex) {
      var number = lessonIndex + 1;
      var href = item && item.href
        ? item.href
        : items.length === 1
          ? "lesson-" + number + ".html"
          : "lesson-" + number + "-" + (itemIndex + 1) + ".html";
      var suffix = items.length === 1 ? "_" + number : "_" + number + "_" + (itemIndex + 1);
      return leaf((item && item.title) || (lesson && lesson.title) || "Lesson " + number, href, suffix);
    });
    leaves.forEach(function(item) {
      resources.push(item);
    });
    if (leaves.length <= 1) {
      if (leaves[0]) nodes.push({ kind: "sco", leaf: leaves[0] });
      return;
    }
    nodes.push({
      kind: "folder",
      suffix: "_" + (lessonIndex + 1),
      title: (lesson && lesson.title) || "Lesson " + (lessonIndex + 1),
      children: leaves
    });
  });
  return { nodes: nodes, resources: resources };
}

function filesForLesson(allFiles, href) {
  var selected = (allFiles || []).filter(function(file) {
    var name = String((file && file["@href"]) || "").split("/").pop();
    return name === href || name === "player.js" || name === "config.json" || name.indexOf("poster.") === 0;
  });
  return selected.length ? selected : allFiles;
}

module.exports = {
  manifestTree: manifestTree,
  filesForLesson: filesForLesson
};
