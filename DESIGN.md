# Pocketbook — Design Documentation

A local-first personal documents app. Store IDs, certificates and bills on your own device; ask in plain words to get a value back.

---

## 1. Product principle

**Nothing leaves the device.** OCR runs in-page via Tesseract compiled to WebAssembly, storage is IndexedDB, matching is local pattern work. There is no server, no account, and no network call after the page loads.

This is a product decision, not a technical shortcut. The app holds Aadhaar and PAN numbers — data where a breach is severe and irreversible. Local-only sidesteps third-party trust, most DPDP Act compliance burden, and the entire class of server-side breach.

**Vendoring is part of the principle, not packaging convenience.** Tesseract fetches its wasm core and traineddata from a CDN by default; pdf.js does the same with its worker; webfonts are a request to Google on every cold load. Each of those is a third party learning that someone opened a documents app. All of them are checked into this repository and served from the same origin, so the claim on the status pill — *On device* — is literally true.

The cost, stated plainly: no cross-device sync, and no automatic backup. Losing the device or clearing browser data loses everything. **The encrypted export now exists** (§5) and is the only copy.

---

## 2. Core interaction model

Three actions, in order of frequency:

1. **Ask** — type a question, get one value back with its source
2. **Add** — capture a document, confirm extracted fields, save
3. **Browse** — scan the list, open one, read, copy, edit or delete it

The hierarchy shapes the layout. Ask occupies the landing screen; adding lives behind a single button; browsing is a secondary tab. Settings is a topbar affordance rather than a third tab — it is used rarely, and a third tab would unbalance the notch.

### Why "Ask" and not "Search"

The app answers questions rather than returning results to scan. "Search" sets an expectation of a result list; "Ask" sets an expectation of an answer. The tab is labelled **Ask** to match what the interaction actually does.

### On "natural language"

Queries are matched by keyword, not understood. `src/query.js` maps terms (`aadhaar`, `pan`, `expiry`, `amount`) to field types, then falls back to a scored pass over field labels, values and document names.

The scoring tiers are deliberately far apart — a synonym hit scores ~100, a label match ~55, a value match ~30 — so a weaker match on a longer document can never edge past a strong one. Ties break toward the newest document, which is nearly always the one meant.

This is a deliberate constraint of the local-only promise — real language understanding needs an API call. It handles common phrasings well and fails on anything unusual. **The UI should never imply more comprehension than this delivers.**

---

## 3. Visual language

### Palette

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0B0C0F` | Page |
| `--surface` | `#14161B` | Cards, bars |
| `--raised` | `#1C1F26` | Nested elements |
| `--hairline` | `#262A33` | Borders |
| `--accent` | `#D4E048` | The single bold move |
| `--sage` | `#7FD1A0` | "On device" status |
| `--rust` | `#E08585` | Destructive, miss state |
| `--text` | `#F2F3F5` | Primary |
| `--muted` | `#7E858F` | Secondary |

**Accent discipline is the whole system.** Electric citron appears on: the primary button, the active tab, field labels on the answer card, and the scan line. Nowhere else. Its scarcity is what makes it land — the moment it decorates, the hierarchy collapses.

Dark ground isn't aesthetic preference. This app gets opened to retrieve an ID number, often in public. A dark screen is less legible over the shoulder.

### Type

| Face | Use | Why |
|---|---|---|
| Bricolage Grotesque | Headlines, sheet titles | Variable, slightly irregular; tracked to `-0.035em` so headlines read as statements |
| Instrument Sans | Body, labels, buttons | Neutral, high legibility at small sizes |
| DM Mono | Extracted values, counts, dates | **Load-bearing, not decorative** |

Monospace marks machine-read data. When a value is in DM Mono, it came out of OCR; when it's in Instrument Sans, a human wrote it. In an app where a misread digit matters, that distinction earns its place.

All three are self-hosted as latin and latin-ext subsets. Latin-ext is not optional — it carries `₹`, and bill amounts are a primary use.

### Radius

| Token | Value | Applies to |
|---|---|---|
| `--r` | `14px` | Cards, sheets' inner elements, document rows, answer card |
| `--r-sm` | `10px` | Nested controls — inputs, icon buttons, segmented control, monogram tiles |

Two rules govern everything not in the table:

1. **Pills are always half their height.** A 56px ask bar is `28px`; a 50px dial option is `25px`; a chip is `20px`. Anything meant to read as fully rounded derives its radius rather than picking one.
2. **Nested radius steps down.** A `--r` card contains `--r-sm` controls. Matching radii at different sizes makes the inner element look wrong; the smaller value keeps the corners visually concentric.

Sheets are the one exception at `24px` on the top corners only — larger than a card because they're the full width of the screen, and a 14px corner reads as almost square at that scale.

### Spacing

Built on a 4px base, but only these values are in use:

| Value | Role |
|---|---|
| `22px` | Screen gutter — every view, every sheet |
| `20–22px` | Card interior padding |
| `9–12px` | Gaps between siblings in a list or row group |
| `26–34px` | Separation between distinct sections |

The gutter is the one to hold constant. Filter chips deliberately break it with a negative margin so they can bleed off-screen — that's the only intentional violation, and it exists to signal scrollability.

### Sizing

| Element | Size | Note |
|---|---|---|
| Ask bar | `56px` | Landing screen's largest control |
| Overlay input | `54px` | Slightly smaller — it's already the focus |
| FAB | `60px` | Centered, holding the notch |
| Dial option pill | `50px` | Reads as secondary to the FAB |
| Keypad key | `66px` | Larger than any other control — pressed four times in a row, often one-handed |
| Icon buttons (primary copy, download overlay) | `42px` / `38px` | Above the 44px guideline once padding is counted |
| Secondary copy (per-field, in "Also in this document") | `32px` | Deliberately smaller — secondary to the primary answer |
| Monogram tile | `42px` | Matches primary icon buttons for cross-screen rhythm |
| Filter chip | `~35px` | Deliberately small — a filter isn't a primary action |

Interactive elements sit at 42px and up. Nothing tappable falls below it.

### Elevation

Shadow appears only on elements that float above the page. Two recipes total:

| Use | Recipe |
|---|---|
| FAB | `0 0 0 7px` background ring + `0 6px 22px rgba(0,0,0,0.5)` |
| Dial option | `0 6px 20px rgba(0,0,0,0.4)` |

The background-coloured ring is doing real work, not decoration. On dark ground a shadow alone is nearly invisible, so the ring cuts a hard silhouette — separating the FAB from a document row scrolling beneath it, and forming the notch.

Cards, rows and bars use a `--hairline` border instead of shadow. Depth on this surface comes from borders; elevation is reserved for things that genuinely overlay.

### Motion

One easing curve throughout: `cubic-bezier(0.32, 0.72, 0, 1)`.

- Content rises 10px on view entry, staggered 40–50ms per child
- Lists stagger per row at 40ms; recents at 35ms
- Sheets slide up over 340ms
- Buttons scale to ~0.94 on press
- A wrong PIN shakes the dots for 420ms — the one place motion carries information rather than order
- All of it disabled under `prefers-reduced-motion`

Motion communicates order and origin. It never gates the interaction.

---

## 4. Screens

### Ask (landing)

Hero centred in the upper half, ask bar landing on the vertical midline, Recent list flowing below. The midline position is a compromise: reachable one-handed, but not the easy thumb zone. A bottom-fixed bar would be more comfortable and less composed.

**The hero is a greeting, not a tagline.** It reads visit count from an IndexedDB `meta` store and stages accordingly:

| Visits | Tone | Subline does |
|---|---|---|
| 1 | "Welcome to your pocketbook." | Onboards — what to do, and the on-device promise up front |
| 2–3 | "Good to see you again." | Prompts the next action, branching on whether anything's stored |
| 4+ | Time-of-day ("Good morning.") | Utilitarian — document count and a direct prompt |

Warmth is deliberately front-loaded and decays with familiarity — a greeting that still says "Welcome!" on the fortieth visit reads as a script rather than a greeting.

Tapping the bar opens a full overlay — backdrop blur, recents rising above a pinned input that meets the keyboard. Before any search history exists it shows suggested questions instead of an empty list. Recents persist (max 8, newest first) and can be cleared.

**After a query runs**, the hero collapses (max-height and opacity ease out) and the ask bar rises to the top of the view, carrying the question that was asked, with the answer directly beneath — the screen making room for the answer rather than jumping to a new state. The card carries a dismiss control in its top-right corner, and tapping the Ask tab while already on it does the same thing. *(The dismiss control closes a discoverability gap flagged in the previous revision: tab-reset was the only way back, and nothing on screen said so.)*

**Recent is capped at four documents**, with a "See all" link into the Documents tab once there are more. At twenty documents the label had stopped being true.

### Answer card

A full document card rather than a single value, top to bottom:

1. **The matched field** — label in citron, value in DM Mono at 23px, copy button. This is the answer to what you asked, and stays visually dominant.
2. **"Also in this document"** — every other extracted field on the same document, each as its own row with a smaller copy button. Ask for an Aadhaar number and Name and DOB come with it, one tap from the clipboard — usually what the next form field wants anyway.
3. **Source image with download overlaid** — the document's stored scan, with a blurred download chip in the top-right corner of the image itself rather than beside the text. Name, type and date sit beneath.
4. **"Other matches"** — when more than one document could have answered, a scrollable strip of the alternatives. Tapping one re-renders the card around it and offers the previous answer back in the same strip, so switching is reversible.

**Copy and download do different jobs.** Copy yields a value for pasting into a form; download yields the source scan, which is what offices actually ask you to attach. Both stay available even when there's no image — download falls back to a `.txt` export of every field, so a fields-only document still has something to hand over. Downloading raises a note that the file is now outside the vault, unencrypted.

**No image stored** is a real, supported state, not just a gap for old data — a placeholder icon and caption stand in for the preview, at a fraction of a real image's height so it doesn't claim weight it hasn't earned. The download button stays visible in this state.

Miss state reuses the card shape with a rust border and no field rows — there's nothing to copy or download.

### Documents

Filter chips (All / ID / Certificate / Bill / Other) with counts in mono. Empty categories are hidden, so the row grows with your library rather than showing dead options. The row bleeds past the container gutter to signal scrollability without a scrollbar.

Rows are single-column: a thumbnail of the scan where one exists and a type monogram where it doesn't, then filename, field count and date, then type badge. Tap opens the detail sheet — every field with its own copy button, the stored scan with download, and Edit and Delete.

**Delete confirms.** The previous revision deleted on a single tap; in an app with no undo and no automatic backup, that is a data-loss bug rather than a nicety.

### Capture flow

FAB → speed dial (Scan, Upload, PDF) → reading overlay → review sheet → saved.

**The review step is non-negotiable.** OCR misreads digits, and this app stores numbers where a wrong digit is worse than no answer. Every field is editable, removable and addable before it's committed, the document's name is editable, and raw text is shown beneath for reference.

**Scan sits closest to the button** — shortest thumb travel for the most common path. PDF sits furthest even though it is the format most documents arrive in, because opening a PDF is a considered action and photographing something is not.

Images are decoded once and used three ways: a 2200px bitmap for OCR, a 1600px JPEG for storage, and a 320px thumbnail for lists. Storing the original would put 4–8 MB per document into the origin's quota and exhaust it within a dozen scans.

**The first scan is also a download.** The engine is ~15 MB and is not precached, so the overlay says "Preparing the reader… first run only" rather than showing a progress bar that appears stuck. Settings offers to fetch it deliberately instead.

### Lock

Full-screen, above everything, with its own numeric keypad rather than a text input — a system keyboard would cover half the screen to type four digits. Four dots fill as you press; the fourth press submits on its own.

The PIN is checked against a PBKDF2-SHA256 derivation (310k iterations, per-install salt) stored in IndexedDB. The PIN itself is never stored.

**What it is honest about:** this gates the interface, it does not encrypt the database. Someone with the unlocked phone and developer tools can still read IndexedDB. Settings says exactly that, next to the switch, because a security control that overstates itself is worse than none.

---

## 5. Resolved

**PDF support — shipped.** PDF is the format documents arrive in first, and photographing a document that already exists as a file inverted the real workflow. Where a PDF carries a text layer it is read directly and OCR is skipped entirely — faster, and more accurate than any photograph of the same page. Scanned PDFs have no text layer, so those pages are rasterised at 2× and sent through OCR as before.

One subtlety worth recording: pdf.js returns text as positioned items, and a letter-spaced run arrives as *one item per glyph*. Joining them on a space turned `BQRPS4821K` into `B Q R P S 4 8 2 1 K` and no pattern ever matched it. Items are now concatenated as they come, broken only where the PDF declares a line end.

**App lock — shipped.** See above. Auto-lock is configurable: immediately, or after 1, 5 or 15 minutes away.

**Encrypted export/import — shipped.** AES-256-GCM under a PBKDF2 key (420k iterations) from a passphrase the app never stores. Restore merges into the existing vault rather than replacing it and skips documents already present, so restoring the same file twice is a no-op — the safe behaviour when someone is unsure whether the first attempt worked.

**Field extraction — tightened.** Aadhaar candidates are now checked against the Verhoeff checksum, so a random twelve-digit run on a bill is no longer offered as an ID number. Account-number capture requires the value to contain a digit; without that, *"Permanent Account Number"* on a PAN card matched and proposed the word "Number" as an account number. Passport, voter ID, IFSC, GSTIN and vehicle registration were added.

**FAB placement — center notch.** A one-shot action inside persistent navigation implies it's a peer of Ask and Documents, which it isn't. The notch's visual break — the button physically interrupting the bar's plane — was judged enough to keep that reading honest. Revisit if user testing shows people tapping it expecting a screen change.

**Sample documents render real preview images.** Loading the sample set draws a document-style image per sample on a canvas rather than seeding with no image — the answer card's image preview is otherwise undemonstrable without a real scan. The sample Aadhaar number is checksum-valid so the extractor treats it as real; it belongs to nobody.

---

## 6. Known limitations

- English OCR only (`eng` traineddata)
- Accuracy varies sharply between clean scans and angled phone photos
- The PIN gates the screen; it does not encrypt data at rest
- Downloads land unencrypted outside the vault — the one place the promise softens, and the app says so when it happens
- Keyword matching, not language understanding
- PDFs are read to a 12-page limit; only the first page is kept as the preview
- **"Scan"** captures one frame and OCRs it. A real scan flow would do edge detection and perspective correction. The label promises slightly more than it delivers.

---

## 7. Next, in priority order

1. **Expiry tracking** — dates are already extracted; surfacing countdowns gives the app a reason to be useful when you aren't searching. The highest-value remaining feature, and the cheapest.
2. **Edge detection on capture** — makes "Scan" mean what it says, and lifts OCR accuracy more than any other single change.
3. **Encryption at rest** — deriving a key from the PIN and encrypting stored blobs would let the lock claim what people already assume it claims.
4. **More OCR languages** — a few MB each, downloaded on demand the way the English engine already is.
5. **Multi-page documents as one record** — today a 12-page PDF becomes one document with one preview; a passport or a long bill wants pages kept together.
