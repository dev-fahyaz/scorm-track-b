export type ScormVersion = "1.2" | "2004 3rd Edition" | "2004 4th Edition";

export interface PackageForm {
  version: ScormVersion;
  title: string;
  packageName: string;
  organization: string;
  language: string;
  identifier: string;
  packageVersion: string;
  masteryScore: string;
  description: string;
  keywords: string;
  author: string;
  duration: string;
  typicalDuration: string;
  rights: string;
  vcardOrg: string;
  vcardTel: string;
  vcardAddress: string;
  vcardMail: string;
  vcardUrl: string;
  videoUrl: string;
  completionThreshold: string;
  posterName: string;
  posterDataUrl: string;
}

export interface PackageRequest {
  version: ScormVersion;
  title: string;
  organization: string;
  language: string;
  identifier: string;
  masteryScore: number;
  startingPage: "index.html";
  videoUrl: string;
  completionThreshold: number;
  posterDataUrl?: string;
  package: {
    name: string;
    version: string;
    author: string;
    description: string;
    keywords: string[];
    duration: string;
    typicalDuration: string;
    rights: string;
    zip: true;
    vcard: {
      author: string;
      org: string;
      tel: string;
      address: string;
      mail: string;
      url: string;
    };
  };
}

export const emptyForm: PackageForm = {
  version: "1.2",
  title: "",
  packageName: "",
  organization: "",
  language: "en",
  identifier: "",
  packageVersion: "1.0.0",
  masteryScore: "80",
  description: "",
  keywords: "",
  author: "",
  duration: "PT0H0M0S",
  typicalDuration: "PT0H0M0S",
  rights: "",
  vcardOrg: "",
  vcardTel: "",
  vcardAddress: "",
  vcardMail: "",
  vcardUrl: "",
  videoUrl: "",
  completionThreshold: "90",
  posterName: "",
  posterDataUrl: "",
};

export function toRequest(form: PackageForm): PackageRequest {
  const keywords = form.keywords
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);

  return {
    version: form.version,
    title: form.title.trim(),
    organization: form.organization.trim(),
    language: form.language.trim(),
    identifier: form.identifier.trim(),
    masteryScore: Number(form.masteryScore),
    startingPage: "index.html",
    videoUrl: form.videoUrl.trim(),
    completionThreshold: Number(form.completionThreshold),
    posterDataUrl: form.posterDataUrl || undefined,
    package: {
      name: form.packageName.trim() || form.title.trim(),
      version: form.packageVersion.trim() || "1.0.0",
      author: form.author.trim(),
      description: form.description.trim(),
      keywords,
      duration: form.duration.trim(),
      typicalDuration: form.typicalDuration.trim(),
      rights: form.rights.trim(),
      zip: true,
      vcard: {
        author: form.author.trim(),
        org: form.vcardOrg.trim(),
        tel: form.vcardTel.trim(),
        address: form.vcardAddress.trim(),
        mail: form.vcardMail.trim(),
        url: form.vcardUrl.trim(),
      },
    },
  };
}
