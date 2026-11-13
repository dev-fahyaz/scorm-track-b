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
      "adlcp:masteryscore": obj.masteryScore,
      metadata: metadataBlock()
    };
  }

  return {
    "@identifier": identifier,
    "@version": 1,
    "@xmlns:adlcp": "http://www.adlnet.org/xsd/adlcp_rootv1p2",
    "@xmlns": "http://www.imsproject.org/xsd/imscp_rootv1p1p2",
    "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "@xsi:schemaLocation": "http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd " +
      "http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd " +
      "http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd",
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
          "@adlcp:scormtype": "sco",
          metadata: metadataBlock(),
          file: lessons.filesForLesson(obj.files, item.href)
        };
      })
    }
  };
};
