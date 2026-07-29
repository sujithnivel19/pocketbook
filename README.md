# Pocketbook

Pocketbook keeps your documents on your phone and answers questions from them. Ask for your Aadhaar number, a bill amount, a licence expiry — the value comes back ready to copy or share. Nothing ever leaves your device.

It is an installable web app: no server, no account, no build step.

<sub>Ask → answer → the source scan, in one card.</sub>

---

## Run it

```bash
node tools/serve.js          # or: npm start
```

Then open <http://localhost:8080>.

There is nothing to install first — `tools/serve.js` uses only Node's standard library, and every dependency the app needs is vendored in this repository. A server is required, though: ES modules and service workers do not work from a `file://` URL.

To try it on a phone, serve from a machine on the same network and open that machine's LAN address. Install prompts and camera capture need HTTPS or `localhost`, so for phone testing over the network either put it behind a TLS-terminating tunnel or use your browser's "treat as secure origin" flag.

### Deploying

Any static host works — copy the repository as-is. Every path is relative, so it does not matter whether the app is served from a domain root or a subdirectory.

**GitHub Pages** is wired up in `.github/workflows/pages.yml`, which publishes the repository on every push to `main`. The site is at `https://<user>.github.io/pocketbook/`.

Setting this up on a fresh fork takes two things that a workflow cannot do for itself:

1. **Settings → Pages → Build and deployment → Source → GitHub Actions.** Creating a Pages site needs admin permission, which `GITHUB_TOKEN` never has however `permissions:` is written — `pages: write` covers deploying to a site that already exists, not creating one. Until this is set, the job fails at `configure-pages` with *"Resource not accessible by integration"*.
2. **Deploy from `main`.** Enabling Pages creates a `github-pages` environment whose deployment-branch policy allows only the default branch. A run on any other branch is rejected before a runner is even assigned: the job fails in about a second with no steps and *"Branch is not allowed to deploy to github-pages due to environment protections"*. Either merge to `main` or add the branch under Settings → Environments → github-pages.

**Camera capture and installation need HTTPS.** Pages provides it. On a plain-HTTP LAN address the app still runs and OCR still works, but the camera and the install prompt stay unavailable — use file upload to test, or put a TLS tunnel in front.

---

## What it does

**Ask.** Type a question in plain words. Pocketbook matches it against the fields it has extracted and returns one value, large, with a copy button — plus every other field on the same document, and the source scan with a download button.

**Add.** Photograph a document, upload an image, or open a PDF. Text is read on the device, fields are proposed, and you confirm or correct every one of them before anything is saved.

**Browse.** Filter by category, open a document to read every field, copy any of them, edit them, or delete it.

**Lock.** An optional four-digit PIN, asked for when the app opens and after you switch away.

**Back up.** One encrypted file, protected by a passphrase you choose, that you keep yourself.

### How questions are matched

By keyword, not by comprehension. `src/query.js` maps terms — `aadhaar`, `pan`, `expiry`, `amount` — onto field types, with a scored fallback across field labels, values and document names. It handles common phrasings and fails on unusual ones.

This is a consequence of the local-only promise, not an oversight: real language understanding needs an API call, and there are no API calls. The interface is written so as not to imply more than this delivers.

---

## Why local-only

The app holds Aadhaar and PAN numbers — data where a breach is severe and irreversible. Keeping everything on the device sidesteps third-party trust, most of the DPDP Act compliance burden, and the entire class of server-side breach.

Concretely: OCR runs in-page via Tesseract compiled to WebAssembly, storage is IndexedDB, matching is local pattern work. Tesseract's own core, the English training data, the PDF reader and even the three typefaces are all vendored under `vendor/` and `fonts/`, because upstream would otherwise fetch them from a CDN at first use. After the page loads, Pocketbook makes no network request at all.

The cost, stated plainly: nothing syncs, and there is no automatic backup. Lose the device or clear the browser's data and the vault goes with it. That is what the encrypted export is for.

---

## Layout

```
index.html              markup and the app shell
manifest.webmanifest    installability
sw.js                   offline caching
styles/app.css          the whole visual system
src/
  main.js               bootstrap, tabs, service worker registration
  db.js                 IndexedDB — documents, recent questions, settings
  store.js              shared state; views subscribe rather than call each other
  extract.js            patterns → proposed fields
  query.js              question → best matching field
  images.js             decode, downscale, thumbnail
  ocr.js                Tesseract binding, engine lifecycle
  pdf.js                text-layer extraction, page rasterising
  crypto.js             PBKDF2 and AES-GCM helpers
  backup.js             encrypted export and restore
  samples.js            demo documents, drawn on a canvas
  ui/                   one module per surface
tools/
  serve.js              dependency-free static server
  make-icons.py         regenerates the PWA icons
vendor/                 Tesseract, its wasm core, eng traineddata, pdf.js
fonts/                  self-hosted subsets of the three typefaces
```

No framework and no bundler. Views talk to `store.js`, which re-reads the database and notifies subscribers, so a save from the review sheet and a delete from the detail sheet take the same path.

### Caching

The service worker keeps two caches. The shell — markup, styles, modules, fonts, icons, roughly 300 KB — is precached on install, so the app opens instantly and works with no connection. The OCR engine and PDF reader under `vendor/` are about 17 MB and are cached on first use instead, so installing the app does not mean waiting on a download you may never need. **Settings → Download the text reader** fetches them deliberately.

Neither cache ever holds a document.

---

## Limits

- **English OCR only** (`eng` traineddata). Other languages would each add a few MB.
- **Accuracy varies sharply** between a clean scan and an angled phone photo. This is why the review step exists and cannot be skipped.
- **"Scan" captures one frame.** A real scan flow would do edge detection and perspective correction; the label promises slightly more than it delivers.
- **The PIN gates the screen, it does not encrypt the database.** Someone with the unlocked phone and developer tools can still read IndexedDB. Settings says so too.
- **Downloads land unencrypted** in the device's Downloads folder, outside the vault — the one place the local-only promise softens. The app warns when you use it.
- **Keyword matching, not language understanding.**
- **PDFs are read up to 12 pages**, and only the first page is kept as the preview.

Next, roughly in order: expiry tracking (dates are already extracted, so surfacing countdowns gives the app a reason to be useful when you are not searching), edge detection on capture, and more OCR languages.

---

## Third-party

Vendored, unmodified, with their licences alongside them:

| | | |
|---|---|---|
| [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 | `vendor/tesseract`, `vendor/tesseract-core` | Apache-2.0 |
| [tessdata](https://github.com/tesseract-ocr/tessdata) `eng` 4.0.0 | `vendor/tessdata` | Apache-2.0 |
| [pdf.js](https://github.com/mozilla/pdf.js) 4.10.38 | `vendor/pdfjs` | Apache-2.0 |
| Bricolage Grotesque, Instrument Sans, DM Mono | `fonts/` | SIL OFL 1.1 |

See [DESIGN.md](DESIGN.md) for the reasoning behind the interface.
