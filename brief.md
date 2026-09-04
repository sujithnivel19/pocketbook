# Pocketbook — Brief

## Goal + User
Local-first document vault for individuals who need to store, organize, and query personal documents (IDs, bills, certificates) without relying on cloud services or external servers. Users scan documents via camera or upload images/PDFs, extract text via on-device OCR, and ask natural language questions to retrieve information from their vault.

## Known facts
- **Offline-first PWA** with IndexedDB for local storage
- **No network requests** after initial page load
- **OCR engine**: Tesseract (~15 MB), downloaded and cached on first scan
- **Supported formats**: Images (JPG, PNG), PDFs (text + scanned)
- **Device-stored**: All documents, OCR data, and metadata remain on-device
- **Core features**: Document upload/capture, text extraction, field extraction, document list/search, ask interface
- **Tech stack**: Vanilla JS, CSS, HTML; no frameworks
- **Browser caching**: Service Worker for offline functionality
- **Current UI**: Two-view navigation (Ask + Documents tabs), FAB for capture, settings panel

## Constraints
- **Privacy first**: No cloud sync, no accounts, no analytics
- **Performance**: Must work on older devices and slow networks (except for OCR download)
- **Accessibility**: WCAG compliant, keyboard navigation, semantic HTML
- **Storage**: Must handle IndexedDB quota limits (~50MB on most browsers)
- **Typography**: Only Instrument Sans and Bricolage Grotesque fonts (self-hosted, no external requests)
- **Offline capability**: All features must function without network after initial load
- **Mobile-first**: Optimized for small screens, touch interactions

## Unknowns / assumptions
- **Volume of documents per user**: Not defined — performance untested with 1000+ documents
- **Concurrent edits**: Single-device assumption; no sync between devices
- **Error handling for malformed PDFs**: Behavior for PDFs without text layer or corrupted files not fully specified
- **Storage quota strategy**: No automatic cleanup or archival if user hits quota limits
- **Lock/PIN security**: PIN locks screen but doesn't encrypt database; threat model not fully defined
- **OCR accuracy**: Depends on image quality; no feedback loop for user corrections
- **Backup/restore process**: Encrypted backups exist but recovery from data loss is manual
- **Future sync**: If ever needed, migration path from offline-only to sync is unknown
