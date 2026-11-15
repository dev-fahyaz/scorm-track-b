var guid = require("../guid.js");
var lessons = require("./lessons.js");

module.exports = function(obj) {
  var identifier = guid(obj),
    organization = obj.organization.replace(/ /g, "_");
  if (obj.identifier && obj.identifier.trim()) {
    identifier = obj.identifier.replace(/ /g, "");
  }
  var tree = lessons.manifestTree(obj);
  function metadataBlock() {
    return {
      schema: "ADL SCORM",
      schemaversion: obj.version,
      "adlcp:location": "metadata.xml"
    };
  }
  var itemIds = tree.resources.map(function(item) {
    return "item_" + identifier + item.suffix;
  });
  function scoItem(item) {
    var itemId = "item_" + identifier + item.suffix;
    var previous = itemIds[itemIds.indexOf(itemId) - 1];
    var sequencing = {
      "imsss:objectives": {
        "imsss:primaryObjective": { "@objectiveID": "obj_" + itemId }
      }
    };
    if (previous) {
      sequencing = {
        "imsss:sequencingRules": {
          "imsss:preConditionRule": {
            "imsss:ruleConditions": {
              "imsss:ruleCondition": {
                "@referencedObjective": "obj_" + previous,
                "@operator": "not",
                "@condition": "satisfied"
              }
            },
            "imsss:ruleAction": { "@action": "disabled" }
          }
        },
        "imsss:objectives": sequencing["imsss:objectives"]
      };
    }
    return {
      "@identifier": itemId,
      "@identifierref": "resource_" + identifier + item.suffix,
      title: item.title,
      metadata: metadataBlock(),
      "imsss:sequencing": sequencing
    };
  }

  return {
    "@identifier": identifier,
    "@version": 1,
    "@xmlns": "http://www.imsglobal.org/xsd/imscp_v1p1",
    "@xmlns:adlcp": "http://www.adlnet.org/xsd/adlcp_v1p3",
    "@xmlns:imsss": "http://www.imsglobal.org/xsd/imsss",
    "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "@xsi:schemaLocation": "http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd " +
      "http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd " +
      "http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd",
    metadata: metadataBlock(),
    organizations: {
      "@default": organization,
      organization: {
        "@identifier": organization,
        title: obj.title,
        item: tree.nodes.map(function(node) {
          if (node.kind === "folder") {
            return {
              "@identifier": "item_" + identifier + node.suffix,
              title: node.title,
              item: node.children.map(scoItem),
              metadata: metadataBlock()
            };
          }
          return scoItem(node.leaf);
        }),
        metadata: metadataBlock(),
        "imsss:sequencing": {
          "imsss:controlMode": {
            "@choice": "true",
            "@flow": "true"
          }
        }
      }
    },
    resources: {
      metadata: metadataBlock(),
      resource: tree.resources.map(function(item) {
        return {
          "@identifier": "resource_" + identifier + item.suffix,
          "@type": "webcontent",
          "@href": item.href,
          "@adlcp:scormType": "sco",
          metadata: metadataBlock(),
          file: lessons.filesForLesson(obj.files, item.href)
        };
      })
    }
  };
};
