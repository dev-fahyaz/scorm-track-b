`version 0.2.7`

Track B SCORM export. A React dashboard collects the course record and the existing packager writes `imsmanifest.xml`, `metadata.xml`, and a zip an LMS can import. Track A stays the player: each lesson inside the zip finds `window.API` or `window.API_1484_11` and reports progress there.

Supported SCORM versions:

* SCORM 1.2
* SCORM 2004 3rd Edition
* SCORM 2004 4th Edition

## Dashboard

Install once from the repo root, then start the API and the dashboard together:

```bash
npm install
npm install --prefix web
npm run dev
```

Open http://localhost:5173/. The API listens on port 3001, and Vite proxies `/api` to it.

`npm start` runs only the API.

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`. Drafts use OpenRouter auto unless `OPENROUTER_MODEL` is set. The key stays on the API. It is not sent to the browser.

The form starts with lessons and the organization. Each lesson can hold videos and quizzes. A video is an https file URL or a YouTube link. An optional note tells the draft what the course is about. Titles, the description, keywords, durations, rights, the identifier, and the mastery score can be left blank. **Open zip** refills the form from a zip this dashboard built.

**Draft course** fills those fields from OpenRouter. It uses the video URLs and the note. It does not invent quiz questions. The fields stay editable. **Build SCORM zip** uses the form as it stands, and drafts first when the title, identifier, or description is still empty.

A lesson with one sub-lesson stays one launch file (`lesson-1.html`). A lesson with more than one becomes a folder, and each video or quiz is its own file (`lesson-1-1.html`, `lesson-1-2.html`). The manifest has no sequencing rules. The zip root contains:

* `imsmanifest.xml`
* `metadata.xml`
* one html file per video or quiz, plus shared `player.js` and `config.json`
* the poster, when one was provided
* the XSD or DTD files for the selected edition

`player.js` walks parent frames for the SCORM API. A file URL plays in the video element. A YouTube link plays through the YouTube IFrame API on youtube.com, with the page origin sent to the player. Both resume from the bookmark, store a short watched-segment bitmap in suspend data, and commit about every 15 seconds and on exit. Completion is set when the watched fraction reaches the threshold. If the YouTube API cannot load, the page says playback could not be tracked. If the owner has disabled embedding, the page says so.

A question is single choice, true/false, multiple answers, or a short fill-in. It can sit on a video at a minute-and-second mark, or after the video ends, or in its own quiz launch file. Reaching an unanswered checkpoint pauses the video there. The score is correct answers out of 100. Each answer is also written to `cmi.interactions`. When **A failed quiz blocks completion** is on, the item stays incomplete until the watch threshold is met and the score reaches the mastery score. When it is off, the watch threshold still completes a video, and the quiz still reports the score and pass or fail. A failed gated quiz can be retried. Answered checkpoints are kept in suspend data, so reopening the lesson does not ask them again.

## Library

The packager is still usable on its own. It creates a SCORM package from a source directory.

```bash
npm install simple-scorm-packager
```

### Options

{type} [default]

* `version` {string} ['1.2'] Version of SCORM schema. Available options:
    * '1.2'
    * '2004 3rd Edition' alias '2004.3' alias '2004v3'
    * '2004 4th Edition' alias '2004.4' alias '2004v4'
* `organization` {string} [''] Company name
* `language` {string} ['en'] Language of the package ( ISO )
* `title` {string} ['']
* `identifier` {string} [null] If empty, identifier is generated using:
`${package.author || 'com'}.${organization || 'company'}.${title || ''}.${generated uuid}`
* `masteryScore` {number} [80]
* `startingPage` {string} ['index.html']
* `source` {string} ['./'] The path to files from which the package will be created
* `package` {object} Available options:
    * `zip` {boolean} [false] Archives package (`NAME_VERSION_DATE.zip`)
    * `appendTimeToOutput` {boolean} [false] Add full Unix time milliseconds to the zip file output, so repeated builds are unique (`NAME_VERSION_DATE_TIMESTAMP.zip`)
    * `outputFolder` {string} ['./scorm'] The folder path where you want the zip file
    * `size` {number} [null] Provide the package size in bytes, automatically calculated when not set
    * `name` {string} [`{$title}`] Package name, defaults to scorm title
    * `author` {string} [''] Author name, used as default for vcard if not provided
    * `version` {string} [process.env.npm_package_version || '1.0.0'] Package version
    * `organization` {string} [`${organization}`] Company name
    * `date` {string} [current date YYYY-MM-DD] Package date
    * `vcard` {object}:
      * `author` {string} [`${package.author}`] Author name
      * `org` {string} [`${package.organization}` || `${organization}`] Organization name, defaults to `organization`
      * `tel` {string} [''] Telephone number(s)
      * `address` {string} [''] Address
      * `mail` {string} [''] E-mail contact
      * `url` {string} [''] website url
    * `description` {string} [''] Provide the course description or the Project Information
    * `keywords` {array} [[]] Keywords
    * `duration` {string} ['PT0H0M0S'] The time the media takes to play through, format PT#H#M#S
    * `typicalDuration` {string} [`${package.duration}` || 'PT0H0M0S'] The time it will take for a typical learner to fully experience the program, format PT#H#M#S
    * `requirements` {array of objects of the following structure} [[]]
      * `type` {string} The type of requirement, eg.: Browser, Os
      * `name` {string} The name of the type of requirement, eg.: Microsoft Internet Explorer
      * `version` {string} The minimum version of the requirement
    * `rights` {string} [`© ${organization || ''}. All rights reserved.`] Copyright information

### Programmatic usage

```javascript
var scopackager = require('simple-scorm-packager');

scopackager({
  version: '2004 4th Edition',
  organization: 'Test Company',
  title: 'Test Course',
  language: 'fr-FR',
  identifier: '00',
  masteryScore: 80,
  startingPage: 'index.html',
  source: './myProjectFolder',
  package: {
    version: "0.0.1",
    zip: true,
    outputFolder: './scormPackages'
  }
}, function(msg){
  console.log(msg);
});
```

### npm scripts

To package another project from an npm script:

1. Create `scoPackager.js` next to that project's `package.json`.
2. Call the packager from that file:

```javascript
var scopackager = require('simple-scorm-packager');
var path = require('path');

const config = {
  version: '1.2',
  organization: 'My Amazing Company',
  title: 'Test Course',
  language: 'en-US',
  masteryScore: 80,
  startingPage: 'index.html',
  source: path.join(__dirname, 'build'),
  package: {
    version: process.env.npm_package_version,
    zip: true,
    author: 'Firstname Lastname',
    outputFolder: path.join(__dirname, 'scorm_packages'),
    description: 'A test of the course packaging module',
    keywords: ['scorm', 'test', 'course'],
    typicalDuration: 'PT0H5M0S',
    rights: `©${new Date().getFullYear()} My Amazing Company. All right reserved.`,
    vcard: {
      author: 'Firstname Lastname',
      org: 'My Amazing Company',
      tel: '(000) 000-0000',
      address: 'my address',
      mail: 'my@email.com',
      url: 'https://mydomain.com'
    }
  }
};

scopackager(config, function(msg){
  console.log(msg);
  process.exit(0);
});
```

3. Add `"package-scorm": "node scoPackager.js"` to that project's scripts.
4. Run `npm run package-scorm`.

### CLI

If the packager is installed globally:

```bash
simple-scorm-packager
```

or

```bash
scopackager
```
