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
  function scoItem(item) {
    return {
      "@identifier": "item_" + identifier + item.suffix,
      "@identifierref": "resource_" + identifier + item.suffix,
      title: item.title,
      metadata: metadataBlock()
    };
  }

  return {
    "@identifier": identifier,
    "@version": 1,
    "@xmlns": "http://www.imsglobal.org/xsd/imscp_v1p1",
    "@xmlns:adlcp": "http://www.adlnet.org/xsd/adlcp_v1p3",
    "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "@xsi:schemaLocation": "http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd " +
      "http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd",
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
        metadata: metadataBlock()
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
