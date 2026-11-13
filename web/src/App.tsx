import { useState, type FormEvent, type ReactNode } from "react";
import { buildPackage, downloadBlob } from "./api";
import { emptyForm, toRequest, type PackageForm, type ScormVersion } from "./types";
import { manifestId, organizationId, validateForm } from "./validate";

const VERSIONS: ScormVersion[] = ["1.2", "2004 3rd Edition", "2004 4th Edition"];

export function App() {
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  function update<K extends keyof PackageForm>(key: K, value: PackageForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onPoster(file: File | undefined) {
    if (!file) {
      update("posterName", "");
      update("posterDataUrl", "");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((current) => ({
        ...current,
        poster: "Use a JPEG, PNG, or WebP poster.",
      }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        poster: "Poster must be 2 MB or smaller.",
      }));
      return;
    }
    const dataUrl = await readFile(file);
    setErrors((current) => {
      const next = { ...current };
      delete next.poster;
      return next;
    });
    setForm((current) => ({
      ...current,
      posterName: file.name,
      posterDataUrl: dataUrl,
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setMessage("");
    setFailed(false);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }

    setBusy(true);
    try {
      const result = await buildPackage(toRequest(form));
      downloadBlob(result.blob, result.filename);
      setMessage(`Downloaded ${result.filename}.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Build failed.");
    } finally {
      setBusy(false);
    }
  }

  const org = organizationId(form.organization) || "—";
  const id = manifestId(form.identifier) || "—";
  const itemTitle = form.title.trim() || "—";
  const rightsHint = form.organization.trim()
    ? `Defaults to © ${form.organization.trim()}. All rights reserved.`
    : "Defaults to a copyright line for the organization.";

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Track B</p>
          <h1>SCORM export</h1>
          <p className="lede">
            Fill the course record. The packager writes the manifest and metadata,
            then returns a zip Track A can launch.
          </p>
        </div>
        <div className="version-pill">Single lesson · {form.version}</div>
      </header>

      <form onSubmit={onSubmit} noValidate>
        <section>
          <h2>Identity</h2>
          <p className="section-note">
            These fields name the package and choose the SCORM edition.
          </p>
          <div className="grid">
            <Field label="SCORM version" name="version">
              <select
                id="version"
                value={form.version}
                onChange={(event) => update("version", event.target.value as ScormVersion)}
              >
                {VERSIONS.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </Field>
            <Text
              label="Package version"
              name="packageVersion"
              value={form.packageVersion}
              error={errors.packageVersion}
              onChange={(value) => update("packageVersion", value)}
            />
            <Text
              label="Course title"
              name="title"
              value={form.title}
              error={errors.title}
              onChange={(value) => update("title", value)}
              wide
            />
            <Text
              label="Package name"
              name="packageName"
              value={form.packageName}
              placeholder="Defaults to the course title"
              onChange={(value) => update("packageName", value)}
            />
            <Text
              label="Organization"
              name="organization"
              value={form.organization}
              error={errors.organization}
              onChange={(value) => update("organization", value)}
            />
            <Text
              label="Language"
              name="language"
              value={form.language}
              error={errors.language}
              onChange={(value) => update("language", value)}
            />
            <Text
              label="Identifier"
              name="identifier"
              value={form.identifier}
              error={errors.identifier}
              onChange={(value) => update("identifier", value)}
            />
          </div>
        </section>

        <section>
          <h2>Course structure</h2>
          <p className="section-note">
            The manifest is one organization and one lesson. The launch file is index.html.
          </p>
          <ul className="tree">
            <li>
              <strong>Organization</strong> <span className="muted">{org}</span>
              <ul>
                <li>Title: {itemTitle}</li>
                <li>
                  Item <span className="muted">item_{id}</span>
                  <ul>
                    <li>Title: {itemTitle}</li>
                    <li>Launch: index.html</li>
                    <li>Resource: resource_{id}</li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
          <div className="grid" style={{ marginTop: 16 }}>
            <Text
              label="Mastery score"
              name="masteryScore"
              value={form.masteryScore}
              error={errors.masteryScore}
              onChange={(value) => update("masteryScore", value)}
              inputMode="decimal"
            />
          </div>
        </section>

        <section>
          <h2>Metadata</h2>
          <p className="section-note">Written to metadata.xml with the package record.</p>
          <div className="grid">
            <Field label="Description" name="description" error={errors.description} wide>
              <textarea
                id="description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>
            <Text
              label="Keywords"
              name="keywords"
              value={form.keywords}
              placeholder="security, awareness"
              onChange={(value) => update("keywords", value)}
              wide
            />
            <Text
              label="Author"
              name="author"
              value={form.author}
              onChange={(value) => update("author", value)}
            />
            <Text
              label="Duration"
              name="duration"
              value={form.duration}
              error={errors.duration}
              onChange={(value) => update("duration", value)}
            />
            <Text
              label="Typical duration"
              name="typicalDuration"
              value={form.typicalDuration}
              error={errors.typicalDuration}
              onChange={(value) => update("typicalDuration", value)}
            />
            <Text
              label="Rights"
              name="rights"
              value={form.rights}
              placeholder={rightsHint}
              onChange={(value) => update("rights", value)}
              wide
            />
            <Text
              label="Contact organization"
              name="vcardOrg"
              value={form.vcardOrg}
              onChange={(value) => update("vcardOrg", value)}
            />
            <Text
              label="Telephone"
              name="vcardTel"
              value={form.vcardTel}
              onChange={(value) => update("vcardTel", value)}
            />
            <Text
              label="Address"
              name="vcardAddress"
              value={form.vcardAddress}
              onChange={(value) => update("vcardAddress", value)}
              wide
            />
            <Text
              label="Email"
              name="vcardMail"
              value={form.vcardMail}
              onChange={(value) => update("vcardMail", value)}
            />
            <Text
              label="Website"
              name="vcardUrl"
              value={form.vcardUrl}
              error={errors.vcardUrl}
              onChange={(value) => update("vcardUrl", value)}
            />
          </div>
        </section>

        <section>
          <h2>Lesson</h2>
          <p className="section-note">
            The video stays on its https URL. The zip contains the player, not the MP4.
          </p>
          <div className="grid">
            <Text
              label="Video URL"
              name="videoUrl"
              value={form.videoUrl}
              error={errors.videoUrl}
              placeholder="https://cdn.example.com/videos/course.mp4"
              onChange={(value) => update("videoUrl", value)}
              wide
            />
            <Text
              label="Completion threshold (%)"
              name="completionThreshold"
              value={form.completionThreshold}
              error={errors.completionThreshold}
              onChange={(value) => update("completionThreshold", value)}
              inputMode="numeric"
            />
            <Field label="Poster" name="poster" error={errors.poster}>
              <div className="file-row">
                <input
                  id="poster"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void onPoster(event.target.files?.[0])}
                />
                {form.posterName ? (
                  <button
                    type="button"
                    onClick={() => {
                      update("posterName", "");
                      update("posterDataUrl", "");
                    }}
                  >
                    Remove {form.posterName}
                  </button>
                ) : null}
              </div>
            </Field>
          </div>
        </section>

        <div className="actions">
          {message ? (
            <p className={failed ? "banner error" : "banner ok"} role="status">
              {message}
            </p>
          ) : (
            <span />
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Building zip…" : "Build SCORM zip"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Text(props: {
  label: string;
  name: string;
  value: string;
  error?: string;
  placeholder?: string;
  wide?: boolean;
  inputMode?: "decimal" | "numeric" | "text";
  onChange: (value: string) => void;
}) {
  return (
    <Field label={props.label} name={props.name} error={props.error} wide={props.wide}>
      <input
        id={props.name}
        value={props.value}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        aria-invalid={props.error ? true : undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </Field>
  );
}

function Field(props: {
  label: string;
  name: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={props.wide ? "field wide" : "field"}>
      <label htmlFor={props.name}>{props.label}</label>
      {props.children}
      {props.error ? <p className="error">{props.error}</p> : null}
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
